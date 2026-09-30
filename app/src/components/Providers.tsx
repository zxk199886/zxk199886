"use client";

import "@/lib/polyfill";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { UnsafeBurnerWalletAdapter } from "@solana/wallet-adapter-unsafe-burner";
import { useMemo, type ReactNode } from "react";
import { env } from "@/lib/env";
import { RitualProvider } from "./rituals/RitualProvider";
import { ToastProvider } from "./Toast";

export function Providers({ children }: { children: ReactNode }) {
  // Wallet Standard wallets (Phantom, Solflare, Backpack…) are detected
  // automatically; on localnet a burner wallet makes the app usable without one.
  const wallets = useMemo(() => (env.cluster === "localnet" ? [new UnsafeBurnerWalletAdapter()] : []), []);
  return (
    <ConnectionProvider endpoint={env.rpcUrl} config={{ commitment: "confirmed" }}>
      <WalletProvider
        wallets={wallets}
        autoConnect
        onError={(e) => console.error("wallet error:", e.name, e.message, (e as { error?: unknown }).error)}
      >
        <ToastProvider>
          <RitualProvider>{children}</RitualProvider>
        </ToastProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
