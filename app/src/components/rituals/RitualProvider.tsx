"use client";

import { AnimatePresence, motion } from "motion/react";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { DiceRitual, type DiceRitualProps } from "./DiceRitual";
import { FogLift, type FogLiftProps } from "./FogLift";
import { GraduationRitual, type GraduationProps } from "./Graduation";

type Ritual =
  | { kind: "dice"; props: Omit<DiceRitualProps, "onClose"> }
  | { kind: "fog"; props: Omit<FogLiftProps, "onClose"> }
  | { kind: "graduation"; props: Omit<GraduationProps, "onClose"> };

interface Ctx {
  current: Ritual | null;
  show: (r: Ritual) => void;
  update: (r: Ritual) => void;
  close: () => void;
}

const RitualCtx = createContext<Ctx>({ current: null, show: () => {}, update: () => {}, close: () => {} });
export const useRitual = () => useContext(RitualCtx);

/** Full-screen "fate moments". The rest of the app stays quiet so these land. */
export function RitualProvider({ children }: { children: ReactNode }) {
  const [current, setCurrent] = useState<Ritual | null>(null);
  const close = useCallback(() => setCurrent(null), []);
  const show = useCallback((r: Ritual) => setCurrent(r), []);
  const update = useCallback((r: Ritual) => setCurrent((c) => (c && c.kind === r.kind ? r : c)), []);

  useEffect(() => {
    if (!current) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [current, close]);

  return (
    <RitualCtx.Provider value={{ current, show, update, close }}>
      {children}
      <AnimatePresence>
        {current && (
          <motion.div
            key={current.kind}
            role="dialog"
            aria-modal="true"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6 }}
            className="fixed inset-0 z-[55] overflow-hidden bg-black"
          >
            {current.kind === "dice" && <DiceRitual {...current.props} onClose={close} />}
            {current.kind === "fog" && <FogLift {...current.props} onClose={close} />}
            {current.kind === "graduation" && <GraduationRitual {...current.props} onClose={close} />}
          </motion.div>
        )}
      </AnimatePresence>
    </RitualCtx.Provider>
  );
}
