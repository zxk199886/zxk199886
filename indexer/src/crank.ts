import { randomBytes } from "node:crypto";
import {
  SYSVAR_CLOCK_PUBKEY,
  Transaction,
  sendAndConfirmTransaction,
  type Connection,
  type Keypair,
  type TransactionInstruction,
} from "@solana/web3.js";
import { randomnessAccount, type LaunchAccount, type UnknownClient } from "@unknown/sdk";
import { config } from "./config";

/**
 * Keeps launches moving. Every step is permissionless on-chain; the crank
 * just pays fees so users never have to. In `mock` VRF mode (local
 * validator) it also plays the oracle by injecting fresh random bytes.
 */
export class Crank {
  private busy = new Set<string>();
  private timer?: NodeJS.Timeout;

  constructor(
    private conn: Connection,
    private client: UnknownClient,
    private signer: Keypair,
  ) {}

  start() {
    const tick = async () => {
      try {
        await this.runOnce();
      } catch (e) {
        console.error("[crank]", (e as Error).message);
      }
      this.timer = setTimeout(tick, config.crankIntervalMs);
    };
    void tick();
  }

  stop() {
    clearTimeout(this.timer);
  }

  private async chainTime(): Promise<number> {
    const info = await this.conn.getAccountInfo(SYSVAR_CLOCK_PUBKEY, "confirmed");
    // Clock: slot u64, epoch_start_timestamp i64, epoch u64, leader_schedule_epoch u64, unix_timestamp i64
    return info ? Number(info.data.readBigInt64LE(32)) : Math.floor(Date.now() / 1000);
  }

  private async send(ixs: TransactionInstruction[]) {
    return sendAndConfirmTransaction(this.conn, new Transaction().add(...ixs), [this.signer], { commitment: "confirmed" });
  }

  async runOnce() {
    const launches = await this.client.fetchAllLaunches();
    // Program checks use the on-chain clock, which can lag wall time.
    const now = await this.chainTime();
    await Promise.all(
      launches.map(async ({ account }) => {
        const key = account.mint.toBase58();
        if (this.busy.has(key)) return;
        this.busy.add(key);
        try {
          await this.step(account, now);
        } catch (e) {
          const msg = (e as Error).message;
          const code = /Error Code: (\w+)/.exec(msg)?.[1] ?? msg.split("\n")[0];
          console.error(`[crank] ${key.slice(0, 6)}…`, code);
        } finally {
          this.busy.delete(key);
        }
      }),
    );
  }

  /**
   * Local oracle: answer a pending request with fresh randomness. With ORAO,
   * the oracle answers on its own and settle/resolve simply retry until the
   * program stops reporting `RandomnessNotReady`.
   */
  private async mockOracle(seed: number[]) {
    if (this.client.vrfMode !== "mock") return;
    const acc = randomnessAccount(Uint8Array.from(seed), "mock");
    if (await this.conn.getAccountInfo(acc, "confirmed")) return;
    await this.send([await this.client.mockFulfill(this.signer.publicKey, Uint8Array.from(seed), randomBytes(64))]);
  }

  private async step(l: LaunchAccount, now: number) {
    const mint = l.mint;
    switch (this.client.stateOf(l)) {
      case "rolling": {
        if (!l.vrfPending) return;
        await this.mockOracle(l.vrfSeed);
        try {
          await this.send([await this.client.settleLaunch(this.signer.publicKey, mint)]);
          console.log(`[crank] dice landed ${mint.toBase58().slice(0, 6)}…`);
        } catch (e) {
          if (now >= l.vrfRequestedAt.toNumber() + l.vrfTimeoutSecs.toNumber()) {
            await this.send([await this.client.refundLaunch(mint)]);
            console.log(`[crank] refunded ${mint.toBase58().slice(0, 6)}… (VRF timeout)`);
          } else if (!String(e).includes("RandomnessNotReady")) throw e;
        }
        return;
      }
      case "fogged": {
        if (!l.vrfPending) {
          if (now >= l.fogDeadline.toNumber()) {
            await this.send([await this.client.fogResolve(mint)]);
          } else if (now >= l.nextTickAt.toNumber()) {
            await this.send([await this.client.fogRequest(this.signer.publicKey, mint)]);
          }
          return;
        }
        await this.mockOracle(l.vrfSeed);
        try {
          await this.send([await this.client.fogResolve(mint)]);
          const after = await this.client.fetchLaunch(mint);
          if (this.client.stateOf(after) === "trading") console.log(`[crank] fog lifted ${mint.toBase58().slice(0, 6)}…`);
        } catch (e) {
          if (!String(e).includes("RandomnessNotReady")) throw e;
        }
        return;
      }
      case "complete": {
        if (!config.cpmm.ammConfig) return;
        await this.send(
          await this.client.graduate(this.signer.publicKey, mint, {
            ammConfig: config.cpmm.ammConfig,
            cpmmProgram: config.cpmm.program,
            createPoolFee: config.cpmm.createPoolFee,
          }),
        );
        console.log(`[crank] graduated ${mint.toBase58().slice(0, 6)}…`);
        return;
      }
      default:
        return;
    }
  }
}
