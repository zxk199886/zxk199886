use anchor_lang::prelude::*;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token_2022::Token2022;
use anchor_spl::token_interface::{self, Mint, TokenAccount, TransferChecked};

use crate::constants::*;
use crate::errors::UnknownError;
use crate::events::{DevFeesClaimed, VaultWithdrawn};
use crate::math;
use crate::state::*;
use crate::util::move_lamports;

#[derive(Accounts)]
pub struct WithdrawFromVault<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,

    #[account(seeds = [SEED_LAUNCH, mint.key().as_ref()], bump = launch.bump, has_one = mint)]
    pub launch: Box<Account<'info, Launch>>,

    #[account(mint::token_program = token_program)]
    pub mint: Box<InterfaceAccount<'info, Mint>>,

    #[account(
        mut,
        seeds = [SEED_VAULT, mint.key().as_ref()],
        bump = dev_vault.bump,
        has_one = creator @ UnknownError::Unauthorized,
    )]
    pub dev_vault: Box<Account<'info, DevVault>>,

    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = dev_vault,
        associated_token::token_program = token_program,
    )]
    pub vault_token_account: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(
        init_if_needed,
        payer = creator,
        associated_token::mint = mint,
        associated_token::authority = creator,
        associated_token::token_program = token_program,
    )]
    pub creator_token_account: Box<InterfaceAccount<'info, TokenAccount>>,

    pub token_program: Program<'info, Token2022>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

/// Takes tokens out of the vault. There is deliberately no way back in:
/// only tokens inside the vault count, and the fee coefficient only falls,
/// so "buy back → claim → sell" can never restore it.
pub fn withdraw_from_vault(ctx: Context<WithdrawFromVault>, amount: u64) -> Result<()> {
    require!(amount > 0, UnknownError::ZeroAmount);
    require!(
        matches!(
            ctx.accounts.launch.state,
            LaunchState::Fogged | LaunchState::Trading | LaunchState::Complete | LaunchState::Graduated
        ),
        UnknownError::InvalidState
    );
    let now = Clock::get()?.unix_timestamp;
    let vault = &mut ctx.accounts.dev_vault;
    let unlocked = math::unlocked(vault.liquid_total, vault.vest_total, vault.vest_start, now);
    let after = vault.withdrawn.checked_add(amount).ok_or(UnknownError::MathOverflow)?;
    require!(after <= unlocked, UnknownError::ExceedsUnlocked);

    let mint_key = ctx.accounts.mint.key();
    let seeds: &[&[u8]] = &[SEED_VAULT, mint_key.as_ref(), &[vault.bump]];
    token_interface::transfer_checked(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            TransferChecked {
                from: ctx.accounts.vault_token_account.to_account_info(),
                mint: ctx.accounts.mint.to_account_info(),
                to: ctx.accounts.creator_token_account.to_account_info(),
                authority: vault.to_account_info(),
            },
            &[seeds],
        ),
        amount,
        TOKEN_DECIMALS,
    )?;

    vault.withdrawn = after;
    vault.staked = vault.staked.checked_sub(amount).ok_or(UnknownError::MathOverflow)?;
    vault.coef_bps = math::next_coef(vault.coef_bps, vault.staked, vault.peak);

    emit!(VaultWithdrawn {
        mint: mint_key,
        amount,
        staked: vault.staked,
        peak: vault.peak,
        coef_bps: vault.coef_bps,
        timestamp: now,
    });
    Ok(())
}

#[derive(Accounts)]
pub struct ClaimDevFees<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,

    pub launch: Box<Account<'info, Launch>>,

    #[account(
        mut,
        seeds = [SEED_VAULT, launch.mint.as_ref()],
        bump = dev_vault.bump,
        has_one = creator @ UnknownError::Unauthorized,
        has_one = launch,
    )]
    pub dev_vault: Box<Account<'info, DevVault>>,
}

pub fn claim_dev_fees(ctx: Context<ClaimDevFees>) -> Result<()> {
    let vault = &mut ctx.accounts.dev_vault;
    let amount = vault.fee_claimable;
    require!(amount > 0, UnknownError::NothingToClaim);
    vault.fee_claimable = 0;
    vault.fee_claimed = vault.fee_claimed.checked_add(amount).ok_or(UnknownError::MathOverflow)?;
    move_lamports(&vault.to_account_info(), &ctx.accounts.creator.to_account_info(), amount)?;
    emit!(DevFeesClaimed { mint: ctx.accounts.launch.mint, amount, timestamp: Clock::get()?.unix_timestamp });
    Ok(())
}
