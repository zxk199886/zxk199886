import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import type { DB } from "./db";
import type { ChainEvent, Ingestor } from "./ingest";

const TOTAL_SUPPLY_TOKENS = 1_000_000_000;

interface LaunchRow {
  mint: string;
  creator: string;
  name: string;
  symbol: string;
  uri: string;
  image: string | null;
  description: string | null;
  created_at: number;
  dev_buy: string;
  state: string;
  d1: number | null;
  d2: number | null;
  liquid_bps: number | null;
  fog_tick: number;
  opened_at: number | null;
  completed_at: number | null;
  graduated_at: number | null;
  pool: string | null;
  virtual_sol: string | null;
  virtual_tokens: string | null;
  real_sol: string | null;
  real_tokens: string | null;
  volume_sol: string;
  coef_bps: number;
}

export interface ApiOptions {
  curveSupply: bigint;
  publicUrl: string;
  meta: Record<string, unknown>;
}

function present(r: LaunchRow, curveSupply: bigint) {
  const vs = Number(r.virtual_sol ?? 0);
  const vt = Number(r.virtual_tokens ?? 1);
  const price = vs && vt ? vs / 1e9 / (vt / 1e6) : 0;
  const realTokens = r.real_tokens ? BigInt(r.real_tokens) : curveSupply;
  // While fogged, nobody sees the price: only the dice are public.
  const fogged = r.state === "rolling" || r.state === "fogged";
  return {
    ...r,
    price: fogged ? null : price,
    market_cap_sol: fogged ? null : price * TOTAL_SUPPLY_TOKENS,
    progress: curveSupply > 0n ? 1 - Number(realTokens) / Number(curveSupply) : 0,
  };
}

function send(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { "content-type": "application/json", "access-control-allow-origin": "*" });
  res.end(JSON.stringify(body));
}

async function readBody(req: IncomingMessage, limit = 600_000): Promise<string> {
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const c of req) {
    size += (c as Buffer).length;
    if (size > limit) throw new Error("body too large");
    chunks.push(c as Buffer);
  }
  return Buffer.concat(chunks).toString("utf8");
}

export function buildCandles(trades: { ts: number; price: number; sol: string }[], interval: number) {
  const out: { time: number; open: number; high: number; low: number; close: number; volume: number }[] = [];
  for (const t of trades) {
    const time = Math.floor(t.ts / interval) * interval;
    const last = out[out.length - 1];
    const vol = Number(t.sol) / 1e9;
    if (last && last.time === time) {
      last.high = Math.max(last.high, t.price);
      last.low = Math.min(last.low, t.price);
      last.close = t.price;
      last.volume += vol;
    } else {
      const open = last ? last.close : t.price;
      out.push({ time, open, high: Math.max(open, t.price), low: Math.min(open, t.price), close: t.price, volume: vol });
    }
  }
  return out;
}

export function startApi(db: DB, ingestor: Ingestor, port: number, opts: ApiOptions) {
  const streams = new Set<{ res: ServerResponse; mint: string | null }>();
  ingestor.onEvent((e: ChainEvent) => {
    const line = `event: chain\ndata: ${JSON.stringify(e)}\n\n`;
    for (const s of streams) if (!s.mint || s.mint === e.mint) s.res.write(line);
  });

  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? "/", "http://x");
      const parts = url.pathname.split("/").filter(Boolean);
      if (req.method === "OPTIONS") {
        res.writeHead(204, {
          "access-control-allow-origin": "*",
          "access-control-allow-methods": "GET, POST",
          "access-control-allow-headers": "content-type",
        });
        return res.end();
      }

      if (url.pathname === "/api/health") return send(res, 200, { ok: true });
      if (url.pathname === "/api/meta") return send(res, 200, opts.meta);

      if (url.pathname === "/api/stream") {
        res.writeHead(200, {
          "content-type": "text/event-stream",
          "cache-control": "no-cache",
          connection: "keep-alive",
          "access-control-allow-origin": "*",
        });
        res.write(": connected\n\n");
        const s = { res, mint: url.searchParams.get("mint") };
        streams.add(s);
        const ping = setInterval(() => res.write(": ping\n\n"), 15_000);
        req.on("close", () => {
          clearInterval(ping);
          streams.delete(s);
        });
        return;
      }

      if (parts[0] === "api" && parts[1] === "launches" && parts.length === 2) {
        const sort = url.searchParams.get("sort") ?? "new";
        const order =
          sort === "volume"
            ? "CAST(volume_sol AS INTEGER) DESC"
            : sort === "progress"
              ? "CAST(real_tokens AS INTEGER) ASC"
              : "created_at DESC";
        const rows = db.prepare(`SELECT * FROM launches ORDER BY ${order} LIMIT 200`).all() as unknown as LaunchRow[];
        return send(res, 200, rows.map((r) => present(r, opts.curveSupply)));
      }

      if (parts[0] === "api" && parts[1] === "launches" && parts[2]) {
        const mint = parts[2];
        if (parts.length === 3) {
          const row = db.prepare("SELECT * FROM launches WHERE mint = ?").get(mint) as unknown as LaunchRow | undefined;
          return row ? send(res, 200, present(row, opts.curveSupply)) : send(res, 404, { error: "not found" });
        }
        if (parts[3] === "trades") {
          const limit = Math.min(Number(url.searchParams.get("limit") ?? 50), 500);
          const rows = db
            .prepare("SELECT * FROM trades WHERE mint = ? ORDER BY ts DESC, slot DESC LIMIT ?")
            .all(mint, limit);
          return send(res, 200, rows);
        }
        if (parts[3] === "candles") {
          const interval = Math.max(Number(url.searchParams.get("interval") ?? 60), 1);
          const rows = db
            .prepare("SELECT ts, price, sol FROM trades WHERE mint = ? ORDER BY ts ASC, slot ASC")
            .all(mint) as unknown as { ts: number; price: number; sol: string }[];
          return send(res, 200, buildCandles(rows, interval));
        }
        if (parts[3] === "events") {
          const rows = db
            .prepare("SELECT kind, data, ts, sig FROM events WHERE mint = ? AND kind != 'trade' ORDER BY ts ASC, slot ASC")
            .all(mint) as unknown as { kind: string; data: string; ts: number; sig: string }[];
          return send(res, 200, rows.map((r) => ({ ...r, data: JSON.parse(r.data) })));
        }
      }

      if (parts[0] === "api" && parts[1] === "rewards" && parts[2]) {
        const rows = db
          .prepare(
            `SELECT a.mint, a.idx, a.amount, a.proof, a.claimed, l.name, l.symbol
             FROM allocations a LEFT JOIN launches l ON l.mint = a.mint
             WHERE a.holder = ? ORDER BY a.claimed ASC, a.mint, a.idx`,
          )
          .all(parts[2]) as unknown as { proof: string }[];
        return send(res, 200, rows.map((r) => ({ ...r, proof: JSON.parse(r.proof) })));
      }

      if (url.pathname === "/api/metadata" && req.method === "POST") {
        const body = JSON.parse(await readBody(req)) as {
          name: string;
          symbol: string;
          description?: string;
          image?: string;
        };
        const id = randomUUID();
        let image: Buffer | null = null;
        let mime: string | null = null;
        let imageUrl = body.image ?? "";
        const m = /^data:(image\/(?:png|jpeg|gif|webp|svg\+xml));base64,(.+)$/.exec(body.image ?? "");
        if (m) {
          mime = m[1];
          image = Buffer.from(m[2], "base64");
          imageUrl = `${opts.publicUrl}/metadata/${id}/image`;
        }
        const json = {
          name: String(body.name).slice(0, 32),
          symbol: String(body.symbol).slice(0, 10),
          description: String(body.description ?? "").slice(0, 500),
          image: imageUrl,
        };
        db.prepare("INSERT INTO metadata (id, json, image, mime) VALUES (?, ?, ?, ?)").run(id, JSON.stringify(json), image, mime);
        return send(res, 200, { uri: `${opts.publicUrl}/metadata/${id}.json`, image: imageUrl });
      }

      if (parts[0] === "metadata" && parts[1]) {
        const id = parts[1].replace(/\.json$/, "");
        const row = db.prepare("SELECT json, image, mime FROM metadata WHERE id = ?").get(id) as
          | { json: string; image: Uint8Array | null; mime: string | null }
          | undefined;
        if (!row) return send(res, 404, { error: "not found" });
        if (parts[2] === "image" && row.image) {
          res.writeHead(200, {
            "content-type": row.mime ?? "application/octet-stream",
            "cache-control": "public, max-age=31536000, immutable",
            "access-control-allow-origin": "*",
          });
          return res.end(Buffer.from(row.image));
        }
        res.writeHead(200, { "content-type": "application/json", "access-control-allow-origin": "*" });
        return res.end(row.json);
      }

      send(res, 404, { error: "not found" });
    } catch (e) {
      send(res, 500, { error: (e as Error).message });
    }
  });
  server.listen(port, () => console.log(`[api] listening on :${port}`));
  return server;
}
