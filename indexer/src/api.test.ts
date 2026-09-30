import { test } from "node:test";
import assert from "node:assert/strict";
import { buildCandles } from "./api";

test("candles bucket trades and chain opens to the previous close", () => {
  const c = buildCandles(
    [
      { ts: 0, price: 1, sol: "1000000000" },
      { ts: 30, price: 3, sol: "1000000000" },
      { ts: 61, price: 2, sol: "500000000" },
    ],
    60,
  );
  assert.deepEqual(c, [
    { time: 0, open: 1, high: 3, low: 1, close: 3, volume: 2 },
    { time: 60, open: 3, high: 3, low: 2, close: 2, volume: 0.5 },
  ]);
});
