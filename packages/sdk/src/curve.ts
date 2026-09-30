import { BPS, TOKEN_UNIT } from "./constants";

/** Mirrors `programs/unknown/src/math.rs`. All amounts are raw integer units. */
export interface CurveState {
  virtualSol: bigint;
  virtualTokens: bigint;
  realSol: bigint;
  realTokens: bigint;
}

const ceilDiv = (n: bigint, d: bigint) => (n + d - 1n) / d;

export function feeOn(amount: bigint, feeBps: number): bigint {
  return ceilDiv(amount * BigInt(feeBps), BPS);
}

export function grossForNet(net: bigint, feeBps: number): bigint {
  const gross = ceilDiv(net * BPS, BPS - BigInt(feeBps));
  return gross - feeOn(gross, feeBps) >= net ? gross : gross + 1n;
}

export function quoteBuyNet(c: CurveState, solIn: bigint): { solIn: bigint; tokensOut: bigint } {
  const out = (c.virtualTokens * solIn) / (c.virtualSol + solIn);
  if (out < c.realTokens) return { solIn, tokensOut: out };
  const cost = ceilDiv(c.virtualSol * c.realTokens, c.virtualTokens - c.realTokens);
  return { solIn: cost < solIn ? cost : solIn, tokensOut: c.realTokens };
}

/** Quote a buy of `gross` lamports (fees included), as `buy` executes it. */
export function quoteBuy(c: CurveState, gross: bigint, feeBps: number) {
  const net = gross - feeOn(gross, feeBps);
  const q = quoteBuyNet(c, net);
  const charged = q.solIn < net ? minBig(grossForNet(q.solIn, feeBps), gross) : gross;
  return { tokensOut: q.tokensOut, solIn: q.solIn, fee: charged - q.solIn, charged };
}

/** Quote a sell of `tokens`, net of fees. */
export function quoteSell(c: CurveState, tokens: bigint, feeBps: number) {
  const gross = (c.virtualSol * tokens) / (c.virtualTokens + tokens);
  if (gross > c.realSol) return null;
  const fee = feeOn(gross, feeBps);
  return { gross, fee, solOut: gross - fee };
}

const minBig = (a: bigint, b: bigint) => (a < b ? a : b);

/** Price in SOL per whole token. */
export function priceSol(c: CurveState): number {
  return (Number(c.virtualSol) / 1e9) / (Number(c.virtualTokens) / Number(TOKEN_UNIT));
}

/** Market cap in SOL for a total supply (raw units). */
export function marketCapSol(c: CurveState, totalSupply: bigint): number {
  return priceSol(c) * (Number(totalSupply) / Number(TOKEN_UNIT));
}

/** Bonding progress 0..1 (share of curve supply sold). */
export function progress(c: CurveState, curveSupply: bigint): number {
  if (curveSupply === 0n) return 1;
  return 1 - Number(c.realTokens) / Number(curveSupply);
}

export function withSlippage(amount: bigint, slippageBps: number): bigint {
  return (amount * (BPS - BigInt(slippageBps))) / BPS;
}
