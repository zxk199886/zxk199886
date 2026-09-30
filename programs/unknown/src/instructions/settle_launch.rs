use anchor_lang::prelude::*;
use anchor_spl::token_2022::Token2022;
use anchor_spl::token_interface::{self, Mint, TokenAccount, TransferChecked};

use crate::constants::*;
use crate::errors::UnknownError;
use crate::events::{DiceRolled, Trade};
use crate::math::{self, Curve};
use crate::state::*;
use crate::util::pay_from_vault;
use crate::vrf;

/// Permissionless: once the VRF answers, anyone lands the dice. The dev can
/// not decline a bad roll — refunds require the VRF to have never answered.
#[derive(Accounts)]
pub struct SettleLaunch<'info> {
    pub cranker: Signer<'info>,

    #[account(seeds = [SEED_CONFIG], bump = config.bump)]
    pub config: Box<Account<'info, Config>>,

    /// CHECK: address pinned to config.
    #[account(mut, address = config.fee_recipient)]
    pub fee_recipient: UncheckedAccount<'info>,

    /// CHECK: receives any unspent escrow; address pinned to the launch.
    #[account(mut, address = launch.creator)]
    pub creator: UncheckedAccount<'info>,

    #[account(mut, seeds = [SEED_LAUNCH, mint.key().as_ref()], bump = launch.bump, has_one = mint)]
    pub launch: Box<Account<'info, Launch>>,

    #[account(mint::token_program = token_program)]
    pub mint: Box<InterfaceAccount<'info, Mint>>,

    #[account(mut, seeds = [SEED_SOL_VAULT, mint.key().as_ref()], bump = launch.sol_vault_bump)]
    pub sol_vault: SystemAccount<'info>,

    #[account(mut, seeds = [SEED_VAULT, mint.key().as_ref()], bump = dev_vault.bump)]
    pub dev_vault: Box<Account<'info, DevVault>>,

    #[account(mut, seeds = [SEED_POOL, mint.key().as_ref()], bump = holder_pool.bump)]
    pub holder_pool: Box<Account<'info, HolderPool>>,

    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = launch,
        associated_token::token_program = token_program,
    )]
    pub curve_token_account: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = dev_vault,
        associated_token::token_program = token_program,
    )]
    pub vault_token_account: Box<InterfaceAccount<'info, TokenAccount>>,

    /// CHECK: validated against launch.vrf_seed in `vrf::read`.
    pub randomness: UncheckedAccount<'info>,

    pub token_program: Program<'info, Token2022>,
    pub system_program: Program<'info, System>,
}

pub fn settle_launch(ctx: Context<SettleLaunch>) -> Result<()> {
    let launch = &mut ctx.accounts.launch;
    require!(launch.state == LaunchState::Rolling && launch.vrf_pending, UnknownError::InvalidState);
    let randomness = vrf::read(&ctx.accounts.randomness, &launch.vrf_seed)?
        .ok_or(UnknownError::RandomnessNotReady)?;

    let (d1, d2) = math::roll_dice(&randomness);
    let liquid_bps = math::liquid_bps_for(d1, d2);
    let fee_bps = launch.total_fee_bps();

    // Dev buy at the opening price: nobody else can trade yet.
    let escrow = launch.dev_buy_escrow;
    let fee = math::fee_on(escrow, fee_bps).ok_or(UnknownError::MathOverflow)?;
    let mut curve = Curve {
        virtual_sol: launch.virtual_sol,
        virtual_tokens: launch.virtual_tokens,
        real_sol: launch.real_sol,
        real_tokens: launch.real_tokens,
    };
    let quote = curve.quote_buy(escrow - fee).ok_or(UnknownError::MathOverflow)?;
    let gross = if quote.sol_in < escrow - fee {
        math::gross_for_net(quote.sol_in, fee_bps).ok_or(UnknownError::MathOverflow)?
    } else {
        escrow
    };
    let fee = gross - quote.sol_in;
    let refund = escrow - gross;
    curve.apply_buy(quote).ok_or(UnknownError::MathOverflow)?;

    let vault = &mut ctx.accounts.dev_vault;
    let split = math::split_fee(fee, launch.protocol_fee_bps, launch.creator_fee_bps, vault.coef_bps);
    let launch_ai = launch.to_account_info();
    let mint_key = ctx.accounts.mint.key();
    let sys = ctx.accounts.system_program.to_account_info();
    let sol_vault = ctx.accounts.sol_vault.to_account_info();
    let vault_seeds: &[&[u8]] = &[SEED_SOL_VAULT, mint_key.as_ref(), &[launch.sol_vault_bump]];
    pay_from_vault(&sys, &sol_vault, &ctx.accounts.fee_recipient.to_account_info(), split.protocol, vault_seeds)?;
    pay_from_vault(&sys, &sol_vault, &vault.to_account_info(), split.dev, vault_seeds)?;
    pay_from_vault(&sys, &sol_vault, &ctx.accounts.holder_pool.to_account_info(), split.holders, vault_seeds)?;
    pay_from_vault(&sys, &sol_vault, &ctx.accounts.creator.to_account_info(), refund, vault_seeds)?;

    let seeds: &[&[u8]] = &[SEED_LAUNCH, mint_key.as_ref(), &[launch.bump]];
    token_interface::transfer_checked(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            TransferChecked {
                from: ctx.accounts.curve_token_account.to_account_info(),
                mint: ctx.accounts.mint.to_account_info(),
                to: ctx.accounts.vault_token_account.to_account_info(),
                authority: launch_ai.clone(),
            },
            &[seeds],
        ),
        quote.tokens_out,
        TOKEN_DECIMALS,
    )?;

    let (liquid, vesting) = math::split_dev_tokens(quote.tokens_out, liquid_bps);
    vault.liquid_total = liquid;
    vault.vest_total = vesting;
    vault.staked = quote.tokens_out;
    vault.peak = quote.tokens_out;
    vault.fee_claimable += split.dev;
    ctx.accounts.holder_pool.total_received += split.holders;

    let now = Clock::get()?.unix_timestamp;
    launch.virtual_sol = curve.virtual_sol;
    launch.virtual_tokens = curve.virtual_tokens;
    launch.real_sol = curve.real_sol;
    launch.real_tokens = curve.real_tokens;
    launch.volume_sol += quote.sol_in;
    launch.dev_buy_escrow = 0;
    launch.d1 = d1;
    launch.d2 = d2;
    launch.liquid_bps = liquid_bps;
    launch.vrf_pending = false;
    launch.state = LaunchState::Fogged;
    launch.fog_tick = 0;
    launch.next_tick_at = now + launch.fog_tick_secs;
    launch.fog_deadline = now + launch.fog_tick_secs * launch.fog_max_ticks as i64 + launch.vrf_timeout_secs;

    emit!(DiceRolled {
        mint: mint_key,
        d1,
        d2,
        liquid_bps,
        dev_tokens: quote.tokens_out,
        liquid_tokens: liquid,
        vesting_tokens: vesting,
        sol_spent: quote.sol_in,
        timestamp: now,
    });
    emit!(Trade {
        mint: mint_key,
        trader: launch.creator,
        is_buy: true,
        sol_amount: quote.sol_in,
        token_amount: quote.tokens_out,
        protocol_fee: split.protocol,
        dev_fee: split.dev,
        holder_fee: split.holders,
        virtual_sol: launch.virtual_sol,
        virtual_tokens: launch.virtual_tokens,
        real_sol: launch.real_sol,
        real_tokens: launch.real_tokens,
        timestamp: now,
    });
    Ok(())
}
