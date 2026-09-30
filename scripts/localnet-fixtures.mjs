// Generates validator fixtures for local graduation tests: Raydium CPMM's
// create-pool-fee receiver must exist as a WSOL token account at a fixed
// address baked into the CPMM binary.
import { writeFileSync, mkdirSync } from "node:fs";
import { PublicKey } from "@solana/web3.js";

const FEE_RECEIVER = new PublicKey("DNXgeM9EiiaAbaWvwjHj9fQQLAX5ZsfHyvmYUNRAdNC8");
const NATIVE_MINT = new PublicKey("So11111111111111111111111111111111111111112");
const TOKEN_PROGRAM = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const RENT_RESERVE = 2_039_280n;

const data = Buffer.alloc(165);
NATIVE_MINT.toBuffer().copy(data, 0); // mint
FEE_RECEIVER.toBuffer().copy(data, 32); // owner (any key works)
data.writeBigUInt64LE(0n, 64); // amount
data.writeUInt32LE(0, 72); // delegate: None
data[108] = 1; // state: Initialized
data.writeUInt32LE(1, 109); // is_native: Some
data.writeBigUInt64LE(RENT_RESERVE, 113);
data.writeBigUInt64LE(0n, 121); // delegated_amount
data.writeUInt32LE(0, 129); // close_authority: None

const out = new URL("../tests/fixtures/", import.meta.url);
mkdirSync(out, { recursive: true });
writeFileSync(
  new URL("cpmm-fee-receiver.json", out),
  JSON.stringify(
    {
      pubkey: FEE_RECEIVER.toBase58(),
      account: {
        lamports: Number(RENT_RESERVE),
        data: [data.toString("base64"), "base64"],
        owner: TOKEN_PROGRAM.toBase58(),
        executable: false,
        rentEpoch: 0,
        space: 165,
      },
    },
    null,
    2,
  ),
);
console.log("wrote tests/fixtures/cpmm-fee-receiver.json");
