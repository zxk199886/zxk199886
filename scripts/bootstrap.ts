/**
 * One-time cluster setup: program config (+ a Raydium CPMM AmmConfig on
 * localnet, where we are its admin).
 *
 *   pnpm bootstrap              # localnet, demo-speed fog
 *   CLUSTER=devnet RPC_URL=... pnpm bootstrap
 */
import { AnchorProvider, BN, Wallet } from "@coral-xyz/anchor";
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { CPMM_PROGRAM_ID, UnknownClient, configPda } from "@unknown/sdk";

const cluster = (process.env.CLUSTER ?? "localnet") as "localnet" | "devnet";
const rpc = process.env.RPC_URL ?? (cluster === "devnet" ? "https://api.devnet.solana.com" : "http://127.0.0.1:8899");
const keypath = (process.env.KEYPAIR ?? "~/.config/solana/id.json").replace(/^~/, homedir());
const admin = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(keypath, "utf8"))));
const conn = new Connection(rpc, "confirmed");
const client = new UnknownClient(new AnchorProvider(conn, new Wallet(admin), {}), cluster === "localnet" ? "mock" : "orao");
const SOL = 1_000_000_000n;
const TOK = 1_000_000n;
const cpmm = cluster === "devnet" ? CPMM_PROGRAM_ID.devnet : CPMM_PROGRAM_ID.mainnet;

async function main() {
  if (!(await conn.getAccountInfo(configPda()))) {
    const demo = cluster === "localnet";
    const ix = await client.initializeConfig(admin.publicKey, {
      feeRecipient: new PublicKey(process.env.FEE_RECIPIENT ?? admin.publicKey.toBase58()),
      merkleAuthority: new PublicKey(process.env.MERKLE_AUTHORITY ?? admin.publicKey.toBase58()),
      cpmmProgram: cpmm,
      protocolFeeBps: 60,
      creatorFeeBps: 40,
      initialVirtualSol: new BN((30n * SOL).toString()),
      initialVirtualTokens: new BN((1_073_000_000n * TOK).toString()),
      curveSupply: new BN((793_100_000n * TOK).toString()),
      lpSupply: new BN((206_900_000n * TOK).toString()),
      minDevBuy: new BN((SOL / 10n).toString()),
      maxDevBuy: new BN((10n * SOL).toString()),
      // Production: 30 one-minute ticks. Local demo: 6 ticks of 10s.
      fogTickSecs: new BN(demo ? 10 : 60),
      fogMaxTicks: demo ? 6 : 30,
      vrfTimeoutSecs: new BN(demo ? 30 : 600),
      migrationFee: new BN((SOL / 2n).toString()),
      migrationBudget: new BN(((3n * SOL) / 10n).toString()),
      paused: false,
    });
    await sendAndConfirmTransaction(conn, new Transaction().add(ix), [admin]);
    console.log("config initialized", configPda().toBase58());
  } else {
    console.log("config exists", configPda().toBase58());
  }

  if (cluster === "localnet") {
    const index = 0;
    const ammConfig = PublicKey.findProgramAddressSync([Buffer.from("amm_config"), Buffer.from([0, index])], cpmm)[0];
    if (!(await conn.getAccountInfo(ammConfig))) {
      const data = Buffer.alloc(50);
      createHash("sha256").update("global:create_amm_config").digest().subarray(0, 8).copy(data, 0);
      data.writeUInt16LE(index, 8);
      data.writeBigUInt64LE(2500n, 10);
      data.writeBigUInt64LE(120000n, 18);
      data.writeBigUInt64LE(40000n, 26);
      data.writeBigUInt64LE(150_000_000n, 34);
      data.writeBigUInt64LE(0n, 42);
      const ix = new TransactionInstruction({
        programId: cpmm,
        keys: [
          { pubkey: admin.publicKey, isSigner: true, isWritable: true },
          { pubkey: ammConfig, isSigner: false, isWritable: true },
          { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
        ],
        data,
      });
      await sendAndConfirmTransaction(conn, new Transaction().add(ix), [admin]);
    }
    console.log(`CPMM_AMM_CONFIG=${ammConfig.toBase58()}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
