"use client";

import { motion } from "motion/react";
import { Sigil } from "../Sigil";
import { short } from "@/lib/format";
import { explorerAccount } from "@/lib/env";

export interface GraduationProps {
  symbol: string;
  pool?: string;
  solLiquidity?: string;
  onClose: () => void;
}

/** The curve completes: the dial collapses to a point and the pool is sealed. */
export function GraduationRitual({ symbol, pool, solLiquidity, onClose }: GraduationProps) {
  return (
    <div className="relative flex h-full flex-col items-center justify-center px-4 text-center">
      <motion.div
        className="absolute"
        initial={{ scale: 1, opacity: 1, rotate: 0 }}
        animate={{ scale: 0.02, opacity: 0.9, rotate: 200 }}
        transition={{ duration: 2.6, ease: [0.7, 0, 0.3, 1] }}
      >
        <Sigil size="min(90vw, 640px)" />
      </motion.div>
      <motion.div
        className="absolute size-3 rounded-full bg-bone"
        initial={{ opacity: 0, scale: 0 }}
        animate={{ opacity: [0, 1, 1, 0.9], scale: [0, 1, 80, 1], boxShadow: "0 0 80px 20px rgb(var(--bone-rgb) / 0.5)" }}
        transition={{ duration: 3.2, delay: 2.4, times: [0, 0.1, 0.35, 1] }}
      />
      <motion.div
        className="relative flex flex-col items-center gap-5"
        initial={{ opacity: 0, filter: "blur(10px)" }}
        animate={{ opacity: 1, filter: "blur(0px)" }}
        transition={{ duration: 1.4, delay: 3.8 }}
      >
        <p className="rite text-xs text-bone/60">${symbol} · graduation</p>
        <p className="rite text-3xl text-bone sm:text-5xl">Bound to the chain</p>
        <p className="max-w-md text-sm text-muted">
          The curve sold out. Its SOL and the reserved tokens now sit in a Raydium pool, and every LP token was
          burned. Nobody can pull this liquidity.
        </p>
        <div className="num flex flex-wrap justify-center gap-x-6 gap-y-1 text-xs text-muted">
          {solLiquidity && <span>{(Number(solLiquidity) / 1e9).toFixed(2)} SOL liquidity</span>}
          <span>LP burned 100%</span>
          {pool && (
            <a className="hover:text-fg" href={explorerAccount(pool)} target="_blank" rel="noreferrer">
              pool {short(pool)} ↗
            </a>
          )}
        </div>
        <button className="btn btn-ghost mt-2" onClick={onClose} autoFocus>
          Close
        </button>
      </motion.div>
    </div>
  );
}
