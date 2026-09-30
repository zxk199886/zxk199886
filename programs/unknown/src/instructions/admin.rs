use anchor_lang::prelude::*;

use crate::constants::*;
use crate::errors::UnknownError;
use crate::math::Curve;
use crate::state::*;

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct ConfigParams {
    pub fee_recipient: Pubkey,
    pub merkle_authority: Pubkey,
    pub cpmm_program: Pubkey,
    pub protocol_fee_bps: u16,
    pub creator_fee_bps: u16,
    pub initial_virtual_sol: u64,
    pub initial_virtual_tokens: u64,
    pub curve_supply: u64,
    pub lp_supply: u64,
    pub min_dev_buy: u64,
    pub max_dev_buy: u64,
    pub fog_tick_secs: i64,
    pub fog_max_ticks: u8,
    pub vrf_timeout_secs: i64,
    pub migration_fee: u64,
    pub migration_budget: u64,
    pub paused: bool,
}

impl ConfigParams {
    fn validate(&self) -> Result<()> {
        let fee = self.protocol_fee_bps as u64 + self.creator_fee_bps as u64;
        require!(fee <= 500, UnknownError::InvalidConfig);
        require!(self.curve_supply > 0 && self.lp_supply > 0, UnknownError::InvalidConfig);
        require!(self.initial_virtual_tokens > self.curve_supply, UnknownError::InvalidConfig);
        require!(self.initial_virtual_sol > 0, UnknownError::InvalidConfig);
        require!(self.min_dev_buy > 0 && self.min_dev_buy <= self.max_dev_buy, UnknownError::InvalidConfig);
        require!(self.fog_tick_secs > 0 && self.fog_max_ticks > 0, UnknownError::InvalidConfig);
        require!(self.vrf_timeout_secs > 0, UnknownError::InvalidConfig);
        // The dev buy must never sell out the curve on its own.
        let curve = Curve {
            virtual_sol: self.initial_virtual_sol,
            virtual_tokens: self.initial_virtual_tokens,
            real_sol: 0,
            real_tokens: self.curve_supply,
        };
        let q = curve.quote_buy(self.max_dev_buy).ok_or(UnknownError::MathOverflow)?;
        require!(q.tokens_out < self.curve_supply, UnknownError::InvalidConfig);
        Ok(())
    }

    fn apply(&self, c: &mut Config) {
        c.fee_recipient = self.fee_recipient;
        c.merkle_authority = self.merkle_authority;
        c.cpmm_program = self.cpmm_program;
        c.protocol_fee_bps = self.protocol_fee_bps;
        c.creator_fee_bps = self.creator_fee_bps;
        c.initial_virtual_sol = self.initial_virtual_sol;
        c.initial_virtual_tokens = self.initial_virtual_tokens;
        c.curve_supply = self.curve_supply;
        c.lp_supply = self.lp_supply;
        c.min_dev_buy = self.min_dev_buy;
        c.max_dev_buy = self.max_dev_buy;
        c.fog_tick_secs = self.fog_tick_secs;
        c.fog_max_ticks = self.fog_max_ticks;
        c.vrf_timeout_secs = self.vrf_timeout_secs;
        c.migration_fee = self.migration_fee;
        c.migration_budget = self.migration_budget;
        c.paused = self.paused;
    }
}

#[derive(Accounts)]
pub struct InitializeConfig<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    #[account(init, payer = admin, space = 8 + Config::INIT_SPACE, seeds = [SEED_CONFIG], bump)]
    pub config: Account<'info, Config>,
    pub system_program: Program<'info, System>,
}

pub fn initialize_config(ctx: Context<InitializeConfig>, params: ConfigParams) -> Result<()> {
    params.validate()?;
    let config = &mut ctx.accounts.config;
    config.admin = ctx.accounts.admin.key();
    config.bump = ctx.bumps.config;
    params.apply(config);
    Ok(())
}

#[derive(Accounts)]
pub struct UpdateConfig<'info> {
    pub admin: Signer<'info>,
    #[account(mut, seeds = [SEED_CONFIG], bump = config.bump, has_one = admin @ UnknownError::Unauthorized)]
    pub config: Account<'info, Config>,
}

pub fn update_config(ctx: Context<UpdateConfig>, params: ConfigParams, new_admin: Option<Pubkey>) -> Result<()> {
    params.validate()?;
    let config = &mut ctx.accounts.config;
    params.apply(config);
    if let Some(admin) = new_admin {
        config.admin = admin;
    }
    Ok(())
}

#[derive(Accounts)]
#[instruction(seed: [u8; 32])]
pub struct MockFulfill<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    #[account(seeds = [SEED_CONFIG], bump = config.bump, has_one = admin @ UnknownError::Unauthorized)]
    pub config: Account<'info, Config>,
    #[account(
        init,
        payer = admin,
        space = 8 + MockRandomness::INIT_SPACE,
        seeds = [SEED_MOCK_VRF, seed.as_ref()],
        bump
    )]
    pub randomness: Account<'info, MockRandomness>,
    pub system_program: Program<'info, System>,
}

/// Stands in for the oracle on local validators. Compiled out of real builds.
pub fn mock_fulfill(ctx: Context<MockFulfill>, seed: [u8; 32], randomness: [u8; 64]) -> Result<()> {
    if !cfg!(feature = "mock-vrf") {
        return err!(UnknownError::MockVrfDisabled);
    }
    let r = &mut ctx.accounts.randomness;
    r.seed = seed;
    r.randomness = randomness;
    r.bump = ctx.bumps.randomness;
    Ok(())
}
