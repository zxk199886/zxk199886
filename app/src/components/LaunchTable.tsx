"use client";

import Link from "next/link";
import type { LaunchRow } from "@/lib/api";
import { ago, mcap, pct, sol } from "@/lib/format";
import { useNow } from "@/lib/hooks";
import { DieFace } from "./Dice";
import { StatePill } from "./StatePill";

function Progress({ value, state }: { value: number; state: LaunchRow["state"] }) {
  const hidden = state === "rolling" || state === "fogged";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1 w-20 overflow-hidden rounded-full bg-raised">
        <div
          className="h-full rounded-full"
          style={{
            width: `${hidden ? 100 : Math.max(2, value * 100)}%`,
            background: hidden
              ? "repeating-linear-gradient(90deg, rgb(var(--glow-rgb)/.25) 0 4px, transparent 4px 8px)"
              : state === "graduated"
                ? "var(--muted)"
                : "linear-gradient(90deg, rgb(var(--glow-rgb)/.5), var(--glow))",
          }}
        />
      </div>
      <span className="text-muted">{hidden ? "▒▒" : `${Math.round(value * 100)}%`}</span>
    </div>
  );
}

export function TokenAvatar({ row, size = 32 }: { row: Pick<LaunchRow, "image" | "symbol">; size?: number }) {
  return row.image ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={row.image} alt="" width={size} height={size} className="shrink-0 rounded-lg border hairline object-cover" />
  ) : (
    <span
      className="num flex shrink-0 items-center justify-center rounded-lg border hairline bg-raised text-[0.625rem] text-muted"
      style={{ width: size, height: size }}
    >
      {row.symbol.slice(0, 3)}
    </span>
  );
}

export function LaunchTable({ rows }: { rows: LaunchRow[] }) {
  const now = useNow(5000);
  if (rows.length === 0) {
    return (
      <div className="panel flex flex-col items-center gap-3 px-6 py-16 text-center">
        <p className="rite text-lg text-bone/80">Nothing has been launched yet</p>
        <p className="max-w-sm text-sm text-muted">Be the first to roll. Launches appear here the moment the dice are cast.</p>
        <Link href="/create" className="btn btn-primary mt-2">
          Create a token
        </Link>
      </div>
    );
  }
  return (
    <div className="panel overflow-x-auto">
      <table className="num w-full min-w-[760px] text-left text-[0.8125rem]">
        <thead>
          <tr className="border-b hairline">
            {["Token", "State", "Roll", "Market cap", "Bonding", "Volume", "Age"].map((h) => (
              <th key={h} className="label px-4 py-3 font-normal">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.mint} className="group border-b hairline transition-colors last:border-0 hover:bg-raised/60">
              <td className="px-4 py-3">
                <Link href={`/token/${r.mint}`} className="flex items-center gap-3">
                  <TokenAvatar row={r} />
                  <span className="min-w-0">
                    <span className="block truncate font-sans text-sm text-fg group-hover:text-white">{r.name}</span>
                    <span className="text-xs text-faint">${r.symbol}</span>
                  </span>
                </Link>
              </td>
              <td className="px-4 py-3">
                <StatePill state={r.state} />
              </td>
              <td className="px-4 py-3">
                {r.d1 && r.d2 ? (
                  <span className="flex items-center gap-1.5 whitespace-nowrap text-bone">
                    <DieFace n={r.d1} size={16} />
                    <DieFace n={r.d2} size={16} />
                    <span className="ml-1 text-muted">{pct(r.liquid_bps ?? 0)} free</span>
                  </span>
                ) : (
                  <span className="breathe text-faint">casting…</span>
                )}
              </td>
              <td className="px-4 py-3">{r.state === "fogged" || r.state === "rolling" ? <span className="fog-text">▒▒▒▒▒ SOL</span> : mcap(r.market_cap_sol)}</td>
              <td className="px-4 py-3">
                <Progress value={r.progress} state={r.state} />
              </td>
              <td className="px-4 py-3 text-muted">{sol(r.volume_sol, 1)} SOL</td>
              <td className="px-4 py-3 text-muted">{ago(r.created_at, now)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
