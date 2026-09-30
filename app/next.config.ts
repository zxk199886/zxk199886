import type { NextConfig } from "next";

const config: NextConfig = {
  transpilePackages: ["@unknown/sdk"],
  // Wallet adapter's provider tears down its connection in StrictMode's
  // simulated unmount, leaving a selected wallet stuck "disconnected" in dev.
  reactStrictMode: false,
};

export default config;
