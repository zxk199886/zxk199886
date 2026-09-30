"use client";

import { WalletReadyState } from "@solana/wallet-adapter-base";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import { useEffect, useRef, useState } from "react";
import { env } from "@/lib/env";
import { short } from "@/lib/format";
import { useToast } from "./Toast";

export function WalletButton() {
  const { wallets, wallet, publicKey, select, disconnect, connecting } = useWallet();
  const { connection } = useConnection();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [balance, setBalance] = useState<number>();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!publicKey) return setBalance(undefined);
    let live = true;
    const load = () => connection.getBalance(publicKey).then((b) => live && setBalance(b / LAMPORTS_PER_SOL)).catch(() => {});
    load();
    const id = connection.onAccountChange(publicKey, (a) => setBalance(a.lamports / LAMPORTS_PER_SOL));
    return () => {
      live = false;
      void connection.removeAccountChangeListener(id);
    };
  }, [publicKey, connection]);

  useEffect(() => {
    const close = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const available = wallets.filter(
    (w) => w.readyState === WalletReadyState.Installed || w.readyState === WalletReadyState.Loadable,
  );

  async function airdrop() {
    if (!publicKey) return;
    try {
      const sig = await connection.requestAirdrop(publicKey, 10 * LAMPORTS_PER_SOL);
      await connection.confirmTransaction(sig, "confirmed");
      toast({ tone: "ok", text: "Airdropped 10 SOL." });
    } catch (e) {
      toast({ tone: "error", text: `Airdrop failed: ${(e as Error).message}` });
    }
  }

  return (
    <div className="relative" ref={ref}>
      {publicKey ? (
        <button className="btn btn-ghost num text-xs" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          <span className="size-1.5 rounded-full bg-up" />
          {short(publicKey.toBase58())}
          {balance !== undefined && <span className="text-muted">{balance.toFixed(2)} SOL</span>}
        </button>
      ) : (
        <button className="btn btn-primary" onClick={() => setOpen((o) => !o)} aria-expanded={open} disabled={connecting}>
          {connecting ? "Connecting…" : "Connect"}
        </button>
      )}

      {open && (
        <div className="panel absolute right-0 top-12 z-50 w-64 p-2 shadow-2xl">
          {publicKey ? (
            <div className="flex flex-col gap-1">
              <p className="label px-3 pt-2">{wallet?.adapter.name}</p>
              <button
                className="rounded-lg px-3 py-2 text-left text-sm hover:bg-raised"
                onClick={() => {
                  void navigator.clipboard?.writeText(publicKey.toBase58()).catch(() => {});
                  toast({ tone: "info", text: "Address copied." });
                  setOpen(false);
                }}
              >
                Copy address
              </button>
              {env.cluster !== "mainnet" && (
                <button className="rounded-lg px-3 py-2 text-left text-sm hover:bg-raised" onClick={airdrop}>
                  Airdrop 10 SOL <span className="label ml-1">{env.cluster}</span>
                </button>
              )}
              <button
                className="rounded-lg px-3 py-2 text-left text-sm text-down hover:bg-raised"
                onClick={() => {
                  void disconnect();
                  setOpen(false);
                }}
              >
                Disconnect
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              <p className="label px-3 pt-2">Choose a wallet</p>
              {available.length === 0 && (
                <p className="px-3 py-2 text-sm text-muted">No Solana wallet found. Install Phantom, Solflare or Backpack.</p>
              )}
              {available.map((w) => (
                <button
                  key={w.adapter.name}
                  className="flex items-center gap-3 rounded-lg px-3 py-2 text-left text-sm hover:bg-raised"
                  onClick={() => {
                    select(w.adapter.name);
                    setOpen(false);
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={w.adapter.icon} alt="" className="size-5 rounded" />
                  {w.adapter.name === "Burner Wallet" ? "Burner wallet (local only)" : w.adapter.name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
