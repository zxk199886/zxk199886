"use client";

import { AnimatePresence, motion } from "motion/react";
import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { explorerTx } from "@/lib/env";

interface Toast {
  id: number;
  tone: "ok" | "error" | "info";
  text: string;
  sig?: string;
}

const Ctx = createContext<(t: Omit<Toast, "id">) => void>(() => {});

export const useToast = () => useContext(Ctx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((t: Omit<Toast, "id">) => {
    const id = Date.now() + Math.random();
    setToasts((xs) => [...xs.slice(-3), { ...t, id }]);
    setTimeout(() => setToasts((xs) => xs.filter((x) => x.id !== id)), t.tone === "error" ? 9000 : 5000);
  }, []);
  return (
    <Ctx.Provider value={push}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-4 z-[70] flex flex-col items-end gap-2 sm:left-auto sm:right-6"
        style={{ bottom: "calc(1.5rem + env(safe-area-inset-bottom, 0px))" }}
      >
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              transition={{ duration: 0.18 }}
              className="panel pointer-events-auto flex max-w-sm items-start gap-3 px-4 py-3 text-sm shadow-2xl"
            >
              <span
                className="mt-1.5 size-1.5 shrink-0 rounded-full"
                style={{ background: t.tone === "error" ? "var(--down)" : t.tone === "ok" ? "var(--up)" : "var(--glow)" }}
              />
              <div className="min-w-0">
                <p className="text-fg">{t.text}</p>
                {t.sig && (
                  <a className="num text-xs text-muted hover:text-fg" href={explorerTx(t.sig)} target="_blank" rel="noreferrer">
                    view transaction ↗
                  </a>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </Ctx.Provider>
  );
}
