"use client";

import { PublicKey } from "@solana/web3.js";
import { VEST_DURATION_SECS, nextCoef, unlocked, type DevVaultAccount, type HolderPoolAccount, type LaunchAccount } from "@unknown/sdk";
import { useMemo, useState } from "react";
import { explain, useUnknown } from "@/lib/chain";
import { duration, pct, sol, tokens } from "@/lib/format";
import { useNow } from "@/lib/hooks";
import { DieFace } from "../Dice";
import { useToast } from "../Toast";

const big = (v: { toString(): string }) => BigInt(v.toString());

function Row({ k, v, hint }: { k: string; v: React.ReactNode; hint?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5">
      <dt className="text-xs text-muted" title={hint}>
        {k}
      </dt>
      <dd className="num text-right text-xs text-fg">{v}</dd>
    </div>
  );
}

export function VaultPanel({
  mint,
  launch,
  vault,
  pool,
  symbol,
  onChanged,
}: {
  mint: string;
  launch: LaunchAccount;
  vault: DevVaultAccount;
  pool: HolderPoolAccount;
  symbol: string;
  onChanged: () => void;
}) {
  const { client, send, wallet } = useUnknown();
  const toast = useToast();
  const now = useNow(1000);
  const [amount, setAmount] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  const isCreator = wallet.publicKey?.equals(vault.creator) ?? false;
  const liquid = big(vault.liquidTotal);
  const vest = big(vault.vestTotal);
  const peak = big(vault.peak);
  const staked = big(vault.staked);
  const withdrawn = big(vault.withdrawn);
  const vestStart = vault.vestStart.toNumber();
  const open = unlocked(liquid, vest, vestStart, Math.floor(now));
  const available = open > withdrawn ? open - withdrawn : 0n;
  const coef = vault.coefBps;
  const vestedFrac = vestStart ? Math.min(1, Math.max(0, (now - vestStart) / VEST_DURATION_SECS)) : 0;
  const liquidFrac = peak > 0n ? Number(liquid) / Number(peak) : 0;

  const raw = useMemo(() => BigInt(Math.floor(Number(amount || 0) * 1e6)), [amount]);
  const projected = raw > 0n && raw <= staked ? nextCoef(coef, staked - raw, peak) : coef;

  async function withdraw() {
    setBusy(true);
    try {
      const sig = await send([await client.withdrawFromVault(wallet.publicKey!, new PublicKey(mint), raw)]);
      toast({ tone: "ok", text: `Withdrew ${tokens(raw)} ${symbol}. Your fee share is now ${pct(projected)}.`, sig });
      setAmount("");
      setConfirming(false);
      onChanged();
    } catch (e) {
      toast({ tone: "error", text: explain(e) });
    } finally {
      setBusy(false);
    }
  }

  async function claim() {
    setBusy(true);
    try {
      const sig = await send([await client.claimDevFees(wallet.publicKey!, new PublicKey(mint))]);
      toast({ tone: "ok", text: `Claimed ${sol(vault.feeClaimable.toString(), 4)} SOL in fees.`, sig });
      onChanged();
    } catch (e) {
      toast({ tone: "error", text: explain(e) });
    } finally {
      setBusy(false);
    }
  }

  const rolled = launch.d1 > 0;

  return (
    <div className="panel flex flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Dev vault</h3>
        {rolled && (
          <span className="flex items-center gap-1 text-bone">
            <DieFace n={launch.d1} size={16} />
            <DieFace n={launch.d2} size={16} />
          </span>
        )}
      </div>

      {!rolled ? (
        <p className="text-xs text-muted">The vault fills when the dice land.</p>
      ) : (
        <>
          {/* Unlock track: freed share, then 3 hours of linear vesting. */}
          <div className="flex flex-col gap-2">
            <div className="relative h-2 overflow-hidden rounded-full bg-raised">
              <div className="absolute inset-y-0 left-0 bg-bone/70" style={{ width: `${liquidFrac * 100}%` }} />
              <div
                className="absolute inset-y-0 bg-glow/60"
                style={{ left: `${liquidFrac * 100}%`, width: `${(1 - liquidFrac) * vestedFrac * 100}%` }}
              />
              {withdrawn > 0n && (
                <div
                  className="absolute inset-y-0 left-0"
                  title="withdrawn by the dev"
                  style={{
                    width: `${(Number(withdrawn) / Number(peak)) * 100}%`,
                    background: "repeating-linear-gradient(135deg, var(--down) 0 3px, transparent 3px 6px)",
                  }}
                />
              )}
            </div>
            <div className="num flex justify-between text-[0.6875rem] text-faint">
              <span>{pct(launch.liquidBps)} free by the dice</span>
              <span>
                {vestStart === 0
                  ? "vesting starts when the fog lifts"
                  : vestedFrac >= 1
                    ? "fully vested"
                    : `${duration(vestStart + VEST_DURATION_SECS - now)} to full unlock`}
              </span>
            </div>
          </div>

          <div>
            <div className="flex items-baseline justify-between">
              <span className="text-xs text-muted">Fee share</span>
              <span className="num text-lg" style={{ color: coef < 10000 ? "var(--bone)" : "var(--fg)" }}>
                {pct(coef)}
              </span>
            </div>
            <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-raised">
              <div className="h-full rounded-full bg-fg/80" style={{ width: `${coef / 100}%` }} />
            </div>
            <p className="mt-2 text-[0.6875rem] leading-relaxed text-faint">
              Share of creator fees the dev keeps: tokens still in the vault ÷ the most it ever held. It never goes back up.
            </p>
          </div>

          <dl className="divide-y divide-line">
            <Row k="In vault" v={`${tokens(staked)} / ${tokens(peak)}`} />
            <Row k="Withdrawn by dev" v={tokens(withdrawn)} />
            <Row k="Unlocked, not withdrawn" v={tokens(available)} />
            <Row k="Fees kept by dev" v={`${sol(big(vault.feeClaimable) + big(vault.feeClaimed), 4)} SOL`} />
            <Row k="Fees forfeited to holders" v={`${sol(vault.feeForfeited.toString(), 4)} SOL`} />
            <Row k="Holder pool paid out" v={`${sol(pool.totalClaimed.toString(), 4)} / ${sol(pool.totalReceived.toString(), 4)} SOL`} />
          </dl>

          {isCreator && (
            <div className="flex flex-col gap-3 border-t hairline pt-4">
              <p className="label">You created this token</p>
              {!confirming ? (
                <div className="flex gap-2">
                  <input
                    id="vault-withdraw"
                    className="field num text-sm"
                    placeholder={`max ${tokens(available)}`}
                    inputMode="decimal"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
                  />
                  <button
                    className="btn btn-ghost shrink-0"
                    disabled={raw <= 0n || raw > available || busy}
                    onClick={() => setConfirming(true)}
                  >
                    Withdraw
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-3 rounded-lg border border-bone/25 bg-bone/[0.04] p-3">
                  <p className="text-sm text-bone">
                    Your fee share drops from {pct(coef)} to {pct(projected)}, permanently.
                  </p>
                  <p className="text-xs text-muted">
                    Putting tokens back later will not raise it. The difference goes to holders from now on.
                  </p>
                  <div className="flex gap-2">
                    <button className="btn btn-primary" disabled={busy} onClick={withdraw}>
                      {busy ? "Confirming…" : `Withdraw ${tokens(raw)}`}
                    </button>
                    <button className="btn btn-ghost" onClick={() => setConfirming(false)}>
                      Keep them
                    </button>
                  </div>
                </div>
              )}
              <button className="btn btn-ghost" disabled={big(vault.feeClaimable) === 0n || busy} onClick={claim}>
                Claim {sol(vault.feeClaimable.toString(), 4)} SOL in fees
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
