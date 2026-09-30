import { AnchorProvider, BN, Program, type IdlAccounts, type IdlEvents } from "@coral-xyz/anchor";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  NATIVE_MINT,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import {
  ComputeBudgetProgram,
  Keypair,
  PublicKey,
  SYSVAR_RENT_PUBKEY,
  SystemProgram,
  type Connection,
  type TransactionInstruction,
} from "@solana/web3.js";
import { ORAO_VRF_PROGRAM_ID, launchStateName } from "./constants";
import type { CurveState } from "./curve";
import idl from "./idl/unknown.json";
import type { Unknown } from "./idl/unknown";
import {
  claimReceiptPda,
  configPda,
  cpmmAccounts,
  diceSeed,
  epochPda,
  fogSeed,
  holderPoolPda,
  launchPda,
  solVaultPda,
  oraoNetworkState,
  randomnessAccount,
  vaultPda,
  type VrfMode,
} from "./pda";

export type ConfigAccount = IdlAccounts<Unknown>["config"];
export type LaunchAccount = IdlAccounts<Unknown>["launch"];
export type DevVaultAccount = IdlAccounts<Unknown>["devVault"];
export type HolderPoolAccount = IdlAccounts<Unknown>["holderPool"];
export type HolderEpochAccount = IdlAccounts<Unknown>["holderEpoch"];
export type UnknownEvents = IdlEvents<Unknown>;

export function curveOf(l: LaunchAccount): CurveState {
  return {
    virtualSol: BigInt(l.virtualSol.toString()),
    virtualTokens: BigInt(l.virtualTokens.toString()),
    realSol: BigInt(l.realSol.toString()),
    realTokens: BigInt(l.realTokens.toString()),
  };
}

const bn = (v: bigint | number | BN) => (BN.isBN(v) ? (v as BN) : new BN(v.toString()));

export interface GraduateOpts {
  ammConfig: PublicKey;
  cpmmProgram: PublicKey;
  createPoolFee: PublicKey;
}

/**
 * Thin, typed wrapper over the Anchor program. Every method returns
 * instructions so callers (wallet UI, crank, tests) decide how to send them.
 */
export class UnknownClient {
  readonly program: Program<Unknown>;

  constructor(
    readonly provider: AnchorProvider,
    readonly vrfMode: VrfMode = "orao",
  ) {
    this.program = new Program<Unknown>(idl as Unknown, provider);
  }

  get connection(): Connection {
    return this.provider.connection;
  }

  // ---------- reads ----------

  fetchConfig() {
    return this.program.account.config.fetch(configPda());
  }

  fetchLaunch(mint: PublicKey) {
    return this.program.account.launch.fetch(launchPda(mint));
  }

  fetchVault(mint: PublicKey) {
    return this.program.account.devVault.fetch(vaultPda(mint));
  }

  fetchHolderPool(mint: PublicKey) {
    return this.program.account.holderPool.fetch(holderPoolPda(mint));
  }

  fetchAllLaunches() {
    return this.program.account.launch.all();
  }

  stateOf(l: LaunchAccount) {
    return launchStateName(l.state as Record<string, unknown>);
  }

  private async oraoTreasury(): Promise<PublicKey> {
    const info = await this.connection.getAccountInfo(oraoNetworkState());
    if (!info) throw new Error("ORAO network state not found on this cluster");
    // discriminator(8) + authority(32) + treasury(32)
    return new PublicKey(info.data.subarray(40, 72));
  }

  private async vrfAccounts(seed: Uint8Array) {
    const randomness = randomnessAccount(seed, this.vrfMode);
    if (this.vrfMode === "mock") {
      // Ignored by mock builds, but must be writable/valid placeholders.
      return {
        vrfProgram: SystemProgram.programId,
        vrfNetworkState: randomness,
        vrfTreasury: randomness,
        randomness,
      };
    }
    return {
      vrfProgram: ORAO_VRF_PROGRAM_ID,
      vrfNetworkState: oraoNetworkState(),
      vrfTreasury: await this.oraoTreasury(),
      randomness,
    };
  }

  // ---------- admin ----------

  initializeConfig(admin: PublicKey, params: Parameters<Program<Unknown>["methods"]["initializeConfig"]>[0]) {
    return this.program.methods
      .initializeConfig(params)
      .accountsPartial({ admin, config: configPda(), systemProgram: SystemProgram.programId })
      .instruction();
  }

  mockFulfill(admin: PublicKey, seed: Uint8Array, randomness: Uint8Array) {
    return this.program.methods
      .mockFulfill(Array.from(seed), Array.from(randomness))
      .accountsPartial({
        admin,
        config: configPda(),
        randomness: randomnessAccount(seed, "mock"),
        systemProgram: SystemProgram.programId,
      })
      .instruction();
  }

  // ---------- launch lifecycle ----------

  async createLaunch(args: {
    creator: PublicKey;
    mint?: Keypair;
    name: string;
    symbol: string;
    uri: string;
    devBuyLamports: bigint | number;
  }): Promise<{ ixs: TransactionInstruction[]; mint: Keypair }> {
    const mint = args.mint ?? Keypair.generate();
    const m = mint.publicKey;
    const vrf = await this.vrfAccounts(diceSeed(m));
    const ix = await this.program.methods
      .createLaunch(args.name, args.symbol, args.uri, bn(args.devBuyLamports))
      .accountsPartial({
        creator: args.creator,
        config: configPda(),
        mint: m,
        launch: launchPda(m),
        solVault: solVaultPda(m),
        devVault: vaultPda(m),
        holderPool: holderPoolPda(m),
        curveTokenAccount: getAssociatedTokenAddressSync(m, launchPda(m), true, TOKEN_2022_PROGRAM_ID),
        vaultTokenAccount: getAssociatedTokenAddressSync(m, vaultPda(m), true, TOKEN_2022_PROGRAM_ID),
        ...vrf,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .instruction();
    return { ixs: [ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }), ix], mint };
  }

  async settleLaunch(cranker: PublicKey, mint: PublicKey) {
    const [config, launch] = await Promise.all([this.fetchConfig(), this.fetchLaunch(mint)]);
    return this.program.methods
      .settleLaunch()
      .accountsPartial({
        cranker,
        config: configPda(),
        feeRecipient: config.feeRecipient,
        creator: launch.creator,
        launch: launchPda(mint),
        mint,
        solVault: solVaultPda(mint),
        devVault: vaultPda(mint),
        holderPool: holderPoolPda(mint),
        curveTokenAccount: getAssociatedTokenAddressSync(mint, launchPda(mint), true, TOKEN_2022_PROGRAM_ID),
        vaultTokenAccount: getAssociatedTokenAddressSync(mint, vaultPda(mint), true, TOKEN_2022_PROGRAM_ID),
        randomness: randomnessAccount(Uint8Array.from(launch.vrfSeed), this.vrfMode),
        tokenProgram: TOKEN_2022_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .instruction();
  }

  async refundLaunch(mint: PublicKey) {
    const launch = await this.fetchLaunch(mint);
    return this.program.methods
      .refundLaunch()
      .accountsPartial({
        creator: launch.creator,
        launch: launchPda(mint),
        solVault: solVaultPda(mint),
        randomness: randomnessAccount(Uint8Array.from(launch.vrfSeed), this.vrfMode),
        systemProgram: SystemProgram.programId,
      })
      .instruction();
  }

  async fogRequest(payer: PublicKey, mint: PublicKey) {
    const launch = await this.fetchLaunch(mint);
    const vrf = await this.vrfAccounts(fogSeed(mint, launch.fogTick));
    return this.program.methods
      .fogRequest()
      .accountsPartial({ payer, launch: launchPda(mint), ...vrf, systemProgram: SystemProgram.programId })
      .instruction();
  }

  async fogResolve(mint: PublicKey) {
    const launch = await this.fetchLaunch(mint);
    return this.program.methods
      .fogResolve()
      .accountsPartial({
        launch: launchPda(mint),
        devVault: vaultPda(mint),
        randomness: randomnessAccount(Uint8Array.from(launch.vrfSeed), this.vrfMode),
      })
      .instruction();
  }

  // ---------- trading ----------

  private async tradeAccounts(trader: PublicKey, mint: PublicKey) {
    const config = await this.fetchConfig();
    return {
      trader,
      config: configPda(),
      feeRecipient: config.feeRecipient,
      launch: launchPda(mint),
      mint,
      solVault: solVaultPda(mint),
      devVault: vaultPda(mint),
      holderPool: holderPoolPda(mint),
      curveTokenAccount: getAssociatedTokenAddressSync(mint, launchPda(mint), true, TOKEN_2022_PROGRAM_ID),
      traderTokenAccount: getAssociatedTokenAddressSync(mint, trader, true, TOKEN_2022_PROGRAM_ID),
      tokenProgram: TOKEN_2022_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    };
  }

  async buy(trader: PublicKey, mint: PublicKey, solAmount: bigint, minTokensOut: bigint) {
    return this.program.methods
      .buy(bn(solAmount), bn(minTokensOut))
      .accountsPartial(await this.tradeAccounts(trader, mint))
      .instruction();
  }

  async sell(trader: PublicKey, mint: PublicKey, tokenAmount: bigint, minSolOut: bigint) {
    return this.program.methods
      .sell(bn(tokenAmount), bn(minSolOut))
      .accountsPartial(await this.tradeAccounts(trader, mint))
      .instruction();
  }

  // ---------- dev vault ----------

  withdrawFromVault(creator: PublicKey, mint: PublicKey, amount: bigint) {
    return this.program.methods
      .withdrawFromVault(bn(amount))
      .accountsPartial({
        creator,
        launch: launchPda(mint),
        mint,
        devVault: vaultPda(mint),
        vaultTokenAccount: getAssociatedTokenAddressSync(mint, vaultPda(mint), true, TOKEN_2022_PROGRAM_ID),
        creatorTokenAccount: getAssociatedTokenAddressSync(mint, creator, true, TOKEN_2022_PROGRAM_ID),
        tokenProgram: TOKEN_2022_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .instruction();
  }

  claimDevFees(creator: PublicKey, mint: PublicKey) {
    return this.program.methods
      .claimDevFees()
      .accountsPartial({ creator, launch: launchPda(mint), devVault: vaultPda(mint) })
      .instruction();
  }

  // ---------- holder rewards ----------

  async postHolderEpoch(merkleAuthority: PublicKey, mint: PublicKey, total: bigint, root: Uint8Array, slot: bigint) {
    const pool = holderPoolPda(mint);
    const poolAcc = await this.fetchHolderPool(mint);
    return this.program.methods
      .postHolderEpoch(bn(total), Array.from(root), bn(slot))
      .accountsPartial({
        merkleAuthority,
        config: configPda(),
        holderPool: pool,
        launch: launchPda(mint),
        epoch: epochPda(pool, poolAcc.epochCount),
        systemProgram: SystemProgram.programId,
      })
      .instruction();
  }

  claimHolderReward(holder: PublicKey, mint: PublicKey, index: number, amount: bigint, proof: Uint8Array[]) {
    const pool = holderPoolPda(mint);
    const epoch = epochPda(pool, index);
    return this.program.methods
      .claimHolderReward(index, bn(amount), proof.map((p) => Array.from(p)))
      .accountsPartial({
        holder,
        launch: launchPda(mint),
        holderPool: pool,
        epoch,
        receipt: claimReceiptPda(epoch, holder),
        systemProgram: SystemProgram.programId,
      })
      .instruction();
  }

  // ---------- graduation ----------

  async graduate(payer: PublicKey, mint: PublicKey, opts: GraduateOpts) {
    const config = await this.fetchConfig();
    const solVault = solVaultPda(mint);
    const cp = cpmmAccounts({ cpmmProgram: opts.cpmmProgram, ammConfig: opts.ammConfig, mint, wsolMint: NATIVE_MINT });
    const ix = await this.program.methods
      .graduate()
      .accountsPartial({
        payer,
        config: configPda(),
        feeRecipient: config.feeRecipient,
        launch: launchPda(mint),
        mint,
        curveTokenAccount: getAssociatedTokenAddressSync(mint, launchPda(mint), true, TOKEN_2022_PROGRAM_ID),
        solVault,
        vaultTokenAccount: getAssociatedTokenAddressSync(mint, solVault, true, TOKEN_2022_PROGRAM_ID),
        wsolMint: NATIVE_MINT,
        vaultWsolAccount: getAssociatedTokenAddressSync(NATIVE_MINT, solVault, true, TOKEN_PROGRAM_ID),
        cpmmProgram: cp.program,
        ammConfig: opts.ammConfig,
        cpmmAuthority: cp.authority,
        poolState: cp.poolState,
        lpMint: cp.lpMint,
        vaultLpAccount: getAssociatedTokenAddressSync(cp.lpMint, solVault, true, TOKEN_PROGRAM_ID),
        token0Vault: cp.token0Vault,
        token1Vault: cp.token1Vault,
        createPoolFee: opts.createPoolFee,
        observationState: cp.observation,
        tokenProgram: TOKEN_PROGRAM_ID,
        token2022Program: TOKEN_2022_PROGRAM_ID,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: SYSVAR_RENT_PUBKEY,
      })
      .instruction();
    return [ComputeBudgetProgram.setComputeUnitLimit({ units: 600_000 }), ix];
  }
}
