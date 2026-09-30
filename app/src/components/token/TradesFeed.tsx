"use client";

import type { TradeRow } from "@/lib/api";
import { explorerTx } from "@/lib/env";
import { ago, short, sol, tokens } from "@/lib/format";
import { useNow } from "@/lib/hooks";

export function TradesFeed({ trades, creator }: { trades: TradeRow[]; creator: string }) {
  const now = useNow(5000);
  if (trades.length === 0) return <p className="px-4 py-6 text-xs text-faint">No trades yet.</p>;
  return (
    <div className="max-h-80 overflow-y-auto">
      <table className="num w-full text-left text-xs">
        <tbody>
          {trades.map((t) => (
            <tr key={`${t.sig}`} className="border-b hairline last:border-0">
              <td className="px-4 py-2 text-faint">{ago(t.ts, now)}</td>
              <td className={`py-2 ${t.is_buy ? "text-up" : "text-down"}`}>{t.is_buy ? "BUY" : "SELL"}</td>
              <td className="py-2 text-right text-fg">{sol(t.sol, 3)} SOL</td>
              <td className="py-2 text-right text-muted">{tokens(t.tokens)}</td>
              <td className="px-4 py-2 text-right">
                <a href={explorerTx(t.sig)} target="_blank" rel="noreferrer" className="text-faint hover:text-fg">
                  {t.trader === creator ? <span className="text-bone">dev</span> : short(t.trader)}
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
