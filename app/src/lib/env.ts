export type Cluster = "localnet" | "devnet" | "mainnet";

export const env = {
  cluster: (process.env.NEXT_PUBLIC_CLUSTER ?? "localnet") as Cluster,
  rpcUrl: process.env.NEXT_PUBLIC_RPC_URL ?? "http://127.0.0.1:8899",
  indexerUrl: process.env.NEXT_PUBLIC_INDEXER_URL ?? "http://localhost:8787",
  vrfMode: (process.env.NEXT_PUBLIC_VRF_MODE ?? "mock") as "mock" | "orao",
};

export const explorerTx = (sig: string) =>
  env.cluster === "localnet"
    ? `https://explorer.solana.com/tx/${sig}?cluster=custom&customUrl=${encodeURIComponent(env.rpcUrl)}`
    : `https://solscan.io/tx/${sig}${env.cluster === "devnet" ? "?cluster=devnet" : ""}`;

export const explorerAccount = (addr: string) =>
  env.cluster === "localnet"
    ? `https://explorer.solana.com/address/${addr}?cluster=custom&customUrl=${encodeURIComponent(env.rpcUrl)}`
    : `https://solscan.io/account/${addr}${env.cluster === "devnet" ? "?cluster=devnet" : ""}`;
