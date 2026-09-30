import * as anchor from "@coral-xyz/anchor";
import { BN } from "@coral-xyz/anchor";
import {
  NATIVE_MINT,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  createTransferCheckedInstruction,
  getAccount,
  getAssociatedTokenAddressSync,
  getMetadataPointerState,
  getMint,
  getTokenMetadata,
} from "@solana/spl-token";
import {
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
  type Signer,
} from "@solana/web3.js";
import { createHash } from "node:crypto";
import { expect } from "chai";
import {
  CPMM_PROGRAM_ID,
  CPMM_CREATE_POOL_FEE_RECEIVER,
  HolderMerkleTree,
  UnknownClient,
  cpmmAccounts,
  curveOf,
  diceSeed,
  fogSeed,
  holderPoolPda,
  launchPda,
  quoteBuy,
  quoteSell,
  vaultPda,
} from "@unknown/sdk";

const SOL = BigInt(LAMPORTS_PER_SOL);
const TOK = 1_000_000n;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe("unknown", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const client = new UnknownClient(provider, "mock");
  const conn = provider.connection;
  const admin = (provider.wallet as anchor.Wallet).payer;
  const feeRecipient = Keypair.generate();
  const merkleAuthority = admin;

  const send = async (ixs: TransactionInstruction[], signers: Signer[] = []) => {
    const tx = new Transaction().add(...ixs);
    return sendAndConfirmTransaction(conn, tx, [admin, ...signers.filter((s) => !s.publicKey.equals(admin.publicKey))], {
      commitment: "confirmed",
    });
  };
  /** Sends a tx paid by `payer` (not the admin). */
  const sendAs = async (payer: Keypair, ixs: TransactionInstruction[], extra: Signer[] = []) => {
    const tx = new Transaction().add(...ixs);
    return sendAndConfirmTransaction(conn, tx, [payer, ...extra], { commitment: "confirmed" });
  };
  const expectError = async (p: Promise<unknown>, code: string) => {
    try {
      await p;
    } catch (e: unknown) {
      const msg = String((e as { logs?: string[] }).logs?.join("\n") ?? "") + String(e);
      expect(msg).to.include(code);
      return;
    }
    expect.fail(`expected error ${code}`);
  };
  const fund = async (kp: PublicKey, sol: number) => {
    const sig = await conn.requestAirdrop(kp, sol * LAMPORTS_PER_SOL);
    await conn.confirmTransaction(sig, "confirmed");
  };
  const balance = (k: PublicKey) => conn.getBalance(k, "confirmed").then(BigInt);
  const tokenBalance = async (mint: PublicKey, owner: PublicKey) =>
    (await getAccount(conn, getAssociatedTokenAddressSync(mint, owner, true, TOKEN_2022_PROGRAM_ID), "confirmed", TOKEN_2022_PROGRAM_ID)).amount;

  /** Randomness whose first byte pair produces the requested dice. */
  const diceBytes = (d1: number, d2: number) => {
    const r = new Uint8Array(64);
    r[0] = d1 - 1;
    r[1] = d2 - 1;
    return r;
  };
  const u64Bytes = (v: bigint) => {
    const r = new Uint8Array(64);
    new DataView(r.buffer).setBigUint64(0, v, true);
    return r;
  };

  const params = {
    feeRecipient: feeRecipient.publicKey,
    merkleAuthority: merkleAuthority.publicKey,
    cpmmProgram: CPMM_PROGRAM_ID.mainnet,
    protocolFeeBps: 60,
    creatorFeeBps: 40,
    initialVirtualSol: new BN((30n * SOL).toString()),
    initialVirtualTokens: new BN((1_073_000_000n * TOK).toString()),
    curveSupply: new BN((793_100_000n * TOK).toString()),
    lpSupply: new BN((206_900_000n * TOK).toString()),
    minDevBuy: new BN((SOL / 10n).toString()),
    maxDevBuy: new BN((10n * SOL).toString()),
    fogTickSecs: new BN(1),
    fogMaxTicks: 3,
    vrfTimeoutSecs: new BN(2),
    migrationFee: new BN((SOL / 2n).toString()),
    migrationBudget: new BN(((3n * SOL) / 10n).toString()),
    paused: false,
  };

  const creator = Keypair.generate();
  const trader = Keypair.generate();
  const holderB = Keypair.generate();
  let mint: PublicKey;
  const devBuy = 2n * SOL;

  before(async () => {
    await Promise.all([
      fund(creator.publicKey, 50),
      fund(trader.publicKey, 500),
      fund(holderB.publicKey, 50),
      fund(feeRecipient.publicKey, 1),
    ]);
    await send([await client.initializeConfig(admin.publicKey, params)]);
  });

  async function newLaunch(buy = devBuy) {
    const { ixs, mint: m } = await client.createLaunch({
      creator: creator.publicKey,
      name: "Unknown Test",
      symbol: "UNK",
      uri: "https://example.com/unk.json",
      devBuyLamports: buy,
    });
    await sendAs(creator, ixs, [m]);
    return m.publicKey;
  }

  describe("creation", () => {
    it("burns mint, freeze and metadata authorities and escrows the dev buy", async () => {
      mint = await newLaunch();
      const m = await getMint(conn, mint, "confirmed", TOKEN_2022_PROGRAM_ID);
      expect(m.mintAuthority).to.equal(null);
      expect(m.freezeAuthority).to.equal(null);
      expect(m.supply).to.equal(1_000_000_000n * TOK);
      expect(getMetadataPointerState(m)?.authority).to.equal(null);
      const md = await getTokenMetadata(conn, mint, "confirmed", TOKEN_2022_PROGRAM_ID);
      expect(md?.name).to.equal("Unknown Test");
      expect(md?.updateAuthority).to.equal(undefined);

      const launch = await client.fetchLaunch(mint);
      expect(client.stateOf(launch)).to.equal("rolling");
      expect(launch.devBuyEscrow.toString()).to.equal(devBuy.toString());
      expect(launch.vrfPending).to.equal(true);
    });

    it("rejects a dev buy outside the configured range", async () => {
      await expectError(newLaunch(SOL / 100n), "DevBuyOutOfRange");
    });
  });

  describe("dice", () => {
    it("can not settle before the VRF answers", async () => {
      await expectError(send([await client.settleLaunch(admin.publicKey, mint)]), "RandomnessNotReady");
    });

    it("lands 6+5 → 33% free, 67% bound, all inside the vault", async () => {
      await send([await client.mockFulfill(admin.publicKey, diceSeed(mint), diceBytes(6, 5))]);
      const creatorBefore = await balance(creator.publicKey);
      await send([await client.settleLaunch(admin.publicKey, mint)]);

      const launch = await client.fetchLaunch(mint);
      expect(client.stateOf(launch)).to.equal("fogged");
      expect([launch.d1, launch.d2]).to.deep.equal([6, 5]);
      expect(launch.liquidBps).to.equal(3300);

      const vault = await client.fetchVault(mint);
      const total = BigInt(vault.peak.toString());
      expect(BigInt(vault.liquidTotal.toString())).to.equal((total * 3300n) / 10_000n);
      expect(BigInt(vault.liquidTotal.toString()) + BigInt(vault.vestTotal.toString())).to.equal(total);
      expect(await tokenBalance(mint, vaultPda(mint))).to.equal(total);
      expect(vault.coefBps).to.equal(10_000);
      expect(vault.vestStart.toNumber()).to.equal(0);
      // Whole escrow was usable: no refund.
      expect(await balance(creator.publicKey)).to.equal(creatorBefore);
    });

    it("can not refund once the dice have landed", async () => {
      await expectError(send([await client.refundLaunch(mint)]), "InvalidState");
    });
  });

  describe("fog", () => {
    it("rejects trades while fogged", async () => {
      await expectError(sendAs(trader, [await client.buy(trader.publicKey, mint, SOL, 0n)]), "InvalidState");
    });

    it("opens on a random tick, never before", async () => {
      // tick 0 of 3: r % 3 == 1 → stays closed
      await sleep(1200);
      await send([await client.fogRequest(admin.publicKey, mint)]);
      await expectError(send([await client.fogRequest(admin.publicKey, mint)]), "RequestAlreadyPending");
      await send([await client.mockFulfill(admin.publicKey, fogSeed(mint, 0), u64Bytes(1n))]);
      await send([await client.fogResolve(mint)]);
      let launch = await client.fetchLaunch(mint);
      expect(client.stateOf(launch)).to.equal("fogged");
      expect(launch.fogTick).to.equal(1);

      // tick 1 of 3: r % 2 == 1 → still closed
      await sleep(1200);
      await send([await client.fogRequest(admin.publicKey, mint)]);
      await send([await client.mockFulfill(admin.publicKey, fogSeed(mint, 1), u64Bytes(7n))]);
      await send([await client.fogResolve(mint)]);
      launch = await client.fetchLaunch(mint);
      expect(launch.fogTick).to.equal(2);

      // last tick always opens
      await sleep(1200);
      await send([await client.fogRequest(admin.publicKey, mint)]);
      await send([await client.mockFulfill(admin.publicKey, fogSeed(mint, 2), u64Bytes(12345n))]);
      await send([await client.fogResolve(mint)]);
      launch = await client.fetchLaunch(mint);
      expect(client.stateOf(launch)).to.equal("trading");
      const vault = await client.fetchVault(mint);
      expect(vault.vestStart.toNumber()).to.equal(launch.openedAt.toNumber());
    });
  });

  describe("trading and fees", () => {
    it("buys with slippage protection and routes fees", async () => {
      const launch = await client.fetchLaunch(mint);
      const q = quoteBuy(curveOf(launch), 5n * SOL, 100);
      await expectError(
        sendAs(trader, [await client.buy(trader.publicKey, mint, 5n * SOL, q.tokensOut + 1n)]),
        "SlippageExceeded",
      );
      const feeBefore = await balance(feeRecipient.publicKey);
      const vaultBefore = await client.fetchVault(mint);
      await sendAs(trader, [await client.buy(trader.publicKey, mint, 5n * SOL, q.tokensOut)]);
      expect(await tokenBalance(mint, trader.publicKey)).to.equal(q.tokensOut);

      const fee = q.fee; // 1%: 0.6% protocol, 0.4% creator
      const creatorPart = (fee * 40n) / 100n;
      expect((await balance(feeRecipient.publicKey)) - feeBefore).to.equal(fee - creatorPart);
      const vault = await client.fetchVault(mint);
      expect(BigInt(vault.feeClaimable.toString()) - BigInt(vaultBefore.feeClaimable.toString())).to.equal(creatorPart);
    });

    it("sells at exactly the quoted price, net of fees", async () => {
      const held = await tokenBalance(mint, trader.publicKey);
      const q = quoteSell(curveOf(await client.fetchLaunch(mint)), held / 2n, 100)!;
      await expectError(
        sendAs(trader, [await client.sell(trader.publicKey, mint, held / 2n, q.solOut + 1n)]),
        "SlippageExceeded",
      );
      const before = await balance(trader.publicKey);
      const sig = await sendAs(trader, [await client.sell(trader.publicKey, mint, held / 2n, q.solOut)]);
      const tx = await conn.getTransaction(sig, { commitment: "confirmed", maxSupportedTransactionVersion: 0 });
      const got = (await balance(trader.publicKey)) - before + BigInt(tx!.meta!.fee);
      expect(got).to.equal(q.solOut);
      expect(await tokenBalance(mint, trader.publicKey)).to.equal(held - held / 2n);
    });
  });

  describe("dev vault", () => {
    it("withdrawing drops the fee coefficient to staked / peak", async () => {
      const vault = await client.fetchVault(mint);
      const half = BigInt(vault.peak.toString()) / 2n;
      // Only the dice-freed 33% (+ a sliver of vesting) is unlocked right after opening.
      await expectError(
        sendAs(creator, [await client.withdrawFromVault(creator.publicKey, mint, half)]),
        "ExceedsUnlocked",
      );
      const liquid = BigInt(vault.liquidTotal.toString());
      await sendAs(creator, [await client.withdrawFromVault(creator.publicKey, mint, liquid)]);
      const after = await client.fetchVault(mint);
      const expected = Number((BigInt(after.staked.toString()) * 10_000n) / BigInt(after.peak.toString()));
      expect(after.coefBps).to.equal(expected);
      expect(after.coefBps).to.be.lessThan(10_000);
    });

    it("tokens sent back into the vault never restore the coefficient", async () => {
      const before = await client.fetchVault(mint);
      const back = await tokenBalance(mint, creator.publicKey);
      await sendAs(creator, [
        createTransferCheckedInstruction(
          getAssociatedTokenAddressSync(mint, creator.publicKey, true, TOKEN_2022_PROGRAM_ID),
          mint,
          getAssociatedTokenAddressSync(mint, vaultPda(mint), true, TOKEN_2022_PROGRAM_ID),
          creator.publicKey,
          back,
          6,
          [],
          TOKEN_2022_PROGRAM_ID,
        ),
      ]);
      const vault = await client.fetchVault(mint);
      expect(vault.staked.toString()).to.equal(before.staked.toString());
      expect(vault.coefBps).to.equal(before.coefBps);
    });

    it("forfeited creator fees flow to holders", async () => {
      const vault = await client.fetchVault(mint);
      const poolBefore = await client.fetchHolderPool(mint);
      const launch = await client.fetchLaunch(mint);
      const q = quoteBuy(curveOf(launch), 3n * SOL, 100);
      await sendAs(holderB, [await client.buy(holderB.publicKey, mint, 3n * SOL, 0n)]);
      const creatorPart = (q.fee * 40n) / 100n;
      const devPart = (creatorPart * BigInt(vault.coefBps)) / 10_000n;
      const pool = await client.fetchHolderPool(mint);
      expect(BigInt(pool.totalReceived.toString()) - BigInt(poolBefore.totalReceived.toString())).to.equal(
        creatorPart - devPart,
      );
    });

    it("dev claims kept fees exactly once", async () => {
      const vault = await client.fetchVault(mint);
      const before = await balance(creator.publicKey);
      const sig = await sendAs(creator, [await client.claimDevFees(creator.publicKey, mint)]);
      const tx = await conn.getTransaction(sig, { commitment: "confirmed", maxSupportedTransactionVersion: 0 });
      const got = (await balance(creator.publicKey)) - before + BigInt(tx!.meta!.fee);
      expect(got).to.equal(BigInt(vault.feeClaimable.toString()));
      await expectError(sendAs(creator, [await client.claimDevFees(creator.publicKey, mint)]), "NothingToClaim");
    });

    it("only the creator can withdraw", async () => {
      const ix = await client.withdrawFromVault(trader.publicKey, mint, 1n);
      await expectError(sendAs(trader, [ix]), "Error");
    });
  });

  describe("holder rewards", () => {
    it("pays a merkle epoch once per holder", async () => {
      const pool = await client.fetchHolderPool(mint);
      const available = BigInt(pool.totalReceived.toString()) - BigInt(pool.totalAllocated.toString());
      expect(available > 0n).to.equal(true);
      const a = available / 3n;
      const b = available / 3n;
      const tree = new HolderMerkleTree([
        { holder: trader.publicKey, amount: a },
        { holder: holderB.publicKey, amount: b },
      ]);
      await expectError(
        send([await client.postHolderEpoch(merkleAuthority.publicKey, mint, available + 1n, tree.root, 1n)]),
        "ExceedsUnallocated",
      );
      await send([await client.postHolderEpoch(merkleAuthority.publicKey, mint, a + b, tree.root, 1n)]);

      await expectError(
        sendAs(holderB, [await client.claimHolderReward(holderB.publicKey, mint, 0, b + 1n, tree.proof(1))]),
        "InvalidProof",
      );
      const before = await balance(holderB.publicKey);
      await sendAs(holderB, [await client.claimHolderReward(holderB.publicKey, mint, 0, b, tree.proof(1))]);
      expect((await balance(holderB.publicKey)) > before - 10_000_000n).to.equal(true);
      await expectError(
        sendAs(holderB, [await client.claimHolderReward(holderB.publicKey, mint, 0, b, tree.proof(1))]),
        "already in use",
      );
      const after = await client.fetchHolderPool(mint);
      expect(after.totalClaimed.toString()).to.equal(b.toString());
    });
  });

  describe("refund", () => {
    it("refunds the dev only if the VRF never answered", async () => {
      const m = await newLaunch(SOL);
      await expectError(send([await client.refundLaunch(m)]), "NotTimedOut");
      await sleep(2500);
      const before = await balance(creator.publicKey);
      await send([await client.refundLaunch(m)]);
      expect((await balance(creator.publicKey)) - before).to.equal(SOL);
      expect(client.stateOf(await client.fetchLaunch(m))).to.equal("cancelled");
    });
  });

  describe("graduation", () => {
    const ammIndex = 0;
    const ammConfig = PublicKey.findProgramAddressSync(
      [Buffer.from("amm_config"), Buffer.from([ammIndex >> 8, ammIndex & 0xff])],
      CPMM_PROGRAM_ID.mainnet,
    )[0];

    before(async () => {
      const disc = createHash("sha256").update("global:create_amm_config").digest().subarray(0, 8);
      const data = Buffer.alloc(8 + 2 + 8 * 5);
      disc.copy(data, 0);
      data.writeUInt16LE(ammIndex, 8);
      data.writeBigUInt64LE(2500n, 10); // trade fee 0.25%
      data.writeBigUInt64LE(120000n, 18); // protocol share
      data.writeBigUInt64LE(40000n, 26); // fund share
      data.writeBigUInt64LE(150_000_000n, 34); // 0.15 SOL create fee
      data.writeBigUInt64LE(0n, 42); // creator fee
      await send([
        new TransactionInstruction({
          programId: CPMM_PROGRAM_ID.mainnet,
          keys: [
            { pubkey: admin.publicKey, isSigner: true, isWritable: true },
            { pubkey: ammConfig, isSigner: false, isWritable: true },
            { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
          ],
          data,
        }),
      ]);
    });

    it("completes the curve, then migrates to CPMM and burns all LP", async () => {
      await sendAs(trader, [await client.buy(trader.publicKey, mint, 200n * SOL, 0n)]);
      const launch = await client.fetchLaunch(mint);
      expect(client.stateOf(launch)).to.equal("complete");
      expect(launch.realTokens.toString()).to.equal("0");
      await expectError(sendAs(holderB, [await client.buy(holderB.publicKey, mint, SOL, 0n)]), "InvalidState");

      const realSol = BigInt(launch.realSol.toString());
      const feeBefore = await balance(feeRecipient.publicKey);
      await send(
        await client.graduate(admin.publicKey, mint, {
          ammConfig,
          cpmmProgram: CPMM_PROGRAM_ID.mainnet,
          createPoolFee: CPMM_CREATE_POOL_FEE_RECEIVER.mainnet,
        }),
      );

      const after = await client.fetchLaunch(mint);
      expect(client.stateOf(after)).to.equal("graduated");
      const cp = cpmmAccounts({ ammConfig, mint, wsolMint: NATIVE_MINT });
      expect(after.pool.toBase58()).to.equal(cp.poolState.toBase58());

      const lp = await getMint(conn, cp.lpMint, "confirmed", TOKEN_PROGRAM_ID);
      expect(lp.supply).to.equal(0n);

      const tokenIs0 = cp.token0.equals(mint);
      const tokVault = await getAccount(conn, tokenIs0 ? cp.token0Vault : cp.token1Vault, "confirmed", TOKEN_2022_PROGRAM_ID);
      const solVault = await getAccount(conn, tokenIs0 ? cp.token1Vault : cp.token0Vault, "confirmed", TOKEN_PROGRAM_ID);
      expect(tokVault.amount).to.equal(206_900_000n * TOK);
      const expectedSol = realSol - BigInt(params.migrationFee.toString()) - BigInt(params.migrationBudget.toString());
      expect(solVault.amount).to.equal(expectedSol);

      // Protocol got its migration fee plus the unspent pool-creation budget.
      const feeGain = (await balance(feeRecipient.publicKey)) - feeBefore;
      expect(feeGain >= BigInt(params.migrationFee.toString())).to.equal(true);
      // The launch keeps only its rent; the holder pool keeps unclaimed rewards.
      expect((await balance(launchPda(mint))) < SOL / 100n).to.equal(true);
      expect((await balance(holderPoolPda(mint))) > 0n).to.equal(true);
    });
  });
});
