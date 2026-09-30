"use client";

import { PublicKey } from "@solana/web3.js";
import Link from "next/link";
import { useState } from "react";
import { useToast } from "@/components/Toast";
import { api } from "@/lib/api";
import { explain, useUnknown } from "@/lib/chain";
import { sol } from "@/lib/format";
import { useLive } from "@/lib/hooks";

const hex = (h: string) => Uint8Array.from(h.match(/../g)!.map((b) => parseInt(b, 16)));

export default function RewardsPage() {
  const { client, send, wallet } = useUnknown();
  const toast = useToast();
  const addr = wallet.publicKey?.toBase58();
  const { data, refresh } = useLive(() => (addr ? api.rewards(addr) : Promise.resolve([])), [addr]);
  const [busy, setBusy] = useState<string>();
  const open = (data ?? []).filter((r) => !r.claimed);
  const total = open.reduce((s, r) => s + BigInt(r.amount), 0n);

  async function claim(mint: string, idx: number, amount: string, proof: string[]) {
    setBusy(`${mint}-${idx}`);
    try {
      const ix = await client.claimHolderReward(wallet.publicKey!, new PublicKey(mint), idx, BigInt(amount), proof.map(hex));
      const sig = await send([ix]);
      toast({ tone: "ok", text: `Claimed ${sol(amount, 4)} SOL.`, sig });
      void refresh();
    } catch (e) {
      toast({ tone: "error", text: explain(e) });
    } finally {
      setBusy(undefined);
    }
  }

  return (
    <div className="flex flex-col gap-8 pt-12">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="label">Holder rewards</p>
          <h1 className="mt-2 text-4xl font-medium tracking-[-0.03em]">What the devs gave up</h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted">
            When a dev takes tokens out of their vault, part of every later creator fee comes to holders instead.
            Balances are snapshotted each epoch; claim your share here.
          </p>
        </div>
        {addr && (
          <div className="text-right">
            <p className="label">Unclaimed</p>
            <p className="num mt-1 text-3xl">{sol(total.toString(), 4)} SOL</p>
          </div>
        )}
      </div>

      {!addr ? (
        <p className="panel px-6 py-10 text-sm text-muted">Connect a wallet to see your rewards.</p>
      ) : (data ?? []).length === 0 ? (
        <div className="panel flex flex-col items-start gap-3 px-6 py-10">
          <p className="text-sm text-muted">Nothing to claim yet. Rewards appear after a dev withdraws and an epoch closes.</p>
          <Link href="/" className="btn btn-ghost">
            Browse launches
          </Link>
        </div>
      ) : (
        <div className="panel overflow-x-auto">
          <table className="num w-full min-w-[560px] text-left text-sm">
            <thead>
              <tr className="border-b hairline">
                {["Token", "Epoch", "Amount", ""].map((h) => (
                  <th key={h} className="label px-4 py-3 font-normal">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(data ?? []).map((r) => (
                <tr key={`${r.mint}-${r.idx}`} className="border-b hairline last:border-0">
                  <td className="px-4 py-3">
                    <Link href={`/token/${r.mint}`} className="hover:text-white">
                      {r.name ?? r.mint.slice(0, 6)} <span className="text-faint">${r.symbol}</span>
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted">#{r.idx}</td>
                  <td className="px-4 py-3">{sol(r.amount, 5)} SOL</td>
                  <td className="px-4 py-3 text-right">
                    {r.claimed ? (
                      <span className="label">claimed</span>
                    ) : (
                      <button
                        className="btn btn-ghost h-8 text-xs"
                        disabled={busy === `${r.mint}-${r.idx}`}
                        onClick={() => claim(r.mint, r.idx, r.amount, r.proof)}
                      >
                        {busy === `${r.mint}-${r.idx}` ? "Claiming…" : "Claim"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
