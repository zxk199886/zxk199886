"use client";

/**
 * The dial of 2d6. Thirty-six outer ticks for the 36 equally likely rolls;
 * eleven spokes for the sums 2–12, each as long as its number of ways
 * (7 has six, 2 and 12 have one); a hexagram for the six faces.
 */
const ways = (s: number) => 6 - Math.abs(7 - s);

export function Sigil({
  active,
  size = 420,
  className = "",
  spinning = false,
  intensity = 1,
  hub = false,
}: {
  active?: number;
  size?: number | string;
  className?: string;
  spinning?: boolean;
  intensity?: number;
  /** Fill the centre so content can sit on it. */
  hub?: boolean;
}) {
  const c = 200;
  const polar = (r: number, deg: number) => {
    const a = ((deg - 90) * Math.PI) / 180;
    // Rounded so server and client render identical markup.
    const r2 = (n: number) => Math.round(n * 100) / 100;
    return [r2(c + r * Math.cos(a)), r2(c + r * Math.sin(a))] as const;
  };
  const tri = (rot: number) =>
    [0, 120, 240].map((d) => polar(104, d + rot).join(",")).join(" ");
  return (
    <svg
      viewBox="0 0 400 400"
      width={size}
      height={size}
      className={className}
      style={{ opacity: intensity, maxWidth: "100%" }}
      aria-hidden
    >
      <defs>
        <filter id="sigil-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <g className={spinning ? "spin-slow" : ""} style={{ transformOrigin: "200px 200px" }}>
        <circle cx={c} cy={c} r={192} fill="none" stroke="rgb(var(--bone-rgb) / 0.22)" />
        <circle cx={c} cy={c} r={184} fill="none" stroke="rgb(var(--bone-rgb) / 0.12)" />
        {Array.from({ length: 36 }, (_, i) => {
          const [x1, y1] = polar(184, i * 10);
          const [x2, y2] = polar(192, i * 10);
          return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgb(var(--bone-rgb) / 0.4)" />;
        })}
      </g>
      <g className={spinning ? "spin-slower" : ""} style={{ transformOrigin: "200px 200px" }}>
        {Array.from({ length: 11 }, (_, i) => {
          const s = i + 2;
          const deg = (i * 360) / 11;
          const on = active === s;
          const [x1, y1] = polar(170, deg);
          const [x2, y2] = polar(170 - ways(s) * 8, deg);
          const [tx, ty] = polar(146 - ways(s) * 8 + 16, deg);
          return (
            <g key={s} filter={on ? "url(#sigil-glow)" : undefined}>
              <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={on ? "var(--bone)" : "rgb(var(--bone-rgb) / 0.35)"} strokeWidth={on ? 2 : 1} />
              <text
                x={tx}
                y={ty}
                fill={on ? "var(--bone)" : "rgb(var(--bone-rgb) / 0.4)"}
                fontFamily="var(--font-rite)"
                fontSize={on ? 22 : 15}
                textAnchor="middle"
                dominantBaseline="central"
              >
                {s}
              </text>
            </g>
          );
        })}
        <circle cx={c} cy={c} r={112} fill="none" stroke="rgb(var(--bone-rgb) / 0.16)" />
        <polygon points={tri(0)} fill="none" stroke="rgb(var(--glow-rgb) / 0.35)" />
        <polygon points={tri(180)} fill="none" stroke="rgb(var(--glow-rgb) / 0.35)" />
        <circle cx={c} cy={c} r={60} fill={hub ? "var(--bg)" : "none"} stroke="rgb(var(--bone-rgb) / 0.14)" />
      </g>
    </svg>
  );
}
