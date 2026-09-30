"use client";

import type { CSSProperties } from "react";

const PIPS: Record<number, [number, number][]> = {
  1: [[1, 1]],
  2: [[0, 0], [2, 2]],
  3: [[0, 0], [1, 1], [2, 2]],
  4: [[0, 0], [2, 0], [0, 2], [2, 2]],
  5: [[0, 0], [2, 0], [1, 1], [0, 2], [2, 2]],
  6: [[0, 0], [2, 0], [0, 1], [2, 1], [0, 2], [2, 2]],
};

/** Flat die face for tables and stats. */
export function DieFace({ n, size = 18, className = "" }: { n: number; size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-label={`die showing ${n}`} role="img">
      <rect x="1.5" y="1.5" width="21" height="21" rx="5" fill="none" stroke="currentColor" strokeOpacity="0.55" />
      {PIPS[n]?.map(([x, y], i) => <circle key={i} cx={6.5 + x * 5.5} cy={6.5 + y * 5.5} r="1.7" fill="currentColor" />)}
    </svg>
  );
}

function Face({ n, transform }: { n: number; transform: string }) {
  return (
    <div
      className="absolute inset-0 grid grid-cols-3 grid-rows-3 p-[16%]"
      style={{
        transform,
        backfaceVisibility: "hidden",
        background: "radial-gradient(120% 120% at 30% 20%, #17161d, #0a0a0e)",
        border: "1px solid rgb(var(--bone-rgb) / 0.35)",
        borderRadius: "18%",
        boxShadow: "inset 0 0 18px rgb(var(--glow-rgb) / 0.12)",
      }}
    >
      {Array.from({ length: 9 }, (_, i) => {
        const on = PIPS[n].some(([x, y]) => x === i % 3 && y === Math.floor(i / 3));
        return (
          <span key={i} className="flex items-center justify-center">
            {on && <span className="block size-[62%] rounded-full bg-bone shadow-[0_0_10px_rgb(var(--bone-rgb)/0.7)]" />}
          </span>
        );
      })}
    </div>
  );
}

// Which rotation brings each face to the front.
const SHOW: Record<number, [number, number]> = { 1: [0, 0], 2: [0, -90], 3: [-90, 0], 4: [90, 0], 5: [0, 90], 6: [0, 180] };

/**
 * A 3D die. While `value` is undefined it tumbles; once set it lands on that
 * face after a few extra turns.
 */
export function Die3D({ value, size = 84, delay = 0 }: { value?: number; size?: number; delay?: number }) {
  const half = size / 2;
  const [rx, ry] = value ? SHOW[value] : [0, 0];
  const cube: CSSProperties = value
    ? {
        transform: `rotateX(${rx + 720}deg) rotateY(${ry + 1080}deg)`,
        transition: `transform 1.6s cubic-bezier(.17,.84,.3,1) ${delay}ms`,
      }
    : { animation: `tumble 1.1s linear ${delay}ms infinite` };
  return (
    <div style={{ width: size, height: size, perspective: size * 6 }}>
      <div className="relative size-full" style={{ transformStyle: "preserve-3d", ...cube }}>
        <Face n={1} transform={`translateZ(${half}px)`} />
        <Face n={6} transform={`rotateY(180deg) translateZ(${half}px)`} />
        <Face n={2} transform={`rotateY(90deg) translateZ(${half}px)`} />
        <Face n={5} transform={`rotateY(-90deg) translateZ(${half}px)`} />
        <Face n={3} transform={`rotateX(90deg) translateZ(${half}px)`} />
        <Face n={4} transform={`rotateX(-90deg) translateZ(${half}px)`} />
      </div>
      <style>{`@keyframes tumble { from { transform: rotateX(0) rotateY(0) rotateZ(0) } to { transform: rotateX(360deg) rotateY(720deg) rotateZ(180deg) } }`}</style>
    </div>
  );
}
