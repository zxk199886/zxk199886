import { AnchorProvider, Wallet } from "@coral-xyz/anchor";
import { Connection } from "@solana/web3.js";
import { UnknownClient } from "@unknown/sdk";
import { startApi } from "./api";
import { config } from "./config";
import { Crank } from "./crank";
import { openDb } from "./db";
import { Ingestor } from "./ingest";
import { RewardsPublisher } from "./rewards";

async function main() {
  const conn = new Connection(config.rpcUrl, { commitment: "confirmed", wsEndpoint: config.wsUrl });
  const provider = new AnchorProvider(conn, new Wallet(config.keypair), { commitment: "confirmed" });
  const client = new UnknownClient(provider, config.vrfMode);
  const db = openDb(config.dbPath);

  const programConfig = await client.fetchConfig();
  const ingestor = new Ingestor(db, conn, client);
  await ingestor.backfill();
  ingestor.subscribe();

  startApi(db, ingestor, config.port, {
    curveSupply: BigInt(programConfig.curveSupply.toString()),
    publicUrl: config.publicUrl,
    meta: {
      cluster: config.cluster,
      rpcUrl: config.rpcUrl,
      vrfMode: config.vrfMode,
      protocolFeeBps: programConfig.protocolFeeBps,
      creatorFeeBps: programConfig.creatorFeeBps,
      minDevBuy: programConfig.minDevBuy.toString(),
      maxDevBuy: programConfig.maxDevBuy.toString(),
      fogTickSecs: programConfig.fogTickSecs.toNumber(),
      fogMaxTicks: programConfig.fogMaxTicks,
      curveSupply: programConfig.curveSupply.toString(),
      lpSupply: programConfig.lpSupply.toString(),
      initialVirtualSol: programConfig.initialVirtualSol.toString(),
      initialVirtualTokens: programConfig.initialVirtualTokens.toString(),
    },
  });

  if (config.crank) {
    new Crank(conn, client, config.keypair).start();
    new RewardsPublisher(db, conn, client, config.keypair).start();
  }
  console.log(`[indexer] ${config.cluster} via ${config.rpcUrl} (vrf: ${config.vrfMode}, crank: ${config.crank})`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
