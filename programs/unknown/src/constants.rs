pub const TOKEN_DECIMALS: u8 = 6;
pub const BPS: u64 = 10_000;

/// The part of the dev buy that the dice did not free unlocks linearly over this window.
pub const VEST_DURATION_SECS: i64 = 3 * 60 * 60;
/// 2d6: each pip of the sum frees 3% of the dev buy (2 → 6%, 12 → 36%).
pub const LIQUID_BPS_PER_PIP: u16 = 300;

pub const MAX_NAME_LEN: usize = 32;
pub const MAX_SYMBOL_LEN: usize = 10;
pub const MAX_URI_LEN: usize = 200;
pub const MAX_MERKLE_PROOF_LEN: usize = 32;

pub const SEED_CONFIG: &[u8] = b"config";
pub const SEED_LAUNCH: &[u8] = b"launch";
pub const SEED_VAULT: &[u8] = b"vault";
pub const SEED_POOL: &[u8] = b"pool";
pub const SEED_EPOCH: &[u8] = b"epoch";
pub const SEED_CLAIM: &[u8] = b"claim";
/// Data-less, system-owned PDA holding the curve SOL and the dev-buy escrow.
/// It also creates the DEX pool at graduation (it can pay via system CPIs).
pub const SEED_SOL_VAULT: &[u8] = b"sol_vault";
pub const SEED_MOCK_VRF: &[u8] = b"mockvrf";
pub const SEED_FOG: &[u8] = b"fog";

/// Raydium CPMM PDA seeds, used to derive accounts passed to `graduate`.
pub const CPMM_AUTH_SEED: &[u8] = b"vault_and_lp_mint_auth_seed";
pub const CPMM_POOL_SEED: &[u8] = b"pool";
pub const CPMM_LP_MINT_SEED: &[u8] = b"pool_lp_mint";
pub const CPMM_VAULT_SEED: &[u8] = b"pool_vault";
pub const CPMM_OBSERVATION_SEED: &[u8] = b"observation";
