use anchor_lang::prelude::*;

use crate::constants::*;
use crate::errors::UnknownError;
use crate::events::{HolderEpochPosted, HolderRewardClaimed};
use crate::math;
use crate::state::*;
use crate::util::move_lamports;

/// Forfeited creator fees are paid to holders in epochs. The indexer
/// snapshots balances (excluding curve, vault, DEX pool and the dev's wallet)
/// and posts a merkle root of pro-rata SOL amounts.
#[derive(Accounts)]
pub struct PostHolderEpoch<'info> {
    #[account(mut)]
    pub merkle_authority: Signer<'info>,

    #[account(seeds = [SEED_CONFIG], bump = config.bump, has_one = merkle_authority @ UnknownError::Unauthorized)]
    pub config: Box<Account<'info, Config>>,

    #[account(mut, seeds = [SEED_POOL, launch.mint.as_ref()], bump = holder_pool.bump, has_one = launch)]
    pub holder_pool: Box<Account<'info, HolderPool>>,

    pub launch: Box<Account<'info, Launch>>,

    #[account(
        init,
        payer = merkle_authority,
        space = 8 + HolderEpoch::INIT_SPACE,
        seeds = [SEED_EPOCH, holder_pool.key().as_ref(), &holder_pool.epoch_count.to_le_bytes()],
        bump
    )]
    pub epoch: Box<Account<'info, HolderEpoch>>,

    pub system_program: Program<'info, System>,
}

pub fn post_holder_epoch(ctx: Context<PostHolderEpoch>, total: u64, root: [u8; 32], snapshot_slot: u64) -> Result<()> {
    require!(total > 0, UnknownError::ZeroAmount);
    let pool = &mut ctx.accounts.holder_pool;
    let unallocated = pool.total_received - pool.total_allocated;
    require!(total <= unallocated, UnknownError::ExceedsUnallocated);

    let epoch = &mut ctx.accounts.epoch;
    epoch.pool = pool.key();
    epoch.index = pool.epoch_count;
    epoch.root = root;
    epoch.total = total;
    epoch.snapshot_slot = snapshot_slot;
    epoch.bump = ctx.bumps.epoch;

    pool.total_allocated += total;
    pool.epoch_count += 1;

    emit!(HolderEpochPosted { mint: ctx.accounts.launch.mint, index: epoch.index, root, total, snapshot_slot });
    Ok(())
}

#[derive(Accounts)]
#[instruction(index: u32)]
pub struct ClaimHolderReward<'info> {
    #[account(mut)]
    pub holder: Signer<'info>,

    pub launch: Box<Account<'info, Launch>>,

    #[account(mut, seeds = [SEED_POOL, launch.mint.as_ref()], bump = holder_pool.bump, has_one = launch)]
    pub holder_pool: Box<Account<'info, HolderPool>>,

    #[account(
        mut,
        seeds = [SEED_EPOCH, holder_pool.key().as_ref(), &index.to_le_bytes()],
        bump = epoch.bump,
    )]
    pub epoch: Box<Account<'info, HolderEpoch>>,

    /// `init` fails if it exists, so each holder claims each epoch once.
    #[account(
        init,
        payer = holder,
        space = 8 + ClaimReceipt::INIT_SPACE,
        seeds = [SEED_CLAIM, epoch.key().as_ref(), holder.key().as_ref()],
        bump
    )]
    pub receipt: Box<Account<'info, ClaimReceipt>>,

    pub system_program: Program<'info, System>,
}

pub fn claim_holder_reward(
    ctx: Context<ClaimHolderReward>,
    _index: u32,
    amount: u64,
    proof: Vec<[u8; 32]>,
) -> Result<()> {
    require!(amount > 0, UnknownError::ZeroAmount);
    require!(proof.len() <= MAX_MERKLE_PROOF_LEN, UnknownError::InvalidProof);
    let holder = ctx.accounts.holder.key();
    let epoch = &mut ctx.accounts.epoch;
    let leaf = math::merkle_leaf(&holder.to_bytes(), amount);
    require!(math::verify_merkle(&proof, &epoch.root, leaf), UnknownError::InvalidProof);
    let claimed = epoch.claimed.checked_add(amount).ok_or(UnknownError::MathOverflow)?;
    require!(claimed <= epoch.total, UnknownError::EpochExhausted);
    epoch.claimed = claimed;

    let pool = &mut ctx.accounts.holder_pool;
    pool.total_claimed = pool.total_claimed.checked_add(amount).ok_or(UnknownError::MathOverflow)?;
    move_lamports(&pool.to_account_info(), &ctx.accounts.holder.to_account_info(), amount)?;

    let receipt = &mut ctx.accounts.receipt;
    receipt.epoch = epoch.key();
    receipt.holder = holder;
    receipt.amount = amount;
    receipt.bump = ctx.bumps.receipt;

    emit!(HolderRewardClaimed { mint: ctx.accounts.launch.mint, index: epoch.index, holder, amount });
    Ok(())
}
