"use client";

import { CandlestickSeries, ColorType, createChart, type IChartApi, type ISeriesApi, type UTCTimestamp } from "lightweight-charts";
import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { useLive } from "@/lib/hooks";

const INTERVALS = [
  { s: 5, label: "5s" },
  { s: 60, label: "1m" },
  { s: 300, label: "5m" },
];

const css = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

/** Market cap in SOL (price × 1B supply) reads better than a 1e-8 price. */
export function PriceChart({ mint }: { mint: string }) {
  const el = useRef<HTMLDivElement>(null);
  const chart = useRef<IChartApi>(null);
  const series = useRef<ISeriesApi<"Candlestick">>(null);
  const [interval, setInterval_] = useState(60);
  const { data } = useLive(() => api.candles(mint, interval), [mint, interval], { mint, everyMs: 10_000 });

  useEffect(() => {
    if (!el.current) return;
    const c = createChart(el.current, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: css("--faint"),
        fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
        fontSize: 11,
        attributionLogo: false,
      },
      grid: { vertLines: { color: "rgba(236,235,242,0.035)" }, horzLines: { color: "rgba(236,235,242,0.035)" } },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false, timeVisible: true, secondsVisible: true },
      crosshair: { vertLine: { color: "rgba(154,150,255,0.35)" }, horzLine: { color: "rgba(154,150,255,0.35)" } },
    });
    series.current = c.addSeries(CandlestickSeries, {
      upColor: css("--up"),
      downColor: css("--down"),
      borderVisible: false,
      wickUpColor: css("--up"),
      wickDownColor: css("--down"),
      priceFormat: { type: "price", precision: 2, minMove: 0.01 },
    });
    chart.current = c;
    return () => c.remove();
  }, []);

  useEffect(() => {
    if (!series.current || !data) return;
    series.current.setData(
      data.map((k) => ({
        time: k.time as UTCTimestamp,
        open: k.open * 1e9,
        high: k.high * 1e9,
        low: k.low * 1e9,
        close: k.close * 1e9,
      })),
    );
  }, [data]);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-4 pt-3">
        <span className="label">Market cap · SOL</span>
        <div className="flex gap-1">
          {INTERVALS.map((i) => (
            <button
              key={i.s}
              onClick={() => setInterval_(i.s)}
              className={`num rounded-md px-2 py-0.5 text-[0.6875rem] ${interval === i.s ? "bg-raised text-fg" : "text-faint hover:text-fg"}`}
            >
              {i.label}
            </button>
          ))}
        </div>
      </div>
      <div ref={el} className="min-h-0 flex-1" />
    </div>
  );
}
