use anchor_lang::prelude::*;

use crate::constants::*;
use crate::errors::UnknownError;
use crate::events::{FogRequested, FogResolved};
use crate::math;
use crate::state::*;
use crate::vrf;

/// The opening moment is never stored on-chain ahead of time. Each tick draws
/// fresh VRF output and opens with probability 1/(ticks left), so nobody —
/// dev, platform or bot — knows when the market opens until it does.
#[derive(Accounts)]
pub struct FogRequest<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    #[account(mut, seeds = [SEED_LAUNCH, launch.mint.as_ref()], bump = launch.bump)]
    pub launch: Box<Account<'info, Launch>>,

    /// CHECK: ORAO VRF program (ignored in mock-vrf builds).
    pub vrf_program: UncheckedAccount<'info>,
    /// CHECK: validated by the VRF program.
    #[account(mut)]
    pub vrf_network_state: UncheckedAccount<'info>,
    /// CHECK: validated by the VRF program.
    #[account(mut)]
    pub vrf_treasury: UncheckedAccount<'info>,
    /// CHECK: address checked against the tick seed.
    #[account(mut)]
    pub randomness: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

pub fn fog_request(ctx: Context<FogRequest>) -> Result<()> {
    let launch = &mut ctx.accounts.launch;
    require!(launch.state == LaunchState::Fogged, UnknownError::InvalidState);
    require!(!launch.vrf_pending, UnknownError::RequestAlreadyPending);
    let now = Clock::get()?.unix_timestamp;
    require!(now >= launch.next_tick_at, UnknownError::TooEarly);

    let seed = math::fog_seed(&launch.mint.to_bytes(), launch.fog_tick);
    vrf::request(
        vrf::VrfAccounts {
            payer: &ctx.accounts.payer.to_account_info(),
            vrf_program: &ctx.accounts.vrf_program.to_account_info(),
            network_state: &ctx.accounts.vrf_network_state.to_account_info(),
            treasury: &ctx.accounts.vrf_treasury.to_account_info(),
            randomness: &ctx.accounts.randomness.to_account_info(),
            system_program: &ctx.accounts.system_program.to_account_info(),
        },
        seed,
    )?;
    launch.vrf_seed = seed;
    launch.vrf_pending = true;
    launch.vrf_requested_at = now;

    emit!(FogRequested { mint: launch.mint, tick: launch.fog_tick, vrf_seed: seed, timestamp: now });
    Ok(())
}

#[derive(Accounts)]
pub struct FogResolve<'info> {
    #[account(mut, seeds = [SEED_LAUNCH, launch.mint.as_ref()], bump = launch.bump)]
    pub launch: Box<Account<'info, Launch>>,

    #[account(mut, seeds = [SEED_VAULT, launch.mint.as_ref()], bump = dev_vault.bump)]
    pub dev_vault: Box<Account<'info, DevVault>>,

    /// CHECK: validated against launch.vrf_seed when a request is pending.
    pub randomness: UncheckedAccount<'info>,
}

pub fn fog_resolve(ctx: Context<FogResolve>) -> Result<()> {
    let launch = &mut ctx.accounts.launch;
    require!(launch.state == LaunchState::Fogged, UnknownError::InvalidState);
    let now = Clock::get()?.unix_timestamp;

    let (opened, forced) = if launch.vrf_pending {
        match vrf::read(&ctx.accounts.randomness, &launch.vrf_seed)? {
            Some(r) => (math::fog_opens(&r, launch.fog_tick, launch.fog_max_ticks), false),
            // Oracle stalled: fail open rather than trap the market.
            None => {
                require!(now >= launch.vrf_requested_at + launch.vrf_timeout_secs, UnknownError::RandomnessNotReady);
                (true, true)
            }
        }
    } else {
        // Nobody cranked the ticks: past the deadline anyone may lift the fog.
        require!(now >= launch.fog_deadline, UnknownError::NoPendingRequest);
        (true, true)
    };

    let tick = launch.fog_tick;
    launch.vrf_pending = false;
    if opened {
        launch.state = LaunchState::Trading;
        launch.opened_at = now;
        ctx.accounts.dev_vault.vest_start = now;
    } else {
        launch.fog_tick = tick + 1;
        launch.next_tick_at = now + launch.fog_tick_secs;
    }

    emit!(FogResolved { mint: launch.mint, tick, opened, forced, next_tick_at: launch.next_tick_at, timestamp: now });
    Ok(())
}
