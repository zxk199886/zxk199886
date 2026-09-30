"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useState } from "react";
import { TokenAvatar } from "@/components/LaunchTable";
import { useRitual } from "@/components/rituals/RitualProvider";
import { StatePill } from "@/components/StatePill";
import { FogVeil } from "@/components/token/FogVeil";
import { PriceChart } from "@/components/token/PriceChart";
import { Timeline } from "@/components/token/Timeline";
import { TradePanel } from "@/components/token/TradePanel";
import { TradesFeed } from "@/components/token/TradesFeed";
import { VaultPanel } from "@/components/token/VaultPanel";
import { api, type ChainEvent, type TimelineEvent } from "@/lib/api";
import { env, explorerAccount } from "@/lib/env";
import { mcap, pct, short, sol } from "@/lib/format";
import { useChainEvents, useLive, useOnchain } from "@/lib/hooks";

function Stat({ k, v, fog }: { k: string; v: React.ReactNode; fog?: boolean }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="label">{k}</span>
      <span className={`num text-sm ${fog ? "fog-text" : "text-fg"}`}>{v}</span>
    </div>
  );
}

export default function TokenPage() {
  const { mint } = useParams<{ mint: string }>();
  const { data: row, refresh: refreshRow } = useLive(() => api.launch(mint), [mint], { mint });
  const { data: chain, error, refresh: refreshChain } = useOnchain(mint);
  const { data: trades, refresh: refreshTrades } = useLive(() => api.trades(mint), [mint], { mint });
  const { data: events, refresh: refreshEvents } = useLive(() => api.events(mint), [mint], { mint });
  const ritual = useRitual();
  const [copied, setCopied] = useState(false);

  const symbol = row?.symbol ?? "";
  const refreshAll = useCallback(() => {
    void refreshRow();
    void refreshChain();
    void refreshTrades();
    void refreshEvents();
  }, [refreshRow, refreshChain, refreshTrades, refreshEvents]);

  const playFrom = useCallback(
    (kind: "dice" | "fog" | "graduation", d: Record<string, unknown>) => {
      if (kind === "dice") ritual.show({ kind: "dice", props: { symbol, d1: Number(d.d1), d2: Number(d.d2), vrf: env.vrfMode === "mock" ? "local oracle" : "ORAO VRF" } });
      if (kind === "fog") ritual.show({ kind: "fog", props: { symbol, tick: Number(d.tick), forced: Boolean(d.forced) } });
      if (kind === "graduation")
        ritual.show({ kind: "graduation", props: { symbol, pool: d.pool as string, solLiquidity: d.solLiquidity as string } });
    },
    [ritual, symbol],
  );

  // Fate moments that happen while you watch take over the screen.
  useChainEvents((e: ChainEvent) => {
    if (e.kind === "diceRolled") {
      if (ritual.current?.kind === "dice") ritual.update({ kind: "dice", props: { symbol, d1: Number(e.data.d1), d2: Number(e.data.d2), vrf: env.vrfMode === "mock" ? "local oracle" : "ORAO VRF" } });
      else playFrom("dice", e.data);
    }
    if (e.kind === "fogResolved" && e.data.opened) playFrom("fog", e.data);
    if (e.kind === "graduated") playFrom("graduation", e.data);
    refreshAll();
  }, mint);

  if (error && !chain) {
    return (
      <div className="flex flex-col items-start gap-4 pt-20">
        <p className="rite text-xl text-bone/80">No launch at this address</p>
        <p className="num text-sm text-muted">{mint}</p>
        <Link href="/" className="btn btn-ghost">
          Back to launches
        </Link>
      </div>
    );
  }
  if (!chain) return <div className="pt-24 text-sm text-faint breathe">Reading the chain…</div>;

  const { launch, vault, pool } = chain;
  const state = row?.state ?? "rolling";
  const fogged = state === "rolling" || state === "fogged";
  const openedAt = launch.openedAt.toNumber();

  return (
    <div className="flex flex-col gap-6 pt-8">
      <header className="flex flex-wrap items-start justify-between gap-6">
        <div className="flex min-w-0 items-center gap-4">
          {row && <TokenAvatar row={row} size={56} />}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="truncate text-2xl font-medium tracking-tight">{row?.name ?? short(mint)}</h1>
              <span className="num text-sm text-faint">${symbol}</span>
              <StatePill state={state} />
            </div>
            <button
              className="num mt-1 text-xs text-faint hover:text-fg"
              onClick={() => {
                void navigator.clipboard?.writeText(mint).then(() => setCopied(true)).catch(() => {});
                setTimeout(() => setCopied(false), 1500);
              }}
            >
              {copied ? "copied" : short(mint, 6)}
            </button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-x-8 gap-y-3 sm:grid-cols-4">
          <Stat k="Market cap" v={fogged ? "▒▒▒▒ SOL" : mcap(row?.market_cap_sol ?? null)} fog={fogged} />
          <Stat k="Bonding" v={fogged ? "▒▒%" : `${Math.round((row?.progress ?? 0) * 100)}%`} fog={fogged} />
          <Stat k="Volume" v={`${sol(launch.volumeSol.toString(), 2)} SOL`} />
          <Stat k="Dice" v={launch.d1 ? `${launch.d1}+${launch.d2} · ${pct(launch.liquidBps)} free` : "rolling"} />
        </div>
      </header>

      {row?.description && <p className="max-w-2xl text-sm text-muted">{row.description}</p>}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-6">
          <section className="panel h-[420px]">{fogged ? <FogVeil launch={launch} /> : <PriceChart mint={mint} />}</section>

          <div className="grid gap-6 md:grid-cols-2">
            <section className="panel min-w-0">
              <h2 className="label px-4 pt-4">Trades</h2>
              <TradesFeed trades={trades ?? []} creator={launch.creator.toBase58()} />
            </section>
            <section className="panel min-w-0 px-4 pb-2">
              <h2 className="label pt-4">Fate</h2>
              <Timeline
                events={(events ?? []) as TimelineEvent[]}
                symbol={symbol}
                onReplay={(kind, e) => playFrom(kind, e.data)}
              />
            </section>
          </div>
        </div>

        <aside className="flex flex-col gap-6">
          <TradePanel mint={mint} launch={launch} symbol={symbol} onTraded={refreshAll} />
          <VaultPanel mint={mint} launch={launch} vault={vault} pool={pool} symbol={symbol} onChanged={refreshAll} />
          <div className="num flex flex-col gap-1 px-1 text-[0.6875rem] text-faint">
            <span>mint & freeze authority: none · metadata: immutable</span>
            {openedAt > 0 && <span>opened {new Date(openedAt * 1000).toLocaleString()}</span>}
            {state === "graduated" && row?.pool && (
              <a className="hover:text-fg" href={explorerAccount(row.pool)} target="_blank" rel="noreferrer">
                raydium pool {short(row.pool)} · LP burned ↗
              </a>
            )}
            <a className="hover:text-fg" href={explorerAccount(mint)} target="_blank" rel="noreferrer">
              view mint on explorer ↗
            </a>
          </div>
        </aside>
      </div>
    </div>
  );
}
