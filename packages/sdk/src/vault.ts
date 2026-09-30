import { BPS, LIQUID_BPS_PER_PIP, VEST_DURATION_SECS } from "./constants";

export const liquidBpsFor = (d1: number, d2: number) => (d1 + d2) * LIQUID_BPS_PER_PIP;

/** Total the dev may have withdrawn by `now` (unix seconds). Mirrors `math::unlocked`. */
export function unlocked(liquidTotal: bigint, vestTotal: bigint, vestStart: number, now: number): bigint {
  if (vestStart === 0 || now <= vestStart) return liquidTotal;
  const elapsed = BigInt(Math.min(now - vestStart, VEST_DURATION_SECS));
  return liquidTotal + (vestTotal * elapsed) / BigInt(VEST_DURATION_SECS);
}

/** Coefficient after the vault balance falls to `staked`. Mirrors `math::next_coef`. */
export function nextCoef(currentBps: number, staked: bigint, peak: bigint): number {
  if (peak === 0n) return currentBps;
  const ratio = Number((staked * BPS) / peak);
  return Math.min(currentBps, ratio);
}
