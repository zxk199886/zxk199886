use anchor_lang::prelude::*;

#[error_code]
pub enum UnknownError {
    #[msg("Protocol is paused")]
    Paused,
    #[msg("Math overflow")]
    MathOverflow,
    #[msg("Invalid config parameters")]
    InvalidConfig,
    #[msg("Name, symbol or uri too long")]
    MetadataTooLong,
    #[msg("Dev buy is outside the allowed range")]
    DevBuyOutOfRange,
    #[msg("Launch is not in the required state")]
    InvalidState,
    #[msg("Randomness account does not match the pending request")]
    WrongRandomnessAccount,
    #[msg("Randomness has not been fulfilled yet")]
    RandomnessNotReady,
    #[msg("No randomness request is pending")]
    NoPendingRequest,
    #[msg("A randomness request is already pending")]
    RequestAlreadyPending,
    #[msg("Too early")]
    TooEarly,
    #[msg("VRF request has not timed out yet")]
    NotTimedOut,
    #[msg("Slippage tolerance exceeded")]
    SlippageExceeded,
    #[msg("Amount must be greater than zero")]
    ZeroAmount,
    #[msg("Curve has no tokens left")]
    CurveSoldOut,
    #[msg("Not enough SOL in the curve")]
    InsufficientCurveSol,
    #[msg("Amount exceeds the unlocked vault balance")]
    ExceedsUnlocked,
    #[msg("Nothing to claim")]
    NothingToClaim,
    #[msg("Epoch total exceeds unallocated holder pool")]
    ExceedsUnallocated,
    #[msg("Invalid merkle proof")]
    InvalidProof,
    #[msg("Epoch has insufficient remaining balance")]
    EpochExhausted,
    #[msg("Wrong DEX program")]
    WrongDexProgram,
    #[msg("Wrong mint ordering for pool")]
    WrongMintOrder,
    #[msg("Unauthorized")]
    Unauthorized,
    #[msg("Mock VRF is not enabled in this build")]
    MockVrfDisabled,
}
