"use client";

import { TOKEN_2022_PROGRAM_ID, getAccount, getAssociatedTokenAddressSync } from "@solana/spl-token";
import { LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { curveOf, quoteBuy, quoteSell, withSlippage, type LaunchAccount } from "@unknown/sdk";
import { useEffect, useMemo, useState } from "react";
import { explain, useUnknown } from "@/lib/chain";
import { tokens } from "@/lib/format";
import { useToast } from "../Toast";

const SLIPPAGE_BPS = 200;

export function TradePanel({ mint, launch, symbol, onTraded }: { mint: string; launch: LaunchAccount; symbol: string; onTraded: () => void }) {
  const { client, send, wallet, connection } = useUnknown();
  const toast = useToast();
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [held, setHeld] = useState<bigint>(0n);
  const state = client.stateOf(launch);
  const feeBps = launch.protocolFeeBps + launch.creatorFeeBps;

  useEffect(() => {
    if (!wallet.publicKey) return setHeld(0n);
    const ata = getAssociatedTokenAddressSync(new PublicKey(mint), wallet.publicKey, true, TOKEN_2022_PROGRAM_ID);
    getAccount(connection, ata, "confirmed", TOKEN_2022_PROGRAM_ID)
      .then((a) => setHeld(a.amount))
      .catch(() => setHeld(0n));
  }, [wallet.publicKey, connection, mint, launch]);

  const quote = useMemo(() => {
    const n = Number(amount);
    if (!n || n <= 0) return null;
    const c = curveOf(launch);
    if (side === "buy") {
      const q = quoteBuy(c, BigInt(Math.floor(n * LAMPORTS_PER_SOL)), feeBps);
      return { out: `${tokens(q.tokensOut)} ${symbol}`, fee: q.fee, min: withSlippage(q.tokensOut, SLIPPAGE_BPS), raw: q };
    }
    const t = BigInt(Math.floor(n * 1e6));
    const q = quoteSell(c, t, feeBps);
    return q ? { out: `${(Number(q.solOut) / 1e9).toFixed(4)} SOL`, fee: q.fee, min: withSlippage(q.solOut, SLIPPAGE_BPS), raw: q } : null;
  }, [amount, side, launch, feeBps, symbol]);

  const closed = state !== "trading";
  const reason: Record<string, string> = {
    rolling: "The dice are still rolling.",
    fogged: "The market is in the fog. It opens when it opens.",
    complete: "The curve sold out. Liquidity is moving to Raydium.",
    graduated: "This token graduated. Trade it on Raydium.",
    cancelled: "This launch was voided.",
  };

  async function submit() {
    if (!quote || !wallet.publicKey) return;
    setBusy(true);
    try {
      const m = new PublicKey(mint);
      const ix =
        side === "buy"
          ? await client.buy(wallet.publicKey, m, BigInt(Math.floor(Number(amount) * LAMPORTS_PER_SOL)), quote.min)
          : await client.sell(wallet.publicKey, m, BigInt(Math.floor(Number(amount) * 1e6)), quote.min);
      const sig = await send([ix]);
      toast({ tone: "ok", text: side === "buy" ? `Bought ${quote.out}.` : `Sold for ${quote.out}.`, sig });
      setAmount("");
      onTraded();
    } catch (e) {
      toast({ tone: "error", text: explain(e) });
    } finally {
      setBusy(false);
    }
  }

  const presets = side === "buy" ? ["0.1", "0.5", "1", "5"] : ["25%", "50%", "100%"];

  return (
    <div className="panel flex flex-col gap-4 p-4">
      <div className="grid grid-cols-2 gap-1 rounded-full border hairline p-1">
        {(["buy", "sell"] as const).map((s) => (
          <button
            key={s}
            onClick={() => {
              setSide(s);
              setAmount("");
            }}
            className={`rounded-full py-1.5 text-sm capitalize transition-colors ${side === s ? (s === "buy" ? "bg-up/15 text-up" : "bg-down/15 text-down") : "text-muted hover:text-fg"}`}
          >
            {s}
          </button>
        ))}
      </div>

      <label className="flex flex-col gap-2" htmlFor="trade-amount">
        <span className="flex justify-between">
          <span className="label">{side === "buy" ? "You pay" : "You sell"}</span>
          {side === "sell" && <span className="num text-xs text-faint">held {tokens(held)}</span>}
        </span>
        <div className="relative">
          <input
            id="trade-amount"
            inputMode="decimal"
            className="field num pr-16 text-lg"
            placeholder="0.0"
            value={amount}
            disabled={closed}
            onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
          />
          <span className="num absolute right-3 top-1/2 -translate-y-1/2 text-sm text-faint">{side === "buy" ? "SOL" : symbol}</span>
        </div>
      </label>

      <div className="flex gap-2">
        {presets.map((p) => (
          <button
            key={p}
            disabled={closed}
            className="num flex-1 rounded-md border hairline py-1 text-xs text-muted hover:border-line-strong hover:text-fg disabled:opacity-40"
            onClick={() =>
              setAmount(side === "buy" ? p : String(Number((held * BigInt(parseInt(p))) / 100n) / 1e6))
            }
          >
            {p}
          </button>
        ))}
      </div>

      <dl className="num grid grid-cols-2 gap-y-1.5 text-xs">
        <dt className="text-faint">You receive</dt>
        <dd className="text-right text-fg">{quote ? quote.out : "—"}</dd>
        <dt className="text-faint">Fee ({feeBps / 100}%)</dt>
        <dd className="text-right text-muted">{quote ? `${(Number(quote.fee) / 1e9).toFixed(5)} SOL` : "—"}</dd>
        <dt className="text-faint">Slippage</dt>
        <dd className="text-right text-muted">{SLIPPAGE_BPS / 100}%</dd>
      </dl>

      {closed ? (
        <p className="rounded-lg border border-dashed hairline px-3 py-2.5 text-center text-xs text-muted">{reason[state]}</p>
      ) : !wallet.publicKey ? (
        <p className="text-center text-xs text-muted">Connect a wallet to trade.</p>
      ) : (
        <button
          className={`btn w-full ${side === "buy" ? "bg-up text-bg hover:brightness-110" : "bg-down text-bg hover:brightness-110"}`}
          disabled={!quote || busy}
          onClick={submit}
        >
          {busy ? "Confirming…" : side === "buy" ? `Buy ${symbol}` : `Sell ${symbol}`}
        </button>
      )}
    </div>
  );
}
