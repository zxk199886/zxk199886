"use client";

import "./polyfill";
import { AnchorProvider } from "@coral-xyz/anchor";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import {
  ComputeBudgetProgram,
  PublicKey,
  Transaction,
  type Signer,
  type TransactionInstruction,
} from "@solana/web3.js";
import { UnknownClient } from "@unknown/sdk";
import { useCallback, useMemo } from "react";
import { env } from "./env";

const READONLY = new PublicKey("11111111111111111111111111111111");

/** A client for building instructions and reading accounts. Signing goes through the wallet. */
export function useUnknown() {
  const { connection } = useConnection();
  const wallet = useWallet();

  const client = useMemo(() => {
    const provider = new AnchorProvider(
      connection,
      {
        publicKey: wallet.publicKey ?? READONLY,
        signTransaction: async () => {
          throw new Error("use send()");
        },
        signAllTransactions: async () => {
          throw new Error("use send()");
        },
      },
      { commitment: "confirmed" },
    );
    return new UnknownClient(provider, env.vrfMode);
  }, [connection, wallet.publicKey]);

  const send = useCallback(
    async (ixs: TransactionInstruction[], signers: Signer[] = []) => {
      if (!wallet.publicKey) throw new Error("Connect a wallet first.");
      const tx = new Transaction();
      if (!ixs.some((ix) => ix.programId.equals(ComputeBudgetProgram.programId))) {
        tx.add(ComputeBudgetProgram.setComputeUnitLimit({ units: 300_000 }));
      }
      tx.add(...ixs);
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
      tx.recentBlockhash = blockhash;
      tx.feePayer = wallet.publicKey;
      const sig = await wallet.sendTransaction(tx, connection, { signers, skipPreflight: false });
      const res = await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, "confirmed");
      if (res.value.err) throw new Error(`Transaction failed: ${JSON.stringify(res.value.err)}`);
      return sig;
    },
    [connection, wallet],
  );

  return { client, send, connection, wallet };
}

/** Turns program/simulation errors into one readable line. */
export function explain(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  const code = /Error Message: ([^."]+)/.exec(msg)?.[1];
  if (code) return code;
  if (/User rejected/i.test(msg)) return "You cancelled the request in your wallet.";
  if (/insufficient (funds|lamports)/i.test(msg)) return "Not enough SOL in this wallet.";
  return msg.split("\n")[0].slice(0, 160);
}
