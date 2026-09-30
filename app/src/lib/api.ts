import { env } from "./env";

export type LaunchState = "rolling" | "fogged" | "trading" | "complete" | "graduated" | "cancelled";

export interface LaunchRow {
  mint: string;
  creator: string;
  name: string;
  symbol: string;
  uri: string;
  image: string | null;
  description: string | null;
  created_at: number;
  dev_buy: string;
  state: LaunchState;
  d1: number | null;
  d2: number | null;
  liquid_bps: number | null;
  fog_tick: number;
  opened_at: number | null;
  graduated_at: number | null;
  pool: string | null;
  real_sol: string | null;
  real_tokens: string | null;
  volume_sol: string;
  coef_bps: number;
  /** null while the fog hides it */
  price: number | null;
  market_cap_sol: number | null;
  progress: number;
}

export interface TradeRow {
  sig: string;
  mint: string;
  trader: string;
  is_buy: number;
  sol: string;
  tokens: string;
  price: number;
  ts: number;
}

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface TimelineEvent {
  kind: string;
  data: Record<string, unknown>;
  ts: number;
  sig: string;
}

export interface RewardRow {
  mint: string;
  idx: number;
  amount: string;
  proof: string[];
  claimed: number;
  name: string | null;
  symbol: string | null;
}

export interface ChainEvent {
  kind: string;
  mint: string | null;
  data: Record<string, unknown>;
  sig: string;
  slot: number;
  ts: number;
}

export interface Meta {
  cluster: string;
  vrfMode: string;
  protocolFeeBps: number;
  creatorFeeBps: number;
  minDevBuy: string;
  maxDevBuy: string;
  fogTickSecs: number;
  fogMaxTicks: number;
  curveSupply: string;
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${env.indexerUrl}${path}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`${res.status} ${path}`);
  return res.json() as Promise<T>;
}

export const api = {
  meta: () => get<Meta>("/api/meta"),
  launches: (sort = "new") => get<LaunchRow[]>(`/api/launches?sort=${sort}`),
  launch: (mint: string) => get<LaunchRow>(`/api/launches/${mint}`),
  trades: (mint: string) => get<TradeRow[]>(`/api/launches/${mint}/trades?limit=60`),
  candles: (mint: string, interval: number) => get<Candle[]>(`/api/launches/${mint}/candles?interval=${interval}`),
  events: (mint: string) => get<TimelineEvent[]>(`/api/launches/${mint}/events`),
  rewards: (wallet: string) => get<RewardRow[]>(`/api/rewards/${wallet}`),
  async uploadMetadata(body: { name: string; symbol: string; description: string; image: string }) {
    const res = await fetch(`${env.indexerUrl}/api/metadata`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error("Could not store token metadata. Is the indexer running?");
    return (await res.json()) as { uri: string; image: string };
  },
};

/** Live chain events from the indexer (Server-Sent Events). */
export function subscribe(onEvent: (e: ChainEvent) => void, mint?: string) {
  const url = `${env.indexerUrl}/api/stream${mint ? `?mint=${mint}` : ""}`;
  const es = new EventSource(url);
  es.addEventListener("chain", (m) => onEvent(JSON.parse((m as MessageEvent).data) as ChainEvent));
  return () => es.close();
}
