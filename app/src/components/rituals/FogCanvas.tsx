"use client";

import { useEffect, useRef } from "react";

/**
 * Drifting fog: fractal value noise rendered at low resolution and scaled
 * up, so it stays cheap. `clear` (0..1) opens a hole from the centre.
 */
export function FogCanvas({ className = "", density = 1, clear = 0 }: { className?: string; density?: number; clear?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const clearRef = useRef(clear);
  clearRef.current = clear;

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const W = 160;
    const H = 96;
    canvas.width = W;
    canvas.height = H;
    const img = ctx.createImageData(W, H);

    // Hash-based value noise.
    const perm = new Uint8Array(512);
    for (let i = 0; i < 256; i++) perm[i] = i;
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [perm[i], perm[j]] = [perm[j], perm[i]];
    }
    for (let i = 0; i < 256; i++) perm[i + 256] = perm[i];
    const grid = (x: number, y: number) => perm[(perm[x & 255] + y) & 511] / 255;
    const smooth = (t: number) => t * t * (3 - 2 * t);
    const noise = (x: number, y: number) => {
      const xi = Math.floor(x);
      const yi = Math.floor(y);
      const xf = smooth(x - xi);
      const yf = smooth(y - yi);
      const a = grid(xi, yi);
      const b = grid(xi + 1, yi);
      const c = grid(xi, yi + 1);
      const d = grid(xi + 1, yi + 1);
      return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf;
    };

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    const start = performance.now();
    const draw = (now: number) => {
      const t = (now - start) / 1000;
      const open = clearRef.current;
      let p = 0;
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const nx = x / 34;
          const ny = y / 34;
          let v = 0;
          let amp = 0.55;
          let f = 1;
          for (let o = 0; o < 4; o++) {
            v += amp * noise(nx * f + t * 0.09 * (o + 1), ny * f - t * 0.05 * (o + 1));
            f *= 2.03;
            amp *= 0.5;
          }
          // Radial opening for the lift.
          const dx = (x - W / 2) / (W / 2);
          const dy = (y - H / 2) / (H / 2);
          const r = Math.sqrt(dx * dx + dy * dy);
          const hole = open > 0 ? Math.min(1, Math.max(0, (r - open * 1.6 + 0.35) / 0.35)) : 1;
          const a = Math.max(0, Math.min(1, (v - 0.28) * 1.9)) * density * hole;
          img.data[p++] = 214;
          img.data[p++] = 210;
          img.data[p++] = 226;
          img.data[p++] = a * 200;
        }
      }
      ctx.putImageData(img, 0, 0);
      if (!reduce) raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [density]);

  return <canvas ref={ref} className={className} style={{ imageRendering: "auto", filter: "blur(6px)" }} aria-hidden />;
}
