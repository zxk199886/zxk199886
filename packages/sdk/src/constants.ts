import { PublicKey } from "@solana/web3.js";
import idl from "./idl/unknown.json";

export const PROGRAM_ID = new PublicKey(idl.address);
export const ORAO_VRF_PROGRAM_ID = new PublicKey("VRFzZoJdhFWL8rkvu87LpKM3RbcVezpMEc6X5GVDr7y");
export const CPMM_PROGRAM_ID = {
  mainnet: new PublicKey("CPMMoo8L3F4NbTegBCKVNunggL7H1ZpdTHKxQB5qKP1C"),
  devnet: new PublicKey("DRaycpLY18LhpbydsBWbVJtxpNv9oXPgjRSfpF2bWpYb"),
};
export const CPMM_CREATE_POOL_FEE_RECEIVER = {
  mainnet: new PublicKey("DNXgeM9EiiaAbaWvwjHj9fQQLAX5ZsfHyvmYUNRAdNC8"),
  devnet: new PublicKey("3oE58BKVt8KuYkGxx8zBojugnymWmBiyafWgMrnb6eYy"),
};

export const TOKEN_DECIMALS = 6;
export const TOKEN_UNIT = 10n ** 6n;
export const LAMPORTS = 1_000_000_000n;
export const BPS = 10_000n;
export const VEST_DURATION_SECS = 3 * 60 * 60;
export const LIQUID_BPS_PER_PIP = 300;

export const SEEDS = {
  config: "config",
  launch: "launch",
  vault: "vault",
  pool: "pool",
  epoch: "epoch",
  claim: "claim",
  solVault: "sol_vault",
  mockVrf: "mockvrf",
  oraoRandomness: "orao-vrf-randomness-request",
  oraoNetwork: "orao-vrf-network-configuration",
  cpmmAuth: "vault_and_lp_mint_auth_seed",
  cpmmPool: "pool",
  cpmmLpMint: "pool_lp_mint",
  cpmmVault: "pool_vault",
  cpmmObservation: "observation",
} as const;

/** Mirrors the on-chain `LaunchState` enum. */
export type LaunchStateName = "rolling" | "fogged" | "trading" | "complete" | "graduated" | "cancelled";

export function launchStateName(state: Record<string, unknown>): LaunchStateName {
  return Object.keys(state)[0] as LaunchStateName;
}
