import type { LaunchState } from "@/lib/api";

const STYLE: Record<LaunchState, { label: string; dot: string; text: string; pulse?: boolean }> = {
  rolling: { label: "Rolling", dot: "var(--bone)", text: "text-bone", pulse: true },
  fogged: { label: "Fogged", dot: "var(--glow)", text: "text-glow", pulse: true },
  trading: { label: "Live", dot: "var(--up)", text: "text-up" },
  complete: { label: "Migrating", dot: "var(--bone)", text: "text-bone", pulse: true },
  graduated: { label: "Graduated", dot: "var(--muted)", text: "text-muted" },
  cancelled: { label: "Void", dot: "var(--faint)", text: "text-faint" },
};

export function StatePill({ state }: { state: LaunchState }) {
  const s = STYLE[state];
  return (
    <span className={`num inline-flex items-center gap-1.5 text-[0.6875rem] uppercase tracking-[0.12em] ${s.text}`}>
      <span className={`size-1.5 rounded-full ${s.pulse ? "breathe" : ""}`} style={{ background: s.dot }} />
      {s.label}
    </span>
  );
}
