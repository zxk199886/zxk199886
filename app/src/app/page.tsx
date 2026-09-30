"use client";

import Link from "next/link";
import { useState } from "react";
import { DieFace } from "@/components/Dice";
import { LaunchTable } from "@/components/LaunchTable";
import { Sigil } from "@/components/Sigil";
import { useLaunches } from "@/lib/hooks";
import { pct } from "@/lib/format";

const RITES = [
  {
    n: "I",
    title: "The roll",
    body: "The dev commits SOL up front. Two dice from a verifiable oracle decide how much of that buy is free: the sum × 3%, from 6% to 36%. The rest unlocks linearly over three hours.",
    fact: "2d6 · VRF",
  },
  {
    n: "II",
    title: "The fog",
    body: "Trading opens at a moment nobody knows. Every minute a fresh draw decides, so there is no timestamp for a bot to read. The last tick always opens.",
    fact: "≤ 30 ticks",
  },
  {
    n: "III",
    title: "The vault",
    body: "Dev tokens sit in a vault. Their share of fees is what they still hold ÷ the most they ever held, and it only goes down. Whatever they forfeit is paid to holders.",
    fact: "staked ÷ peak",
  },
  {
    n: "IV",
    title: "The seal",
    body: "Mint, freeze and metadata authorities are revoked at birth. When the curve sells out, liquidity moves to Raydium and every LP token is burned.",
    fact: "LP burned",
  },
];

const SORTS = [
  { id: "new", label: "Newest" },
  { id: "volume", label: "Volume" },
  { id: "progress", label: "Near graduation" },
];

export default function Home() {
  const [sort, setSort] = useState("new");
  const { data, error } = useLaunches(sort);
  const lastRoll = data?.find((l) => l.d1 && l.d2);

  return (
    <div className="flex flex-col gap-24">
      <section className="grid items-center gap-10 pt-16 md:grid-cols-[1.15fr_1fr] md:pt-24">
        <div className="flex flex-col gap-7">
          <p className="label">Solana launchpad</p>
          <h1 className="max-w-xl text-5xl font-medium leading-[1.02] tracking-[-0.035em] sm:text-6xl lg:text-7xl">
            Nobody knows.
            <span className="block text-muted">That is the point.</span>
          </h1>
          <p className="max-w-lg text-base leading-relaxed text-muted">
            Unknown takes the dev’s hand off the lever. Dice decide how much of their buy they can sell, the market
            opens at a moment no one can predict, and holding pays better than dumping.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/create" className="btn btn-primary">
              Launch a token
            </Link>
            <a href="#launches" className="btn btn-ghost">
              Browse launches
            </a>
          </div>
        </div>

        <figure className="mx-auto flex w-full max-w-[440px] flex-col items-center gap-4">
          <div className="relative flex aspect-square w-full items-center justify-center">
            <Sigil size="100%" spinning hub active={lastRoll ? lastRoll.d1! + lastRoll.d2! : undefined} />
            <span className="absolute flex gap-2 text-bone">
              {lastRoll ? (
                <>
                  <DieFace n={lastRoll.d1!} size={26} />
                  <DieFace n={lastRoll.d2!} size={26} />
                </>
              ) : (
                <span className="rite text-sm text-bone/50">?</span>
              )}
            </span>
          </div>
          <figcaption className="num text-center text-xs text-muted">
            {lastRoll ? (
              <>
                last roll · <span className="text-bone">${lastRoll.symbol}</span> · {lastRoll.d1}+{lastRoll.d2} ={" "}
                {pct(lastRoll.liquid_bps ?? 0)} free
              </>
            ) : (
              "awaiting the first roll"
            )}
          </figcaption>
        </figure>
      </section>

      <section className="grid gap-px overflow-hidden rounded-2xl border hairline bg-line sm:grid-cols-2 lg:grid-cols-4">
        {RITES.map((r) => (
          <article key={r.n} className="flex flex-col gap-4 bg-bg p-6">
            <div className="flex items-baseline justify-between">
              <span className="rite text-lg tracking-[0.06em] text-bone/70">{r.n}</span>
              <span className="label">{r.fact}</span>
            </div>
            <h2 className="text-lg font-medium tracking-tight">{r.title}</h2>
            <p className="text-sm leading-relaxed text-muted">{r.body}</p>
          </article>
        ))}
      </section>

      <section id="launches" className="flex scroll-mt-24 flex-col gap-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="label">Board</p>
            <h2 className="mt-1 text-2xl font-medium tracking-tight">Launches</h2>
          </div>
          <div className="flex gap-1 rounded-full border hairline p-1">
            {SORTS.map((s) => (
              <button
                key={s.id}
                onClick={() => setSort(s.id)}
                className={`rounded-full px-3 py-1 text-xs transition-colors ${sort === s.id ? "bg-raised text-fg" : "text-muted hover:text-fg"}`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
        {error && !data ? (
          <div className="panel px-6 py-10 text-sm text-muted">
            Can’t reach the indexer. Start it with <code className="num text-fg">pnpm indexer</code> and this board fills in.
          </div>
        ) : (
          <LaunchTable rows={data ?? []} />
        )}
      </section>
    </div>
  );
}
