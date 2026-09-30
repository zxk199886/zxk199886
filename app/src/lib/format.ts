const LAMPORTS = 1e9;

export const sol = (lamports: string | number | bigint, digits = 3) =>
  (Number(lamports) / LAMPORTS).toLocaleString("en-US", { maximumFractionDigits: digits, minimumFractionDigits: 0 });

export const tokens = (raw: string | number | bigint) => {
  const n = Number(raw) / 1e6;
  if (n === 0) return "0";
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return n.toFixed(n < 1 ? 4 : 1);
};

export const pct = (bps: number) => `${(bps / 100).toFixed(bps % 100 ? 1 : 0)}%`;

export const short = (addr: string, n = 4) => `${addr.slice(0, n)}…${addr.slice(-n)}`;

export function ago(ts: number, now = Date.now() / 1000) {
  const s = Math.max(0, Math.floor(now - ts));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

export function duration(secs: number) {
  const s = Math.max(0, Math.floor(secs));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  return h ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m ${String(r).padStart(2, "0")}s`;
}

export const mcap = (v: number | null) =>
  v == null ? "▒▒▒▒" : `${v.toLocaleString("en-US", { maximumFractionDigits: v < 100 ? 2 : 0 })} SOL`;

const WORDS = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"];
export const numberWord = (n: number) => WORDS[n] ?? String(n);
