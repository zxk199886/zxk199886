use anchor_lang::prelude::*;
use anchor_lang::system_program;

use crate::errors::UnknownError;

/// Moves lamports out of an account owned by this program.
pub fn move_lamports(from: &AccountInfo, to: &AccountInfo, amount: u64) -> Result<()> {
    if amount == 0 {
        return Ok(());
    }
    let mut from_lamports = from.try_borrow_mut_lamports()?;
    **from_lamports = from_lamports.checked_sub(amount).ok_or(UnknownError::MathOverflow)?;
    let mut to_lamports = to.try_borrow_mut_lamports()?;
    **to_lamports = to_lamports.checked_add(amount).ok_or(UnknownError::MathOverflow)?;
    Ok(())
}

/// System transfer out of the launch's `sol_vault` PDA.
pub fn pay_from_vault<'info>(
    system_program: &AccountInfo<'info>,
    sol_vault: &AccountInfo<'info>,
    to: &AccountInfo<'info>,
    amount: u64,
    signer_seeds: &[&[u8]],
) -> Result<()> {
    if amount == 0 {
        return Ok(());
    }
    system_program::transfer(
        CpiContext::new_with_signer(
            system_program.clone(),
            system_program::Transfer { from: sol_vault.clone(), to: to.clone() },
            &[signer_seeds],
        ),
        amount,
    )
}

/// System transfer from a signer.
pub fn pay<'info>(
    system_program: &AccountInfo<'info>,
    from: &AccountInfo<'info>,
    to: &AccountInfo<'info>,
    amount: u64,
) -> Result<()> {
    if amount == 0 {
        return Ok(());
    }
    system_program::transfer(
        CpiContext::new(system_program.clone(), system_program::Transfer { from: from.clone(), to: to.clone() }),
        amount,
    )
}
