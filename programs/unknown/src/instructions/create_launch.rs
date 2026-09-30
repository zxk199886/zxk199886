use anchor_lang::prelude::*;
use solana_sha256_hasher::hashv;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token_2022::spl_token_2022::instruction::AuthorityType;
use anchor_spl::token_2022::{self, MintTo, SetAuthority, Token2022};
use anchor_spl::token_2022_extensions::spl_pod::optional_keys::OptionalNonZeroPubkey;
use anchor_spl::token_2022_extensions::spl_token_metadata_interface::state::TokenMetadata;
use anchor_spl::token_2022_extensions::{
    token_metadata_initialize, token_metadata_update_authority, TokenMetadataInitialize,
    TokenMetadataUpdateAuthority,
};
use anchor_spl::token_interface::{Mint, TokenAccount};

use crate::constants::*;
use crate::errors::UnknownError;
use crate::events::LaunchCreated;
use crate::state::*;
use crate::util::pay;
use crate::vrf;

#[derive(Accounts)]
pub struct CreateLaunch<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,

    #[account(seeds = [SEED_CONFIG], bump = config.bump)]
    pub config: Box<Account<'info, Config>>,

    /// Fresh keypair. Freeze authority is never set; mint authority is revoked below.
    #[account(
        init,
        payer = creator,
        mint::decimals = TOKEN_DECIMALS,
        mint::authority = launch,
        mint::token_program = token_program,
        extensions::metadata_pointer::authority = launch,
        extensions::metadata_pointer::metadata_address = mint,
    )]
    pub mint: Box<InterfaceAccount<'info, Mint>>,

    #[account(
        init,
        payer = creator,
        space = 8 + Launch::INIT_SPACE,
        seeds = [SEED_LAUNCH, mint.key().as_ref()],
        bump
    )]
    pub launch: Box<Account<'info, Launch>>,

    #[account(mut, seeds = [SEED_SOL_VAULT, mint.key().as_ref()], bump)]
    pub sol_vault: SystemAccount<'info>,

    #[account(
        init,
        payer = creator,
        space = 8 + DevVault::INIT_SPACE,
        seeds = [SEED_VAULT, mint.key().as_ref()],
        bump
    )]
    pub dev_vault: Box<Account<'info, DevVault>>,

    #[account(
        init,
        payer = creator,
        space = 8 + HolderPool::INIT_SPACE,
        seeds = [SEED_POOL, mint.key().as_ref()],
        bump
    )]
    pub holder_pool: Box<Account<'info, HolderPool>>,

    #[account(
        init,
        payer = creator,
        associated_token::mint = mint,
        associated_token::authority = launch,
        associated_token::token_program = token_program,
    )]
    pub curve_token_account: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
        init,
        payer = creator,
        associated_token::mint = mint,
        associated_token::authority = dev_vault,
        associated_token::token_program = token_program,
    )]
    pub vault_token_account: Box<InterfaceAccount<'info, TokenAccount>>,

    /// CHECK: ORAO VRF program (ignored in mock-vrf builds).
    pub vrf_program: UncheckedAccount<'info>,
    /// CHECK: validated by the VRF program.
    #[account(mut)]
    pub vrf_network_state: UncheckedAccount<'info>,
    /// CHECK: validated by the VRF program.
    #[account(mut)]
    pub vrf_treasury: UncheckedAccount<'info>,
    /// CHECK: address checked against the request seed in `vrf::request`.
    #[account(mut)]
    pub randomness: UncheckedAccount<'info>,

    pub token_program: Program<'info, Token2022>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

pub fn dice_seed(mint: &Pubkey) -> [u8; 32] {
    hashv(&[b"dice".as_slice(), mint.as_ref()]).to_bytes()
}

pub fn create_launch(
    ctx: Context<CreateLaunch>,
    name: String,
    symbol: String,
    uri: String,
    dev_buy_lamports: u64,
) -> Result<()> {
    let config = &ctx.accounts.config;
    require!(!config.paused, UnknownError::Paused);
    require!(
        name.len() <= MAX_NAME_LEN && symbol.len() <= MAX_SYMBOL_LEN && uri.len() <= MAX_URI_LEN,
        UnknownError::MetadataTooLong
    );
    require!(
        dev_buy_lamports >= config.min_dev_buy && dev_buy_lamports <= config.max_dev_buy,
        UnknownError::DevBuyOutOfRange
    );

    let mint_key = ctx.accounts.mint.key();
    let launch_bump = ctx.bumps.launch;
    let launch_seeds: &[&[u8]] = &[SEED_LAUNCH, mint_key.as_ref(), &[launch_bump]];
    let signer = &[launch_seeds];
    let token_program = ctx.accounts.token_program.to_account_info();
    let mint_ai = ctx.accounts.mint.to_account_info();
    let launch_ai = ctx.accounts.launch.to_account_info();

    // Metadata lives in the mint itself (Token-2022). Top up rent for the realloc first.
    let metadata = TokenMetadata {
        update_authority: OptionalNonZeroPubkey::try_from(Some(launch_ai.key()))?,
        mint: mint_key,
        name: name.clone(),
        symbol: symbol.clone(),
        uri: uri.clone(),
        additional_metadata: vec![],
    };
    let extra = metadata.tlv_size_of().map_err(|_| UnknownError::MathOverflow)?;
    let new_len = mint_ai.data_len() + extra;
    let needed = Rent::get()?.minimum_balance(new_len).saturating_sub(mint_ai.lamports());
    pay(&ctx.accounts.system_program.to_account_info(), &ctx.accounts.creator.to_account_info(), &mint_ai, needed)?;

    token_metadata_initialize(
        CpiContext::new_with_signer(
            token_program.clone(),
            TokenMetadataInitialize {
                program_id: token_program.clone(),
                metadata: mint_ai.clone(),
                update_authority: launch_ai.clone(),
                mint_authority: launch_ai.clone(),
                mint: mint_ai.clone(),
            },
            signer,
        ),
        name.clone(),
        symbol.clone(),
        uri.clone(),
    )?;

    let total_supply = config.curve_supply.checked_add(config.lp_supply).ok_or(UnknownError::MathOverflow)?;
    token_2022::mint_to(
        CpiContext::new_with_signer(
            token_program.clone(),
            MintTo {
                mint: mint_ai.clone(),
                to: ctx.accounts.curve_token_account.to_account_info(),
                authority: launch_ai.clone(),
            },
            signer,
        ),
        total_supply,
    )?;

    // Burn the keys: no more minting, no metadata edits, no pointer swaps.
    token_2022::set_authority(
        CpiContext::new_with_signer(
            token_program.clone(),
            SetAuthority { current_authority: launch_ai.clone(), account_or_mint: mint_ai.clone() },
            signer,
        ),
        AuthorityType::MintTokens,
        None,
    )?;
    token_metadata_update_authority(
        CpiContext::new_with_signer(
            token_program.clone(),
            TokenMetadataUpdateAuthority {
                program_id: token_program.clone(),
                metadata: mint_ai.clone(),
                current_authority: launch_ai.clone(),
                new_authority: launch_ai.clone(),
            },
            signer,
        ),
        OptionalNonZeroPubkey::default(),
    )?;
    token_2022::set_authority(
        CpiContext::new_with_signer(
            token_program.clone(),
            SetAuthority { current_authority: launch_ai.clone(), account_or_mint: mint_ai.clone() },
            signer,
        ),
        AuthorityType::MetadataPointer,
        None,
    )?;

    // Escrow the dev buy (plus the vault's rent reserve); it executes at
    // settle, after the dice land.
    let reserve = Rent::get()?.minimum_balance(0);
    pay(
        &ctx.accounts.system_program.to_account_info(),
        &ctx.accounts.creator.to_account_info(),
        &ctx.accounts.sol_vault.to_account_info(),
        dev_buy_lamports.checked_add(reserve).ok_or(UnknownError::MathOverflow)?,
    )?;

    let seed = dice_seed(&mint_key);
    vrf::request(
        vrf::VrfAccounts {
            payer: &ctx.accounts.creator.to_account_info(),
            vrf_program: &ctx.accounts.vrf_program.to_account_info(),
            network_state: &ctx.accounts.vrf_network_state.to_account_info(),
            treasury: &ctx.accounts.vrf_treasury.to_account_info(),
            randomness: &ctx.accounts.randomness.to_account_info(),
            system_program: &ctx.accounts.system_program.to_account_info(),
        },
        seed,
    )?;

    let now = Clock::get()?.unix_timestamp;
    let launch = &mut ctx.accounts.launch;
    launch.mint = mint_key;
    launch.creator = ctx.accounts.creator.key();
    launch.state = LaunchState::Rolling;
    launch.created_at = now;
    launch.virtual_sol = config.initial_virtual_sol;
    launch.virtual_tokens = config.initial_virtual_tokens;
    launch.real_sol = 0;
    launch.real_tokens = config.curve_supply;
    launch.lp_tokens = config.lp_supply;
    launch.dev_buy_escrow = dev_buy_lamports;
    launch.vrf_seed = seed;
    launch.vrf_pending = true;
    launch.vrf_requested_at = now;
    launch.protocol_fee_bps = config.protocol_fee_bps;
    launch.creator_fee_bps = config.creator_fee_bps;
    launch.fog_tick_secs = config.fog_tick_secs;
    launch.fog_max_ticks = config.fog_max_ticks;
    launch.vrf_timeout_secs = config.vrf_timeout_secs;
    launch.bump = launch_bump;
    launch.sol_vault_bump = ctx.bumps.sol_vault;

    let vault = &mut ctx.accounts.dev_vault;
    vault.launch = launch.key();
    vault.creator = launch.creator;
    vault.coef_bps = BPS as u16;
    vault.bump = ctx.bumps.dev_vault;

    let pool = &mut ctx.accounts.holder_pool;
    pool.launch = launch.key();
    pool.bump = ctx.bumps.holder_pool;

    emit!(LaunchCreated {
        mint: mint_key,
        creator: launch.creator,
        name,
        symbol,
        uri,
        dev_buy_lamports,
        vrf_seed: seed,
        timestamp: now,
    });
    Ok(())
}
