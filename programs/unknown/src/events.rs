use anchor_lang::prelude::*;

#[event]
pub struct LaunchCreated {
    pub mint: Pubkey,
    pub creator: Pubkey,
    pub name: String,
    pub symbol: String,
    pub uri: String,
    pub dev_buy_lamports: u64,
    pub vrf_seed: [u8; 32],
    pub timestamp: i64,
}

#[event]
pub struct DiceRolled {
    pub mint: Pubkey,
    pub d1: u8,
    pub d2: u8,
    pub liquid_bps: u16,
    pub dev_tokens: u64,
    pub liquid_tokens: u64,
    pub vesting_tokens: u64,
    pub sol_spent: u64,
    pub timestamp: i64,
}

#[event]
pub struct FogRequested {
    pub mint: Pubkey,
    pub tick: u8,
    pub vrf_seed: [u8; 32],
    pub timestamp: i64,
}

#[event]
pub struct FogResolved {
    pub mint: Pubkey,
    pub tick: u8,
    pub opened: bool,
    pub forced: bool,
    pub next_tick_at: i64,
    pub timestamp: i64,
}

#[event]
pub struct Trade {
    pub mint: Pubkey,
    pub trader: Pubkey,
    pub is_buy: bool,
    pub sol_amount: u64,
    pub token_amount: u64,
    pub protocol_fee: u64,
    pub dev_fee: u64,
    pub holder_fee: u64,
    pub virtual_sol: u64,
    pub virtual_tokens: u64,
    pub real_sol: u64,
    pub real_tokens: u64,
    pub timestamp: i64,
}

#[event]
pub struct CurveComplete {
    pub mint: Pubkey,
    pub real_sol: u64,
    pub timestamp: i64,
}

#[event]
pub struct VaultWithdrawn {
    pub mint: Pubkey,
    pub amount: u64,
    pub staked: u64,
    pub peak: u64,
    pub coef_bps: u16,
    pub timestamp: i64,
}

#[event]
pub struct DevFeesClaimed {
    pub mint: Pubkey,
    pub amount: u64,
    pub timestamp: i64,
}

#[event]
pub struct HolderEpochPosted {
    pub mint: Pubkey,
    pub index: u32,
    pub root: [u8; 32],
    pub total: u64,
    pub snapshot_slot: u64,
}

#[event]
pub struct HolderRewardClaimed {
    pub mint: Pubkey,
    pub index: u32,
    pub holder: Pubkey,
    pub amount: u64,
}

#[event]
pub struct LaunchRefunded {
    pub mint: Pubkey,
    pub amount: u64,
    pub timestamp: i64,
}

#[event]
pub struct Graduated {
    pub mint: Pubkey,
    pub pool: Pubkey,
    pub sol_liquidity: u64,
    pub token_liquidity: u64,
    pub lp_burned: u64,
    pub timestamp: i64,
}
