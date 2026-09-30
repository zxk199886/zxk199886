//! Unknown — a Solana launchpad where fate, not the dev, decides how much of
//! the dev buy can be dumped, and nobody knows when the market opens.
#![allow(unexpected_cfgs)]

use anchor_lang::prelude::*;

pub mod constants;
pub mod errors;
pub mod events;
pub mod instructions;
pub mod math;
pub mod state;
pub mod util;
pub mod vrf;

use instructions::*;

declare_id!("2X5DHDfcqKLisg7ss6s7FLpUEr2B48ax73EKRgYGWiTW");

#[program]
pub mod unknown {
    use super::*;

    pub fn initialize_config(ctx: Context<InitializeConfig>, params: ConfigParams) -> Result<()> {
        instructions::admin::initialize_config(ctx, params)
    }

    pub fn update_config(ctx: Context<UpdateConfig>, params: ConfigParams, new_admin: Option<Pubkey>) -> Result<()> {
        instructions::admin::update_config(ctx, params, new_admin)
    }

    /// Local validators only (`mock-vrf` builds): injects VRF output.
    pub fn mock_fulfill(ctx: Context<MockFulfill>, seed: [u8; 32], randomness: [u8; 64]) -> Result<()> {
        instructions::admin::mock_fulfill(ctx, seed, randomness)
    }

    /// Creates the token with authorities burned, escrows the dev buy and rolls the dice.
    pub fn create_launch(
        ctx: Context<CreateLaunch>,
        name: String,
        symbol: String,
        uri: String,
        dev_buy_lamports: u64,
    ) -> Result<()> {
        instructions::create_launch::create_launch(ctx, name, symbol, uri, dev_buy_lamports)
    }

    /// Lands the dice: executes the dev buy and splits it into free and bound tokens.
    pub fn settle_launch(ctx: Context<SettleLaunch>) -> Result<()> {
        instructions::settle_launch::settle_launch(ctx)
    }

    /// Refunds the dev if the dice VRF never answered.
    pub fn refund_launch(ctx: Context<RefundLaunch>) -> Result<()> {
        instructions::refund::refund_launch(ctx)
    }

    /// Draws randomness for the next fog tick.
    pub fn fog_request(ctx: Context<FogRequest>) -> Result<()> {
        instructions::fog::fog_request(ctx)
    }

    /// Reveals whether this tick lifts the fog and opens trading.
    pub fn fog_resolve(ctx: Context<FogResolve>) -> Result<()> {
        instructions::fog::fog_resolve(ctx)
    }

    pub fn buy(ctx: Context<Trade>, sol_amount: u64, min_tokens_out: u64) -> Result<()> {
        instructions::trade::buy(ctx, sol_amount, min_tokens_out)
    }

    pub fn sell(ctx: Context<Trade>, token_amount: u64, min_sol_out: u64) -> Result<()> {
        instructions::trade::sell(ctx, token_amount, min_sol_out)
    }

    pub fn withdraw_from_vault(ctx: Context<WithdrawFromVault>, amount: u64) -> Result<()> {
        instructions::vault::withdraw_from_vault(ctx, amount)
    }

    pub fn claim_dev_fees(ctx: Context<ClaimDevFees>) -> Result<()> {
        instructions::vault::claim_dev_fees(ctx)
    }

    pub fn post_holder_epoch(
        ctx: Context<PostHolderEpoch>,
        total: u64,
        root: [u8; 32],
        snapshot_slot: u64,
    ) -> Result<()> {
        instructions::holders::post_holder_epoch(ctx, total, root, snapshot_slot)
    }

    pub fn claim_holder_reward(
        ctx: Context<ClaimHolderReward>,
        index: u32,
        amount: u64,
        proof: Vec<[u8; 32]>,
    ) -> Result<()> {
        instructions::holders::claim_holder_reward(ctx, index, amount, proof)
    }

    /// Migrates a completed curve into Raydium CPMM and burns the LP.
    pub fn graduate(ctx: Context<Graduate>) -> Result<()> {
        instructions::graduate::graduate(ctx)
    }
}
