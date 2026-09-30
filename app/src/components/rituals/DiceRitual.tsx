"use client";

import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { Die3D } from "../Dice";
import { Sigil } from "../Sigil";
import { numberWord, pct } from "@/lib/format";

export interface DiceRitualProps {
  symbol: string;
  /** undefined while the oracle has not answered */
  d1?: number;
  d2?: number;
  vrf: string;
  onContinue?: () => void;
  continueLabel?: string;
  onClose: () => void;
}

export function DiceRitual({ symbol, d1, d2, vrf, onContinue, continueLabel = "Enter the fog", onClose }: DiceRitualProps) {
  // Always let the dice tumble for a beat, even on a replay.
  const [cast, setCast] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setCast(true), 1400);
    return () => clearTimeout(t);
  }, []);
  const landed = cast && d1 !== undefined && d2 !== undefined;
  const sum = landed ? d1 + d2 : undefined;
  const liquid = sum ? sum * 300 : 0;
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    if (!landed) return setRevealed(false);
    const t = setTimeout(() => setRevealed(true), 1900);
    return () => clearTimeout(t);
  }, [landed]);

  return (
    <div className="relative flex h-full flex-col items-center justify-center px-4 text-center">
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(40% 40% at 50% 50%, rgb(var(--glow-rgb) / 0.12), transparent 70%)" }}
      />
      <motion.div
        className="absolute"
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: revealed ? 1.04 : 1, opacity: 1 }}
        transition={{ duration: 1.6, ease: [0.2, 0.8, 0.2, 1] }}
      >
        <Sigil size="min(88vw, 620px)" active={revealed ? sum : undefined} spinning={!revealed} intensity={revealed ? 0.6 : 1} />
      </motion.div>

      <div
        className="pointer-events-none absolute size-[min(80vw,560px)] rounded-full transition-opacity duration-1000"
        style={{ background: "radial-gradient(closest-side, rgb(0 0 0 / 0.82), transparent)", opacity: revealed ? 1 : 0 }}
      />
      <div className="relative flex flex-col items-center gap-10">
        <p className="rite text-xs text-bone/60">{symbol ? `$${symbol} · ` : ""}the roll</p>
        <div className="flex gap-8">
          <Die3D value={landed ? d1 : undefined} />
          <Die3D value={landed ? d2 : undefined} delay={140} />
        </div>

        <div className="flex min-h-40 flex-col items-center gap-4">
          {!landed && (
            <>
              <p className="rite text-2xl text-bone sm:text-3xl">The dice are cast</p>
              <p className="num text-xs text-faint">awaiting verifiable randomness · {vrf}</p>
            </>
          )}
          {landed && revealed && (
            <motion.div
              initial={{ opacity: 0, y: 8, filter: "blur(8px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              transition={{ duration: 1.1 }}
              className="flex flex-col items-center gap-4"
            >
              <p className="rite text-5xl text-bone sm:text-7xl" style={{ textShadow: "0 0 40px rgb(var(--bone-rgb) / 0.35)" }}>
                {numberWord(sum!)}
              </p>
              <p className="rite text-sm text-bone/80 sm:text-base">
                {pct(liquid)} free · {pct(10000 - liquid)} bound for three hours
              </p>
              <p className="max-w-md text-sm text-muted">
                {d1} + {d2}. The freed part of the dev buy can leave the vault at once. The rest unlocks
                minute by minute after the market opens.
              </p>
              <div className="mt-4 flex gap-3">
                {onContinue && (
                  <button className="btn btn-primary" onClick={onContinue} autoFocus>
                    {continueLabel}
                  </button>
                )}
                <button className="btn btn-ghost" onClick={onClose}>
                  Close
                </button>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
