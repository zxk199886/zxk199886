import { Keypair, PublicKey } from "@solana/web3.js";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { CPMM_CREATE_POOL_FEE_RECEIVER, CPMM_PROGRAM_ID, type VrfMode } from "@unknown/sdk";

const env = (k: string, d?: string) => process.env[k] ?? d;
const num = (k: string, d: number) => Number(env(k) ?? d);

function loadKeypair(path: string): Keypair {
  const p = path.replace(/^~/, homedir());
  return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(p, "utf8"))));
}

const cluster = env("CLUSTER", "localnet") as "localnet" | "devnet" | "mainnet";
const cpmmNet = cluster === "devnet" ? "devnet" : "mainnet";

export const config = {
  cluster,
  rpcUrl: env("RPC_URL", "http://127.0.0.1:8899")!,
  wsUrl: env("WS_URL"),
  port: num("PORT", 8787),
  publicUrl: env("PUBLIC_URL", `http://localhost:${num("PORT", 8787)}`)!,
  dbPath: env("DB_PATH", "./data/unknown.db")!,
  /** Signs crank txs and holder epochs; must be config.merkle_authority to post epochs. */
  keypair: loadKeypair(env("KEYPAIR", "~/.config/solana/id.json")!),
  vrfMode: env("VRF_MODE", cluster === "localnet" ? "mock" : "orao") as VrfMode,
  crank: env("CRANK", "1") === "1",
  crankIntervalMs: num("CRANK_INTERVAL_MS", 2000),
  epochIntervalSecs: num("EPOCH_INTERVAL_SECS", 6 * 60 * 60),
  minEpochLamports: BigInt(env("MIN_EPOCH_LAMPORTS", "10000000")!),
  cpmm: {
    program: new PublicKey(env("CPMM_PROGRAM", CPMM_PROGRAM_ID[cpmmNet].toBase58())!),
    ammConfig: env("CPMM_AMM_CONFIG") ? new PublicKey(env("CPMM_AMM_CONFIG")!) : undefined,
    createPoolFee: new PublicKey(env("CPMM_FEE_RECEIVER", CPMM_CREATE_POOL_FEE_RECEIVER[cpmmNet].toBase58())!),
  },
};
