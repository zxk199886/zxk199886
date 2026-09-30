"use client";

import { PublicKey } from "@solana/web3.js";
import type { DevVaultAccount, HolderPoolAccount, LaunchAccount } from "@unknown/sdk";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, subscribe, type ChainEvent, type LaunchRow, type Meta } from "./api";
import { useUnknown } from "./chain";

export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now() / 1000);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now() / 1000), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

/** Fetches `load`, refetching on an interval and whenever a chain event arrives. */
export function useLive<T>(load: () => Promise<T>, deps: unknown[], opts: { mint?: string; everyMs?: number } = {}) {
  const [data, setData] = useState<T>();
  const [error, setError] = useState<string>();
  const loadRef = useRef(load);
  loadRef.current = load;

  const refresh = useCallback(async () => {
    try {
      setData(await loadRef.current());
      setError(undefined);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const t = setInterval(refresh, opts.everyMs ?? 8000);
    let debounce: ReturnType<typeof setTimeout> | undefined;
    let off = () => {};
    try {
      off = subscribe(() => {
        clearTimeout(debounce);
        debounce = setTimeout(refresh, 250);
      }, opts.mint);
    } catch {
      /* SSE unavailable: polling still runs */
    }
    return () => {
      clearInterval(t);
      clearTimeout(debounce);
      off();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, error, refresh };
}

export function useMeta() {
  return useLive<Meta>(() => api.meta(), [], { everyMs: 60_000 }).data;
}

export function useLaunches(sort: string) {
  return useLive<LaunchRow[]>(() => api.launches(sort), [sort]);
}

export interface OnchainLaunch {
  launch: LaunchAccount;
  vault: DevVaultAccount;
  pool: HolderPoolAccount;
}

/** Authoritative on-chain state for one launch. */
export function useOnchain(mint: string) {
  const { client } = useUnknown();
  return useLive<OnchainLaunch>(
    async () => {
      const m = new PublicKey(mint);
      const [launch, vault, pool] = await Promise.all([
        client.fetchLaunch(m),
        client.fetchVault(m),
        client.fetchHolderPool(m),
      ]);
      return { launch, vault, pool };
    },
    [mint, client],
    { mint, everyMs: 4000 },
  );
}

/** Calls `fn` for each live chain event (optionally for one mint). */
export function useChainEvents(fn: (e: ChainEvent) => void, mint?: string) {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    try {
      return subscribe((e) => ref.current(e), mint);
    } catch {
      return undefined;
    }
  }, [mint]);
}
