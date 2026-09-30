use anchor_lang::prelude::*;

use crate::constants::*;
use crate::errors::UnknownError;
use crate::events::LaunchRefunded;
use crate::state::*;
use crate::util::pay_from_vault;
use crate::vrf;

/// Only possible when the oracle never answered. If the dice were rolled,
/// they must be landed via `settle_launch` — no re-rolls by walking away.
#[derive(Accounts)]
pub struct RefundLaunch<'info> {
    /// CHECK: receives the escrow; address pinned to the launch.
    #[account(mut, address = launch.creator)]
    pub creator: UncheckedAccount<'info>,

    #[account(mut, seeds = [SEED_LAUNCH, launch.mint.as_ref()], bump = launch.bump)]
    pub launch: Box<Account<'info, Launch>>,

    #[account(mut, seeds = [SEED_SOL_VAULT, launch.mint.as_ref()], bump = launch.sol_vault_bump)]
    pub sol_vault: SystemAccount<'info>,

    /// CHECK: validated against launch.vrf_seed in `vrf::read`.
    pub randomness: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

pub fn refund_launch(ctx: Context<RefundLaunch>) -> Result<()> {
    let launch = &mut ctx.accounts.launch;
    require!(launch.state == LaunchState::Rolling, UnknownError::InvalidState);
    let now = Clock::get()?.unix_timestamp;
    require!(now >= launch.vrf_requested_at + launch.vrf_timeout_secs, UnknownError::NotTimedOut);
    require!(vrf::read(&ctx.accounts.randomness, &launch.vrf_seed)?.is_none(), UnknownError::InvalidState);

    let amount = launch.dev_buy_escrow;
    launch.dev_buy_escrow = 0;
    launch.vrf_pending = false;
    launch.state = LaunchState::Cancelled;
    let seeds: &[&[u8]] = &[SEED_SOL_VAULT, launch.mint.as_ref(), &[launch.sol_vault_bump]];
    pay_from_vault(
        &ctx.accounts.system_program.to_account_info(),
        &ctx.accounts.sol_vault.to_account_info(),
        &ctx.accounts.creator.to_account_info(),
        amount,
        seeds,
    )?;

    emit!(LaunchRefunded { mint: launch.mint, amount, timestamp: now });
    Ok(())
}
