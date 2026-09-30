use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token_2022::Token2022;
use anchor_spl::token_interface::{self, Mint, TokenAccount, TransferChecked};

use crate::constants::*;
use crate::errors::UnknownError;
use crate::events::{CurveComplete, Trade as TradeEvent};
use crate::math::{self, Curve, FeeSplit};
use crate::state::*;
use crate::util::{pay, pay_from_vault};

#[derive(Accounts)]
pub struct Trade<'info> {
    #[account(mut)]
    pub trader: Signer<'info>,

    #[account(seeds = [SEED_CONFIG], bump = config.bump)]
    pub config: Box<Account<'info, Config>>,

    /// CHECK: address pinned to config.
    #[account(mut, address = config.fee_recipient)]
    pub fee_recipient: UncheckedAccount<'info>,

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
        init_if_needed,
        payer = trader,
        associated_token::mint = mint,
        associated_token::authority = trader,
        associated_token::token_program = token_program,
    )]
    pub trader_token_account: Box<InterfaceAccount<'info, TokenAccount>>,

    pub token_program: Program<'info, Token2022>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

impl<'info> Trade<'info> {
    fn curve(&self) -> Curve {
        Curve {
            virtual_sol: self.launch.virtual_sol,
            virtual_tokens: self.launch.virtual_tokens,
            real_sol: self.launch.real_sol,
            real_tokens: self.launch.real_tokens,
        }
    }

    fn commit(&mut self, curve: Curve, volume: u64, split: FeeSplit) -> Result<()> {
        let launch = &mut self.launch;
        launch.virtual_sol = curve.virtual_sol;
        launch.virtual_tokens = curve.virtual_tokens;
        launch.real_sol = curve.real_sol;
        launch.real_tokens = curve.real_tokens;
        launch.volume_sol = launch.volume_sol.saturating_add(volume);
        let vault = &mut self.dev_vault;
        vault.fee_claimable = vault.fee_claimable.checked_add(split.dev).ok_or(UnknownError::MathOverflow)?;
        vault.fee_forfeited = vault.fee_forfeited.checked_add(split.holders).ok_or(UnknownError::MathOverflow)?;
        let pool = &mut self.holder_pool;
        pool.total_received = pool.total_received.checked_add(split.holders).ok_or(UnknownError::MathOverflow)?;
        Ok(())
    }

    fn emit(&self, is_buy: bool, sol_amount: u64, token_amount: u64, split: FeeSplit, now: i64) {
        let l = &self.launch;
        emit!(TradeEvent {
            mint: l.mint,
            trader: self.trader.key(),
            is_buy,
            sol_amount,
            token_amount,
            protocol_fee: split.protocol,
            dev_fee: split.dev,
            holder_fee: split.holders,
            virtual_sol: l.virtual_sol,
            virtual_tokens: l.virtual_tokens,
            real_sol: l.real_sol,
            real_tokens: l.real_tokens,
            timestamp: now,
        });
    }
}

/// Buy with up to `sol_amount` lamports (fees included). If the curve sells
/// out first, only the cost of the remaining tokens is charged.
pub fn buy(ctx: Context<Trade>, sol_amount: u64, min_tokens_out: u64) -> Result<()> {
    require!(sol_amount > 0, UnknownError::ZeroAmount);
    require!(ctx.accounts.launch.state == LaunchState::Trading, UnknownError::InvalidState);
    let fee_bps = ctx.accounts.launch.total_fee_bps();

    let mut curve = ctx.accounts.curve();
    let fee = math::fee_on(sol_amount, fee_bps).ok_or(UnknownError::MathOverflow)?;
    let net = sol_amount - fee;
    let quote = curve.quote_buy(net).ok_or(UnknownError::MathOverflow)?;
    require!(quote.tokens_out > 0, UnknownError::ZeroAmount);
    require!(quote.tokens_out >= min_tokens_out, UnknownError::SlippageExceeded);
    let gross = if quote.sol_in < net {
        math::gross_for_net(quote.sol_in, fee_bps).ok_or(UnknownError::MathOverflow)?.min(sol_amount)
    } else {
        sol_amount
    };
    let fee = gross - quote.sol_in;
    curve.apply_buy(quote).ok_or(UnknownError::MathOverflow)?;

    let a = &ctx.accounts;
    let split = math::split_fee(fee, a.launch.protocol_fee_bps, a.launch.creator_fee_bps, a.dev_vault.coef_bps);
    let sys = a.system_program.to_account_info();
    let trader = a.trader.to_account_info();
    pay(&sys, &trader, &a.sol_vault.to_account_info(), quote.sol_in)?;
    pay(&sys, &trader, &a.fee_recipient.to_account_info(), split.protocol)?;
    pay(&sys, &trader, &a.dev_vault.to_account_info(), split.dev)?;
    pay(&sys, &trader, &a.holder_pool.to_account_info(), split.holders)?;

    let mint_key = a.mint.key();
    let seeds: &[&[u8]] = &[SEED_LAUNCH, mint_key.as_ref(), &[a.launch.bump]];
    token_interface::transfer_checked(
        CpiContext::new_with_signer(
            a.token_program.to_account_info(),
            TransferChecked {
                from: a.curve_token_account.to_account_info(),
                mint: a.mint.to_account_info(),
                to: a.trader_token_account.to_account_info(),
                authority: a.launch.to_account_info(),
            },
            &[seeds],
        ),
        quote.tokens_out,
        TOKEN_DECIMALS,
    )?;

    let now = Clock::get()?.unix_timestamp;
    ctx.accounts.commit(curve, quote.sol_in, split)?;
    ctx.accounts.emit(true, quote.sol_in, quote.tokens_out, split, now);

    if curve.real_tokens == 0 {
        let launch = &mut ctx.accounts.launch;
        launch.state = LaunchState::Complete;
        launch.completed_at = now;
        emit!(CurveComplete { mint: launch.mint, real_sol: launch.real_sol, timestamp: now });
    }
    Ok(())
}

pub fn sell(ctx: Context<Trade>, token_amount: u64, min_sol_out: u64) -> Result<()> {
    require!(token_amount > 0, UnknownError::ZeroAmount);
    require!(ctx.accounts.launch.state == LaunchState::Trading, UnknownError::InvalidState);
    let fee_bps = ctx.accounts.launch.total_fee_bps();

    let mut curve = ctx.accounts.curve();
    let gross = curve.quote_sell(token_amount).ok_or(UnknownError::InsufficientCurveSol)?;
    let fee = math::fee_on(gross, fee_bps).ok_or(UnknownError::MathOverflow)?;
    let net = gross.checked_sub(fee).ok_or(UnknownError::MathOverflow)?;
    require!(net > 0, UnknownError::ZeroAmount);
    require!(net >= min_sol_out, UnknownError::SlippageExceeded);
    curve.apply_sell(token_amount, gross).ok_or(UnknownError::MathOverflow)?;

    let a = &ctx.accounts;
    token_interface::transfer_checked(
        CpiContext::new(
            a.token_program.to_account_info(),
            TransferChecked {
                from: a.trader_token_account.to_account_info(),
                mint: a.mint.to_account_info(),
                to: a.curve_token_account.to_account_info(),
                authority: a.trader.to_account_info(),
            },
        ),
        token_amount,
        TOKEN_DECIMALS,
    )?;

    let split = math::split_fee(fee, a.launch.protocol_fee_bps, a.launch.creator_fee_bps, a.dev_vault.coef_bps);
    let sys = a.system_program.to_account_info();
    let sol_vault = a.sol_vault.to_account_info();
    let mint_key = a.mint.key();
    let seeds: &[&[u8]] = &[SEED_SOL_VAULT, mint_key.as_ref(), &[a.launch.sol_vault_bump]];
    pay_from_vault(&sys, &sol_vault, &a.trader.to_account_info(), net, seeds)?;
    pay_from_vault(&sys, &sol_vault, &a.fee_recipient.to_account_info(), split.protocol, seeds)?;
    pay_from_vault(&sys, &sol_vault, &a.dev_vault.to_account_info(), split.dev, seeds)?;
    pay_from_vault(&sys, &sol_vault, &a.holder_pool.to_account_info(), split.holders, seeds)?;

    let now = Clock::get()?.unix_timestamp;
    ctx.accounts.commit(curve, gross, split)?;
    ctx.accounts.emit(false, gross, token_amount, split, now);
    Ok(())
}
