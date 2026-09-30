"use client";

import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { FogCanvas } from "./FogCanvas";
import { Sigil } from "../Sigil";

export interface FogLiftProps {
  symbol: string;
  tick: number;
  forced?: boolean;
  onClose: () => void;
}

/** The market opens: fog parts from the centre, the sigil flares, silence. */
export function FogLift({ symbol, tick, forced, onClose }: FogLiftProps) {
  const [clear, setClear] = useState(0);
  useEffect(() => {
    const start = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / 3200);
      setClear(t * t * (3 - 2 * t));
      if (t < 1) raf = requestAnimationFrame(step);
    };
    const delay = setTimeout(() => (raf = requestAnimationFrame(step)), 900);
    const done = setTimeout(onClose, 6200);
    return () => {
      clearTimeout(delay);
      clearTimeout(done);
      cancelAnimationFrame(raf);
    };
  }, [onClose]);

  return (
    <button className="relative block h-full w-full cursor-default" onClick={onClose} aria-label="Close">
      <motion.div
        className="absolute inset-0 flex items-center justify-center"
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: [0, 1, 0.25], scale: [0.8, 1.05, 1.15] }}
        transition={{ duration: 4.5, times: [0, 0.35, 1] }}
      >
        <Sigil size="min(90vw, 640px)" />
      </motion.div>
      <FogCanvas className="absolute inset-0 h-full w-full" density={1.25} clear={clear} />
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 px-4 text-center">
        <motion.p
          className="rite text-3xl text-bone sm:text-5xl"
          initial={{ opacity: 0, letterSpacing: "0.6em" }}
          animate={{ opacity: 1, letterSpacing: "0.32em" }}
          transition={{ duration: 2.2, delay: 0.4 }}
        >
          The fog lifts
        </motion.p>
        <motion.p
          className="num text-xs text-muted"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.6 }}
        >
          ${symbol} opened on tick {tick + 1}
          {forced ? " · opened by deadline" : ""} · trading is live
        </motion.p>
      </div>
    </button>
  );
}
