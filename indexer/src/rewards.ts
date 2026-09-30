import { NATIVE_MINT, TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import { PublicKey, Transaction, sendAndConfirmTransaction, type Connection, type Keypair } from "@solana/web3.js";
import {
  HolderMerkleTree,
  allocate,
  cpmmAccounts,
  launchPda,
  solVaultPda,
  vaultPda,
  type UnknownClient,
} from "@unknown/sdk";
import { config } from "./config";
import { kvGet, kvSet, type DB } from "./db";

/**
 * Pays forfeited creator fees to holders. Every epoch it snapshots token
 * balances, splits the unallocated pool pro-rata and posts a merkle root;
 * holders claim with the proofs served by the API.
 *
 * Excluded from the snapshot: the curve, the dev vault, the SOL vault, the
 * DEX pool and the creator's own wallet — the dev can't farm their own
 * forfeited fees.
 */
export class RewardsPublisher {
  private timer?: NodeJS.Timeout;

  constructor(
    private db: DB,
    private conn: Connection,
    private client: UnknownClient,
    private signer: Keypair,
  ) {}

  start() {
    const tick = async () => {
      try {
        await this.runOnce();
      } catch (e) {
        console.error("[rewards]", (e as Error).message);
      }
      this.timer = setTimeout(tick, 60_000);
    };
    void tick();
  }

  stop() {
    clearTimeout(this.timer);
  }

  async holders(mint: PublicKey, exclude: Set<string>) {
    const accounts = await this.conn.getProgramAccounts(TOKEN_2022_PROGRAM_ID, {
      commitment: "confirmed",
      filters: [{ memcmp: { offset: 0, bytes: mint.toBase58() } }],
    });
    const byOwner = new Map<string, bigint>();
    for (const { account } of accounts) {
      const owner = new PublicKey(account.data.subarray(32, 64)).toBase58();
      const amount = account.data.readBigUInt64LE(64);
      if (amount === 0n || exclude.has(owner)) continue;
      byOwner.set(owner, (byOwner.get(owner) ?? 0n) + amount);
    }
    return [...byOwner].map(([holder, balance]) => ({ holder: new PublicKey(holder), balance }));
  }

  async runOnce(force = false) {
    const cfg = await this.client.fetchConfig();
    if (!cfg.merkleAuthority.equals(this.signer.publicKey)) return;
    const now = Math.floor(Date.now() / 1000);
    for (const { account: l } of await this.client.fetchAllLaunches()) {
      const state = this.client.stateOf(l);
      if (state === "rolling" || state === "cancelled") continue;
      const mint = l.mint;
      const lastKey = `epoch_last:${mint.toBase58()}`;
      const last = Number(kvGet(this.db, lastKey) ?? 0);
      if (!force && now - last < config.epochIntervalSecs) continue;

      const pool = await this.client.fetchHolderPool(mint);
      const unallocated = BigInt(pool.totalReceived.toString()) - BigInt(pool.totalAllocated.toString());
      if (unallocated < config.minEpochLamports) continue;

      const exclude = new Set([
        launchPda(mint).toBase58(),
        vaultPda(mint).toBase58(),
        solVaultPda(mint).toBase58(),
        l.creator.toBase58(),
      ]);
      if (config.cpmm.ammConfig) {
        exclude.add(cpmmAccounts({ cpmmProgram: config.cpmm.program, ammConfig: config.cpmm.ammConfig, mint, wsolMint: NATIVE_MINT }).authority.toBase58());
      }
      const entries = allocate(await this.holders(mint, exclude), unallocated);
      if (entries.length === 0) continue;
      const total = entries.reduce((s, e) => s + e.amount, 0n);
      const tree = new HolderMerkleTree(entries);
      const slot = await this.conn.getSlot("confirmed");
      const index = pool.epochCount;

      const ix = await this.client.postHolderEpoch(this.signer.publicKey, mint, total, tree.root, BigInt(slot));
      await sendAndConfirmTransaction(this.conn, new Transaction().add(ix), [this.signer], { commitment: "confirmed" });

      const insert = this.db.prepare(
        "INSERT OR REPLACE INTO allocations (mint, idx, holder, amount, proof) VALUES (?, ?, ?, ?, ?)",
      );
      entries.forEach((e, i) =>
        insert.run(
          mint.toBase58(),
          index,
          e.holder.toBase58(),
          e.amount.toString(),
          JSON.stringify(tree.proof(i).map((p) => Buffer.from(p).toString("hex"))),
        ),
      );
      this.db
        .prepare("INSERT OR REPLACE INTO epochs (mint, idx, root, total, slot, posted_at) VALUES (?, ?, ?, ?, ?, ?)")
        .run(mint.toBase58(), index, Buffer.from(tree.root).toString("hex"), total.toString(), slot, now);
      kvSet(this.db, lastKey, String(now));
      console.log(`[rewards] epoch ${index} for ${mint.toBase58().slice(0, 6)}…: ${entries.length} holders, ${total} lamports`);
    }
  }
}

