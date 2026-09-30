import { BN, EventParser } from "@coral-xyz/anchor";
import { PublicKey, type Connection, type Logs } from "@solana/web3.js";
import { PROGRAM_ID, launchStateName, type UnknownClient } from "@unknown/sdk";
import { kvGet, kvSet, type DB } from "./db";

export interface ChainEvent {
  kind: string;
  mint: string | null;
  data: Record<string, unknown>;
  sig: string;
  slot: number;
  ts: number;
}

type Listener = (e: ChainEvent) => void;

const camel = (s: string) => s.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase());
const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

/** BN → decimal string, PublicKey → base58, snake_case keys → camelCase. */
export function toJson(v: unknown): unknown {
  if (BN.isBN(v)) return (v as BN).toString();
  if (v instanceof PublicKey) return v.toBase58();
  if (Array.isArray(v)) return v.map(toJson);
  if (v && typeof v === "object")
    return Object.fromEntries(Object.entries(v).map(([k, x]) => [camel(k), toJson(x)]));
  return v;
}

const priceOf = (vs: string, vt: string) => Number(vs) / 1e9 / (Number(vt) / 1e6);

export class Ingestor {
  private parser: EventParser;
  private listeners = new Set<Listener>();
  private refreshQueue = new Set<string>();

  constructor(
    private db: DB,
    private conn: Connection,
    private client: UnknownClient,
  ) {
    this.parser = new EventParser(PROGRAM_ID, client.program.coder);
  }

  onEvent(fn: Listener) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  /** Replays history newer than the last processed signature, oldest first. */
  async backfill() {
    const until = kvGet(this.db, "last_sig");
    const sigs: { signature: string; slot: number; err: unknown }[] = [];
    let before: string | undefined;
    for (;;) {
      const page = await this.conn.getSignaturesForAddress(PROGRAM_ID, { before, until, limit: 1000 }, "confirmed");
      sigs.push(...page);
      if (page.length < 1000) break;
      before = page[page.length - 1].signature;
    }
    for (const s of sigs.reverse()) {
      if (s.err) continue;
      const tx = await this.conn.getTransaction(s.signature, { commitment: "confirmed", maxSupportedTransactionVersion: 0 });
      if (!tx?.meta?.logMessages) continue;
      this.handleLogs(s.signature, tx.slot, tx.blockTime ?? Math.floor(Date.now() / 1000), tx.meta.logMessages);
    }
    await this.flushRefreshes();
    console.log(`[ingest] backfilled ${sigs.length} transactions`);
  }

  subscribe() {
    return this.conn.onLogs(
      PROGRAM_ID,
      (logs: Logs, ctx) => {
        if (logs.err) return;
        this.handleLogs(logs.signature, ctx.slot, Math.floor(Date.now() / 1000), logs.logs);
        void this.flushRefreshes();
      },
      "confirmed",
    );
  }

  handleLogs(sig: string, slot: number, ts: number, logs: string[]) {
    let ix = 0;
    for (const ev of this.parser.parseLogs(logs)) {
      const data = toJson(ev.data) as Record<string, unknown>;
      const mint = typeof data.mint === "string" ? data.mint : null;
      const at = typeof data.timestamp === "string" ? Number(data.timestamp) : ts;
      const e: ChainEvent = { kind: lowerFirst(ev.name), mint, data, sig, slot, ts: at };
      const inserted = this.db
        .prepare("INSERT OR IGNORE INTO events (sig, ix, mint, kind, data, ts, slot) VALUES (?, ?, ?, ?, ?, ?, ?)")
        .run(sig, ix, mint, e.kind, JSON.stringify(data), at, slot);
      if (inserted.changes > 0) {
        this.apply(e, ix);
        for (const l of this.listeners) l(e);
      }
      ix++;
    }
    kvSet(this.db, "last_sig", sig);
  }

  private apply(e: ChainEvent, ix: number) {
    const d = e.data as Record<string, string & number & boolean>;
    switch (e.kind) {
      case "launchCreated":
        this.db
          .prepare(
            `INSERT OR IGNORE INTO launches (mint, creator, name, symbol, uri, created_at, dev_buy, state, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, 'rolling', ?)`,
          )
          .run(d.mint, d.creator, d.name, d.symbol, d.uri, e.ts, d.devBuyLamports, e.ts);
        void this.fetchOffchainMetadata(d.mint, d.uri);
        break;
      case "diceRolled":
        this.db
          .prepare("UPDATE launches SET d1 = ?, d2 = ?, liquid_bps = ?, state = 'fogged', updated_at = ? WHERE mint = ?")
          .run(d.d1, d.d2, d.liquidBps, e.ts, d.mint);
        break;
      case "trade":
        this.db
          .prepare(
            `INSERT OR IGNORE INTO trades (sig, ix, mint, trader, is_buy, sol, tokens, price, ts, slot)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .run(e.sig, ix, d.mint, d.trader, d.isBuy ? 1 : 0, d.solAmount, d.tokenAmount, priceOf(d.virtualSol, d.virtualTokens), e.ts, e.slot);
        this.db
          .prepare(
            `UPDATE launches SET virtual_sol = ?, virtual_tokens = ?, real_sol = ?, real_tokens = ?,
             volume_sol = CAST(CAST(volume_sol AS INTEGER) + ? AS TEXT), updated_at = ? WHERE mint = ?`,
          )
          .run(d.virtualSol, d.virtualTokens, d.realSol, d.realTokens, Number(d.solAmount), e.ts, d.mint);
        break;
      case "holderEpochPosted":
        break;
      case "holderRewardClaimed":
        this.db
          .prepare("UPDATE allocations SET claimed = 1 WHERE mint = ? AND idx = ? AND holder = ?")
          .run(d.mint, d.index, d.holder);
        break;
    }
    if (e.mint) this.refreshQueue.add(e.mint);
  }

  /** Re-reads launch + vault accounts so derived columns always match chain state. */
  async flushRefreshes() {
    const mints = [...this.refreshQueue];
    this.refreshQueue.clear();
    await Promise.all(mints.map((m) => this.refreshLaunch(new PublicKey(m)).catch(() => undefined)));
  }

  async refreshLaunch(mint: PublicKey) {
    const [l, v] = await Promise.all([this.client.fetchLaunch(mint), this.client.fetchVault(mint)]);
    this.db
      .prepare(
        `UPDATE launches SET state = ?, fog_tick = ?, opened_at = ?, completed_at = ?, graduated_at = ?, pool = ?,
         virtual_sol = ?, virtual_tokens = ?, real_sol = ?, real_tokens = ?, volume_sol = ?, coef_bps = ?,
         d1 = NULLIF(?, 0), d2 = NULLIF(?, 0), liquid_bps = NULLIF(?, 0), updated_at = ? WHERE mint = ?`,
      )
      .run(
        launchStateName(l.state as Record<string, unknown>),
        l.fogTick,
        l.openedAt.toNumber() || null,
        l.completedAt.toNumber() || null,
        l.graduatedAt.toNumber() || null,
        l.pool.equals(PublicKey.default) ? null : l.pool.toBase58(),
        l.virtualSol.toString(),
        l.virtualTokens.toString(),
        l.realSol.toString(),
        l.realTokens.toString(),
        l.volumeSol.toString(),
        v.coefBps,
        l.d1,
        l.d2,
        l.liquidBps,
        Math.floor(Date.now() / 1000),
        mint.toBase58(),
      );
  }

  private async fetchOffchainMetadata(mint: string, uri: string) {
    try {
      if (!/^https?:\/\//.test(uri)) return;
      const res = await fetch(uri, { signal: AbortSignal.timeout(5000) });
      const json = (await res.json()) as { image?: string; description?: string };
      this.db
        .prepare("UPDATE launches SET image = ?, description = ? WHERE mint = ?")
        .run(json.image ?? null, json.description ?? null, mint);
    } catch {
      /* metadata is best-effort */
    }
  }
}
