use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct Config {
    pub admin: Pubkey,
    pub fee_recipient: Pubkey,
    /// Posts holder-reward merkle roots (the indexer's key).
    pub merkle_authority: Pubkey,
    /// Raydium CPMM program the curve graduates into.
    pub cpmm_program: Pubkey,
    pub protocol_fee_bps: u16,
    pub creator_fee_bps: u16,
    pub initial_virtual_sol: u64,
    pub initial_virtual_tokens: u64,
    /// Tokens sold on the curve; the curve completes when they are gone.
    pub curve_supply: u64,
    /// Tokens reserved for the DEX pool at graduation.
    pub lp_supply: u64,
    pub min_dev_buy: u64,
    pub max_dev_buy: u64,
    pub fog_tick_secs: i64,
    pub fog_max_ticks: u8,
    pub vrf_timeout_secs: i64,
    /// Lamports sent to `fee_recipient` at graduation.
    pub migration_fee: u64,
    /// Lamports handed to the migrator PDA to pay DEX pool rent and fees.
    pub migration_budget: u64,
    pub paused: bool,
    pub bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace, Debug)]
pub enum LaunchState {
    /// Dev SOL escrowed, waiting for the dice VRF.
    Rolling,
    /// Dice settled; trading opens at an unknown moment.
    Fogged,
    Trading,
    /// Curve sold out, waiting for `graduate`.
    Complete,
    Graduated,
    /// VRF never answered; dev was refunded.
    Cancelled,
}

#[account]
#[derive(InitSpace)]
pub struct Launch {
    pub mint: Pubkey,
    pub creator: Pubkey,
    pub state: LaunchState,
    pub created_at: i64,
    pub virtual_sol: u64,
    pub virtual_tokens: u64,
    pub real_sol: u64,
    /// Tokens still for sale on the curve.
    pub real_tokens: u64,
    pub lp_tokens: u64,
    /// Held in `sol_vault` (with `real_sol` and a rent reserve) until settle.
    pub dev_buy_escrow: u64,
    pub d1: u8,
    pub d2: u8,
    pub liquid_bps: u16,
    pub vrf_seed: [u8; 32],
    pub vrf_pending: bool,
    pub vrf_requested_at: i64,
    pub fog_tick: u8,
    pub next_tick_at: i64,
    /// After this, anyone may force the fog open (liveness if nobody cranks).
    pub fog_deadline: i64,
    pub opened_at: i64,
    pub completed_at: i64,
    pub graduated_at: i64,
    pub pool: Pubkey,
    pub volume_sol: u64,
    // Parameters frozen at creation so later config changes never touch a live launch.
    pub protocol_fee_bps: u16,
    pub creator_fee_bps: u16,
    pub fog_tick_secs: i64,
    pub fog_max_ticks: u8,
    pub vrf_timeout_secs: i64,
    pub bump: u8,
    pub sol_vault_bump: u8,
}

impl Launch {
    pub fn total_fee_bps(&self) -> u16 {
        self.protocol_fee_bps + self.creator_fee_bps
    }
}

#[account]
#[derive(InitSpace)]
pub struct DevVault {
    pub launch: Pubkey,
    pub creator: Pubkey,
    /// Freed by the dice: withdrawable at any time.
    pub liquid_total: u64,
    /// Bound by the dice: unlocks linearly from `vest_start` over 3 hours.
    pub vest_total: u64,
    /// 0 until trading opens.
    pub vest_start: i64,
    pub withdrawn: u64,
    /// Tokens currently held by the vault. Only these count.
    pub staked: u64,
    /// Highest `staked` ever. Never grows after the dev buy.
    pub peak: u64,
    /// Share of creator fees the dev keeps, in bps. Only ever decreases.
    pub coef_bps: u16,
    pub fee_claimable: u64,
    pub fee_claimed: u64,
    /// Creator fees redirected to holders because `coef_bps` < 100%.
    pub fee_forfeited: u64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct HolderPool {
    pub launch: Pubkey,
    pub total_received: u64,
    pub total_allocated: u64,
    pub total_claimed: u64,
    pub epoch_count: u32,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct HolderEpoch {
    pub pool: Pubkey,
    pub index: u32,
    pub root: [u8; 32],
    pub total: u64,
    pub claimed: u64,
    pub snapshot_slot: u64,
    pub bump: u8,
}

/// Its existence marks (epoch, holder) as claimed.
#[account]
#[derive(InitSpace)]
pub struct ClaimReceipt {
    pub epoch: Pubkey,
    pub holder: Pubkey,
    pub amount: u64,
    pub bump: u8,
}

/// Admin-injected randomness for local testing (`mock-vrf` builds only).
#[account]
#[derive(InitSpace)]
pub struct MockRandomness {
    pub seed: [u8; 32],
    pub randomness: [u8; 64],
    pub bump: u8,
}
