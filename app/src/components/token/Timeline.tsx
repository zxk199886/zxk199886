"use client";

import type { TimelineEvent } from "@/lib/api";
import { pct, sol, tokens } from "@/lib/format";
import { DieFace } from "../Dice";

function describe(e: TimelineEvent, symbol: string): { text: React.ReactNode; tone?: "rite" | "muted"; replay?: "dice" | "fog" | "graduation" } | null {
  const d = e.data as Record<string, string & number & boolean>;
  switch (e.kind) {
    case "launchCreated":
      return { text: `Created. Dev committed ${sol(d.devBuyLamports)} SOL before seeing the dice.` };
    case "diceRolled":
      return {
        tone: "rite",
        replay: "dice",
        text: (
          <span className="inline-flex flex-wrap items-center gap-1.5">
            Rolled <DieFace n={d.d1} size={14} /> <DieFace n={d.d2} size={14} /> → {pct(d.liquidBps)} free,{" "}
            {tokens(d.vestingTokens)} {symbol} bound for 3h
          </span>
        ),
      };
    case "fogRequested":
      return null;
    case "fogResolved":
      return d.opened
        ? { tone: "rite", replay: "fog", text: `Tick ${d.tick + 1} lifted the fog${d.forced ? " (deadline)" : ""}. Trading opened.` }
        : { tone: "muted", text: `Tick ${d.tick + 1} stayed closed.` };
    case "vaultWithdrawn":
      return { text: `Dev withdrew ${tokens(d.amount)} ${symbol}. Fee share now ${pct(d.coefBps)}.` };
    case "devFeesClaimed":
      return { tone: "muted", text: `Dev claimed ${sol(d.amount, 4)} SOL in fees.` };
    case "holderEpochPosted":
      return { text: `Epoch ${d.index}: ${sol(d.total, 4)} SOL of forfeited fees allocated to holders.` };
    case "curveComplete":
      return { tone: "rite", text: `Curve sold out at ${sol(d.realSol, 2)} SOL.` };
    case "graduated":
      return { tone: "rite", replay: "graduation", text: `Graduated to Raydium. ${tokens(d.lpBurned)} LP burned.` };
    case "launchRefunded":
      return { text: "The oracle never answered. Dev refunded; launch void." };
    default:
      return null;
  }
}

export function Timeline({
  events,
  symbol,
  onReplay,
}: {
  events: TimelineEvent[];
  symbol: string;
  onReplay: (kind: "dice" | "fog" | "graduation", e: TimelineEvent) => void;
}) {
  const items = events.map((e) => ({ e, d: describe(e, symbol) })).filter((x) => x.d);
  return (
    <ol className="flex flex-col">
      {items.map(({ e, d }, i) => (
        <li key={`${e.sig}-${i}`} className="grid grid-cols-[4.5rem_1fr_auto] items-baseline gap-3 border-b hairline py-2.5 last:border-0">
          <time className="num text-[0.6875rem] text-faint">{new Date(e.ts * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" })}</time>
          <p className={`min-w-0 text-xs leading-relaxed ${d!.tone === "rite" ? "text-bone" : d!.tone === "muted" ? "text-faint" : "text-muted"}`}>{d!.text}</p>
          {d!.replay ? (
            <button className="label hover:text-fg" onClick={() => onReplay(d!.replay!, e)}>
              replay
            </button>
          ) : (
            <span />
          )}
        </li>
      ))}
    </ol>
  );
}
