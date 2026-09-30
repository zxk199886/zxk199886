"use client";

import type { LaunchAccount } from "@unknown/sdk";
import { FogCanvas } from "../rituals/FogCanvas";

/** Covers the chart while the market is closed. Shows the odds, never a time. */
export function FogVeil({ launch }: { launch: LaunchAccount }) {
  const rolling = "rolling" in (launch.state as object);
  const tick = launch.fogTick;
  const left = launch.fogMaxTicks - tick;
  return (
    <div className="relative h-full overflow-hidden rounded-[inherit]">
      <FogCanvas className="absolute inset-0 h-full w-full" />
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="rite text-xl text-bone sm:text-2xl">{rolling ? "The dice are cast" : "The market opens when it opens"}</p>
        {!rolling && (
          <p className="num text-xs text-muted">
            tick {tick + 1} of at most {launch.fogMaxTicks} · chance this tick opens: 1 in {left}
          </p>
        )}
        <p className="max-w-sm text-xs leading-relaxed text-faint">
          {rolling
            ? "The oracle is deciding how much of the dev buy is free. Trading stays closed until the dice land."
            : "Each tick draws fresh randomness. No one, including the dev and the platform, knows which tick opens the market."}
        </p>
      </div>
    </div>
  );
}
