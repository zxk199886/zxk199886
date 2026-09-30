//! Randomness source. Production builds CPI into ORAO VRF; `mock-vrf` builds
//! read admin-injected `MockRandomness` accounts so the full flow runs on a
//! local validator without the oracle.

use anchor_lang::prelude::*;

use crate::errors::UnknownError;

pub struct VrfAccounts<'a, 'info> {
    pub payer: &'a AccountInfo<'info>,
    pub vrf_program: &'a AccountInfo<'info>,
    pub network_state: &'a AccountInfo<'info>,
    pub treasury: &'a AccountInfo<'info>,
    pub randomness: &'a AccountInfo<'info>,
    pub system_program: &'a AccountInfo<'info>,
}

#[cfg(not(feature = "mock-vrf"))]
pub fn randomness_address(seed: &[u8; 32]) -> Pubkey {
    orao_solana_vrf::randomness_account_address(&orao_solana_vrf::ID, seed)
}

#[cfg(feature = "mock-vrf")]
pub fn randomness_address(seed: &[u8; 32]) -> Pubkey {
    Pubkey::find_program_address(&[crate::constants::SEED_MOCK_VRF, seed], &crate::ID).0
}

pub fn check_randomness_account(randomness: &AccountInfo, seed: &[u8; 32]) -> Result<()> {
    require_keys_eq!(randomness.key(), randomness_address(seed), UnknownError::WrongRandomnessAccount);
    Ok(())
}

#[cfg(not(feature = "mock-vrf"))]
pub fn request(accounts: VrfAccounts, seed: [u8; 32]) -> Result<()> {
    use orao_solana_vrf::cpi::accounts::RequestV2;

    require_keys_eq!(accounts.vrf_program.key(), orao_solana_vrf::ID, UnknownError::WrongRandomnessAccount);
    check_randomness_account(accounts.randomness, &seed)?;
    let cpi = CpiContext::new(
        accounts.vrf_program.clone(),
        RequestV2 {
            payer: accounts.payer.clone(),
            network_state: accounts.network_state.clone(),
            treasury: accounts.treasury.clone(),
            request: accounts.randomness.clone(),
            system_program: accounts.system_program.clone(),
        },
    );
    orao_solana_vrf::cpi::request_v2(cpi, seed)
}

#[cfg(feature = "mock-vrf")]
pub fn request(accounts: VrfAccounts, seed: [u8; 32]) -> Result<()> {
    check_randomness_account(accounts.randomness, &seed)
}

/// Fulfilled randomness for `seed`, or `None` while it is still pending.
#[cfg(not(feature = "mock-vrf"))]
pub fn read(randomness: &AccountInfo, seed: &[u8; 32]) -> Result<Option<[u8; 64]>> {
    use orao_solana_vrf::state::RandomnessAccountData;

    check_randomness_account(randomness, seed)?;
    if randomness.owner != &orao_solana_vrf::ID || randomness.data_is_empty() {
        return Ok(None);
    }
    let data = RandomnessAccountData::try_deserialize(&mut &randomness.data.borrow()[..])?;
    require!(data.seed() == seed, UnknownError::WrongRandomnessAccount);
    Ok(data.fulfilled_randomness().copied())
}

#[cfg(feature = "mock-vrf")]
pub fn read(randomness: &AccountInfo, seed: &[u8; 32]) -> Result<Option<[u8; 64]>> {
    use crate::state::MockRandomness;

    check_randomness_account(randomness, seed)?;
    if randomness.owner != &crate::ID || randomness.data_is_empty() {
        return Ok(None);
    }
    let data = MockRandomness::try_deserialize(&mut &randomness.data.borrow()[..])?;
    require!(&data.seed == seed, UnknownError::WrongRandomnessAccount);
    Ok(Some(data.randomness))
}
