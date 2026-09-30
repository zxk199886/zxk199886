"use client";

import Link from "next/link";
import { TokenAvatar } from "@/components/LaunchTable";
import { StatePill } from "@/components/StatePill";
import { useUnknown } from "@/lib/chain";
import { pct, sol } from "@/lib/format";
import { useLaunches } from "@/lib/hooks";

export default function VaultPage() {
  const { wallet } = useUnknown();
  const { data } = useLaunches("new");
  const mine = (data ?? []).filter((l) => wallet.publicKey && l.creator === wallet.publicKey.toBase58());

  return (
    <div className="flex flex-col gap-8 pt-12">
      <div>
        <p className="label">Dev vault</p>
        <h1 className="mt-2 text-4xl font-medium tracking-[-0.03em]">Your launches</h1>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted">
          Tokens you keep in the vault earn creator fees. Every withdrawal lowers your share for good; what you give
          up is paid to your holders.
        </p>
      </div>

      {!wallet.publicKey ? (
        <p className="panel px-6 py-10 text-sm text-muted">Connect the wallet you launched with.</p>
      ) : mine.length === 0 ? (
        <div className="panel flex flex-col items-start gap-3 px-6 py-10">
          <p className="text-sm text-muted">This wallet hasn’t launched anything yet.</p>
          <Link href="/create" className="btn btn-primary">
            Create a token
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {mine.map((l) => (
            <Link key={l.mint} href={`/token/${l.mint}`} className="panel flex flex-col gap-5 p-5 transition-colors hover:border-line-strong">
              <div className="flex items-center gap-3">
                <TokenAvatar row={l} size={40} />
                <div className="min-w-0">
                  <p className="truncate text-sm">{l.name}</p>
                  <StatePill state={l.state} />
                </div>
              </div>
              <div>
                <div className="flex items-baseline justify-between">
                  <span className="text-xs text-muted">Fee share</span>
                  <span className="num">{pct(l.coef_bps)}</span>
                </div>
                <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-raised">
                  <div className="h-full bg-fg/80" style={{ width: `${l.coef_bps / 100}%` }} />
                </div>
              </div>
              <dl className="num grid grid-cols-2 gap-y-1 text-xs">
                <dt className="text-faint">Dice</dt>
                <dd className="text-right">{l.d1 ? `${l.d1}+${l.d2} · ${pct(l.liquid_bps ?? 0)} free` : "rolling"}</dd>
                <dt className="text-faint">Volume</dt>
                <dd className="text-right">{sol(l.volume_sol, 2)} SOL</dd>
              </dl>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
