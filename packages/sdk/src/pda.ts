import { PublicKey } from "@solana/web3.js";
import { sha256 } from "@noble/hashes/sha256";
import { CPMM_PROGRAM_ID, ORAO_VRF_PROGRAM_ID, PROGRAM_ID, SEEDS } from "./constants";

const enc = (s: string) => Buffer.from(s, "utf8");
const find = (seeds: (Buffer | Uint8Array)[], program = PROGRAM_ID) =>
  PublicKey.findProgramAddressSync(seeds, program)[0];

export const configPda = () => find([enc(SEEDS.config)]);
export const launchPda = (mint: PublicKey) => find([enc(SEEDS.launch), mint.toBuffer()]);
export const vaultPda = (mint: PublicKey) => find([enc(SEEDS.vault), mint.toBuffer()]);
export const holderPoolPda = (mint: PublicKey) => find([enc(SEEDS.pool), mint.toBuffer()]);
/** Holds curve SOL + dev escrow; creates the DEX pool at graduation. */
export const solVaultPda = (mint: PublicKey) => find([enc(SEEDS.solVault), mint.toBuffer()]);

export function epochPda(holderPool: PublicKey, index: number) {
  const idx = Buffer.alloc(4);
  idx.writeUInt32LE(index);
  return find([enc(SEEDS.epoch), holderPool.toBuffer(), idx]);
}

export const claimReceiptPda = (epoch: PublicKey, holder: PublicKey) =>
  find([enc(SEEDS.claim), epoch.toBuffer(), holder.toBuffer()]);

/** VRF seed for the dice roll: sha256("dice" || mint). */
export const diceSeed = (mint: PublicKey) => sha256(Buffer.concat([enc("dice"), mint.toBuffer()]));

/** VRF seed for fog tick `tick`: sha256("fog" || mint || tick). */
export const fogSeed = (mint: PublicKey, tick: number) =>
  sha256(Buffer.concat([enc("fog"), mint.toBuffer(), Buffer.from([tick])]));

export type VrfMode = "orao" | "mock";

export function randomnessAccount(seed: Uint8Array, mode: VrfMode) {
  return mode === "mock"
    ? find([enc(SEEDS.mockVrf), seed])
    : find([enc(SEEDS.oraoRandomness), seed], ORAO_VRF_PROGRAM_ID);
}

export const oraoNetworkState = () => find([enc(SEEDS.oraoNetwork)], ORAO_VRF_PROGRAM_ID);

export function cpmmAccounts(opts: {
  cpmmProgram?: PublicKey;
  ammConfig: PublicKey;
  mint: PublicKey;
  wsolMint: PublicKey;
}) {
  const program = opts.cpmmProgram ?? CPMM_PROGRAM_ID.mainnet;
  const [token0, token1] =
    Buffer.compare(opts.mint.toBuffer(), opts.wsolMint.toBuffer()) < 0
      ? [opts.mint, opts.wsolMint]
      : [opts.wsolMint, opts.mint];
  const pda = (seeds: (Buffer | Uint8Array)[]) => find(seeds, program);
  const poolState = pda([enc(SEEDS.cpmmPool), opts.ammConfig.toBuffer(), token0.toBuffer(), token1.toBuffer()]);
  return {
    program,
    token0,
    token1,
    authority: pda([enc(SEEDS.cpmmAuth)]),
    poolState,
    lpMint: pda([enc(SEEDS.cpmmLpMint), poolState.toBuffer()]),
    token0Vault: pda([enc(SEEDS.cpmmVault), poolState.toBuffer(), token0.toBuffer()]),
    token1Vault: pda([enc(SEEDS.cpmmVault), poolState.toBuffer(), token1.toBuffer()]),
    observation: pda([enc(SEEDS.cpmmObservation), poolState.toBuffer()]),
  };
}
