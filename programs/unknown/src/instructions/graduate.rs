use anchor_lang::prelude::*;
use solana_sha256_hasher::hash;
use anchor_lang::solana_program::instruction::{AccountMeta, Instruction};
use anchor_lang::solana_program::program::invoke_signed;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::spl_token::native_mint;
use anchor_spl::token::{self, Burn, SyncNative, Token};
use anchor_spl::token_2022::Token2022;
use anchor_spl::token_interface::{self, Mint, TokenAccount, TransferChecked};

use crate::constants::*;
use crate::errors::UnknownError;
use crate::events::Graduated;
use crate::state::*;
use crate::util::pay_from_vault;

/// Permissionless. Moves the curve's SOL and the reserved LP tokens into a
/// Raydium CPMM pool, then burns every LP token received.
///
/// The pool is created by the launch's `sol_vault` PDA: data-less and
/// system-owned, so it can pay for the pool's accounts inside the CPI.
#[derive(Accounts)]
pub struct Graduate<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    #[account(seeds = [SEED_CONFIG], bump = config.bump)]
    pub config: Box<Account<'info, Config>>,

    /// CHECK: address pinned to config.
    #[account(mut, address = config.fee_recipient)]
    pub fee_recipient: UncheckedAccount<'info>,

    #[account(mut, seeds = [SEED_LAUNCH, mint.key().as_ref()], bump = launch.bump, has_one = mint)]
    pub launch: Box<Account<'info, Launch>>,

    #[account(mut, mint::token_program = token_2022_program)]
    pub mint: Box<InterfaceAccount<'info, Mint>>,

    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = launch,
        associated_token::token_program = token_2022_program,
    )]
    pub curve_token_account: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(mut, seeds = [SEED_SOL_VAULT, mint.key().as_ref()], bump = launch.sol_vault_bump)]
    pub sol_vault: SystemAccount<'info>,

    #[account(
        init_if_needed,
        payer = payer,
        associated_token::mint = mint,
        associated_token::authority = sol_vault,
        associated_token::token_program = token_2022_program,
    )]
    pub vault_token_account: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(address = native_mint::ID)]
    pub wsol_mint: Box<InterfaceAccount<'info, Mint>>,

    #[account(
        init_if_needed,
        payer = payer,
        associated_token::mint = wsol_mint,
        associated_token::authority = sol_vault,
        associated_token::token_program = token_program,
    )]
    pub vault_wsol_account: Box<InterfaceAccount<'info, TokenAccount>>,

    /// CHECK: pinned to config; everything below is validated by it.
    #[account(address = config.cpmm_program @ UnknownError::WrongDexProgram)]
    pub cpmm_program: UncheckedAccount<'info>,
    /// CHECK: validated by CPMM.
    pub amm_config: UncheckedAccount<'info>,
    /// CHECK: validated by CPMM.
    pub cpmm_authority: UncheckedAccount<'info>,
    /// CHECK: validated by CPMM.
    #[account(mut)]
    pub pool_state: UncheckedAccount<'info>,
    /// CHECK: validated by CPMM.
    #[account(mut)]
    pub lp_mint: UncheckedAccount<'info>,
    /// CHECK: created by CPMM as the sol_vault's LP ATA; checked before burning.
    #[account(mut)]
    pub vault_lp_account: UncheckedAccount<'info>,
    /// CHECK: validated by CPMM.
    #[account(mut)]
    pub token_0_vault: UncheckedAccount<'info>,
    /// CHECK: validated by CPMM.
    #[account(mut)]
    pub token_1_vault: UncheckedAccount<'info>,
    /// CHECK: validated by CPMM.
    #[account(mut)]
    pub create_pool_fee: UncheckedAccount<'info>,
    /// CHECK: validated by CPMM.
    #[account(mut)]
    pub observation_state: UncheckedAccount<'info>,

    pub token_program: Program<'info, Token>,
    pub token_2022_program: Program<'info, Token2022>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

fn cpmm_initialize_data(amount_0: u64, amount_1: u64, open_time: u64) -> Vec<u8> {
    let mut data = hash(b"global:initialize").to_bytes()[..8].to_vec();
    data.extend_from_slice(&amount_0.to_le_bytes());
    data.extend_from_slice(&amount_1.to_le_bytes());
    data.extend_from_slice(&open_time.to_le_bytes());
    data
}

pub fn graduate(ctx: Context<Graduate>) -> Result<()> {
    let a = &ctx.accounts;
    require!(a.launch.state == LaunchState::Complete, UnknownError::InvalidState);

    let mint_key = a.mint.key();
    let launch_ai = a.launch.to_account_info();
    let vault_ai = a.sol_vault.to_account_info();
    let sys = a.system_program.to_account_info();
    let vault_seeds: &[&[u8]] = &[SEED_SOL_VAULT, mint_key.as_ref(), &[a.launch.sol_vault_bump]];

    // SOL: protocol fee, pool-creation budget (stays in sol_vault to pay the
    // DEX), the rest into the pool as WSOL.
    let real_sol = a.launch.real_sol;
    let fee = a.config.migration_fee;
    let budget = a.config.migration_budget;
    let pool_sol = real_sol
        .checked_sub(fee)
        .and_then(|x| x.checked_sub(budget))
        .filter(|x| *x > 0)
        .ok_or(UnknownError::InsufficientCurveSol)?;
    pay_from_vault(&sys, &vault_ai, &a.fee_recipient.to_account_info(), fee, vault_seeds)?;
    pay_from_vault(&sys, &vault_ai, &a.vault_wsol_account.to_account_info(), pool_sol, vault_seeds)?;
    token::sync_native(CpiContext::new(
        a.token_program.to_account_info(),
        SyncNative { account: a.vault_wsol_account.to_account_info() },
    ))?;

    // Tokens: the reserve that was never on the curve.
    let lp_tokens = a.launch.lp_tokens;
    let launch_seeds: &[&[u8]] = &[SEED_LAUNCH, mint_key.as_ref(), &[a.launch.bump]];
    token_interface::transfer_checked(
        CpiContext::new_with_signer(
            a.token_2022_program.to_account_info(),
            TransferChecked {
                from: a.curve_token_account.to_account_info(),
                mint: a.mint.to_account_info(),
                to: a.vault_token_account.to_account_info(),
                authority: launch_ai.clone(),
            },
            &[launch_seeds],
        ),
        lp_tokens,
        TOKEN_DECIMALS,
    )?;

    // CPMM requires token_0 < token_1.
    let token_is_0 = mint_key < native_mint::ID;
    let (m0, m1, acc0, acc1, prog0, prog1, amt0, amt1) = if token_is_0 {
        (
            a.mint.to_account_info(),
            a.wsol_mint.to_account_info(),
            a.vault_token_account.to_account_info(),
            a.vault_wsol_account.to_account_info(),
            a.token_2022_program.to_account_info(),
            a.token_program.to_account_info(),
            lp_tokens,
            pool_sol,
        )
    } else {
        (
            a.wsol_mint.to_account_info(),
            a.mint.to_account_info(),
            a.vault_wsol_account.to_account_info(),
            a.vault_token_account.to_account_info(),
            a.token_program.to_account_info(),
            a.token_2022_program.to_account_info(),
            pool_sol,
            lp_tokens,
        )
    };

    let accounts = vec![
        AccountMeta::new(vault_ai.key(), true),
        AccountMeta::new_readonly(a.amm_config.key(), false),
        AccountMeta::new_readonly(a.cpmm_authority.key(), false),
        AccountMeta::new(a.pool_state.key(), false),
        AccountMeta::new_readonly(m0.key(), false),
        AccountMeta::new_readonly(m1.key(), false),
        AccountMeta::new(a.lp_mint.key(), false),
        AccountMeta::new(acc0.key(), false),
        AccountMeta::new(acc1.key(), false),
        AccountMeta::new(a.vault_lp_account.key(), false),
        AccountMeta::new(a.token_0_vault.key(), false),
        AccountMeta::new(a.token_1_vault.key(), false),
        AccountMeta::new(a.create_pool_fee.key(), false),
        AccountMeta::new(a.observation_state.key(), false),
        AccountMeta::new_readonly(a.token_program.key(), false),
        AccountMeta::new_readonly(prog0.key(), false),
        AccountMeta::new_readonly(prog1.key(), false),
        AccountMeta::new_readonly(a.associated_token_program.key(), false),
        AccountMeta::new_readonly(a.system_program.key(), false),
        AccountMeta::new_readonly(a.rent.key(), false),
    ];
    let ix = Instruction {
        program_id: a.cpmm_program.key(),
        accounts,
        data: cpmm_initialize_data(amt0, amt1, 0),
    };
    invoke_signed(
        &ix,
        &[
            vault_ai.clone(),
            a.amm_config.to_account_info(),
            a.cpmm_authority.to_account_info(),
            a.pool_state.to_account_info(),
            m0,
            m1,
            a.lp_mint.to_account_info(),
            acc0,
            acc1,
            a.vault_lp_account.to_account_info(),
            a.token_0_vault.to_account_info(),
            a.token_1_vault.to_account_info(),
            a.create_pool_fee.to_account_info(),
            a.observation_state.to_account_info(),
            a.token_program.to_account_info(),
            prog0,
            prog1,
            a.associated_token_program.to_account_info(),
            a.system_program.to_account_info(),
            a.rent.to_account_info(),
            a.cpmm_program.to_account_info(),
        ],
        &[vault_seeds],
    )?;

    // Burn every LP token: liquidity can never be pulled.
    let lp_amount = {
        let lp_ai = a.vault_lp_account.to_account_info();
        require_keys_eq!(*lp_ai.owner, token::ID, UnknownError::InvalidState);
        let lp = token::TokenAccount::try_deserialize(&mut &lp_ai.data.borrow()[..])?;
        require_keys_eq!(lp.owner, vault_ai.key(), UnknownError::InvalidState);
        require_keys_eq!(lp.mint, a.lp_mint.key(), UnknownError::InvalidState);
        lp.amount
    };
    token::burn(
        CpiContext::new_with_signer(
            a.token_program.to_account_info(),
            Burn {
                mint: a.lp_mint.to_account_info(),
                from: a.vault_lp_account.to_account_info(),
                authority: vault_ai.clone(),
            },
            &[vault_seeds],
        ),
        lp_amount,
    )?;

    // Sweep what pool creation did not spend (and the rent reserve).
    pay_from_vault(&sys, &vault_ai, &a.fee_recipient.to_account_info(), vault_ai.lamports(), vault_seeds)?;

    let now = Clock::get()?.unix_timestamp;
    let pool_key = a.pool_state.key();
    let launch = &mut ctx.accounts.launch;
    launch.real_sol = 0;
    launch.lp_tokens = 0;
    launch.state = LaunchState::Graduated;
    launch.graduated_at = now;
    launch.pool = pool_key;

    emit!(Graduated {
        mint: mint_key,
        pool: pool_key,
        sol_liquidity: pool_sol,
        token_liquidity: lp_tokens,
        lp_burned: lp_amount,
        timestamp: now,
    });
    Ok(())
}
