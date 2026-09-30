/**
 * Seeds a local validator with activity: several launches from fresh
 * wallets, then random trading once each fog lifts. Run the indexer (crank)
 * alongside so dice land and fog ticks resolve.
 *
 *   pnpm demo [launches=4] [--graduate]
 */
import { AnchorProvider, Wallet } from "@coral-xyz/anchor";
import { Connection, Keypair, LAMPORTS_PER_SOL, Transaction, sendAndConfirmTransaction, type PublicKey } from "@solana/web3.js";
import { UnknownClient, curveOf, quoteBuy } from "@unknown/sdk";
import { TOKEN_2022_PROGRAM_ID, getAccount, getAssociatedTokenAddressSync } from "@solana/spl-token";

const rpc = process.env.RPC_URL ?? "http://127.0.0.1:8899";
const indexer = process.env.INDEXER_URL ?? "http://localhost:8787";
const conn = new Connection(rpc, "confirmed");
const count = Number(process.argv.find((a) => /^\d+$/.test(a)) ?? 4);
const graduateOne = process.argv.includes("--graduate");
const SOL = BigInt(LAMPORTS_PER_SOL);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const NAMES = [
  ["Veil", "VEIL", "What the fog hides, the chain remembers."],
  ["Nox Oracle", "NOX", "A coin that only speaks at night."],
  ["Second Sight", "SIGHT", "You see it before it happens. Or not."],
  ["Hollow Moon", "HMOON", "Tidal. Unknowable. Mostly harmless."],
  ["Loaded Die", "LDIE", "The dice were fair. We checked."],
  ["Quiet Signal", "QSIG", "Low frequency, high conviction."],
];

async function wallet(sol: number) {
  const kp = Keypair.generate();
  await conn.confirmTransaction(await conn.requestAirdrop(kp.publicKey, sol * LAMPORTS_PER_SOL), "confirmed");
  return kp;
}

const clientFor = (kp: Keypair) => new UnknownClient(new AnchorProvider(conn, new Wallet(kp), {}), "mock");

function sigil(seed: number) {
  // Tiny SVG glyph as token art.
  const hue = (seed * 57) % 360;
  const pts = Array.from({ length: 7 }, (_, i) => {
    const a = (i / 7) * Math.PI * 2 * ((seed % 3) + 2);
    return `${50 + Math.cos(a) * 34},${50 + Math.sin(a) * 34}`;
  }).join(" ");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="#0b0b10"/><circle cx="50" cy="50" r="40" fill="none" stroke="hsl(${hue} 60% 70%)" stroke-width="1"/><polygon points="${pts}" fill="none" stroke="hsl(${hue} 70% 75%)" stroke-width="1.5"/></svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

async function metadataUri(i: number) {
  const [name, symbol, description] = NAMES[i % NAMES.length];
  try {
    const res = await fetch(`${indexer}/api/metadata`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, symbol, description, image: sigil(i + 1) }),
    });
    return { name, symbol, uri: ((await res.json()) as { uri: string }).uri };
  } catch {
    return { name, symbol, uri: "" };
  }
}

async function tokenBalance(mint: PublicKey, owner: PublicKey) {
  try {
    const a = await getAccount(conn, getAssociatedTokenAddressSync(mint, owner, true, TOKEN_2022_PROGRAM_ID), "confirmed", TOKEN_2022_PROGRAM_ID);
    return a.amount;
  } catch {
    return 0n;
  }
}

async function main() {
  const mints: { mint: PublicKey; creator: Keypair }[] = [];
  for (let i = 0; i < count; i++) {
    const creator = await wallet(20);
    const c = clientFor(creator);
    const meta = await metadataUri(i);
    const devBuy = BigInt(Math.floor((0.2 + Math.random() * 3) * 1e9));
    const { ixs, mint } = await c.createLaunch({ creator: creator.publicKey, ...meta, devBuyLamports: devBuy });
    await sendAndConfirmTransaction(conn, new Transaction().add(...ixs), [creator, mint]);
    console.log(`launched ${meta.symbol} ${mint.publicKey.toBase58()}`);
    mints.push({ mint: mint.publicKey, creator });
    await sleep(1500);
  }

  const traders = await Promise.all(Array.from({ length: 5 }, () => wallet(graduateOne ? 300 : 60)));
  const reader = clientFor(traders[0]);
  const deadline = Date.now() + 8 * 60_000;
  let graduated = !graduateOne;
  let withdrew = false;
  while (Date.now() < deadline) {
    // One dev sells their dice-freed tokens: the vault coefficient drops and
    // part of every later creator fee goes to holders instead.
    if (!withdrew && mints.length > 1) {
      const { mint, creator } = mints[1];
      const c = clientFor(creator);
      if (c.stateOf(await c.fetchLaunch(mint)) === "trading") {
        const v = await c.fetchVault(mint);
        const amount = BigInt(v.liquidTotal.toString());
        await sendAndConfirmTransaction(conn, new Transaction().add(await c.withdrawFromVault(creator.publicKey, mint, amount)), [creator]);
        await sendAndConfirmTransaction(conn, new Transaction().add(await c.sell(creator.publicKey, mint, amount, 0n)), [creator]);
        console.log(`dev of ${mint.toBase58().slice(0, 6)}… withdrew and sold ${amount}`);
        withdrew = true;
      }
    }
    for (const { mint } of mints) {
      const l = await reader.fetchLaunch(mint);
      if (reader.stateOf(l) !== "trading") continue;
      const t = traders[Math.floor(Math.random() * traders.length)];
      const c = clientFor(t);
      const held = await tokenBalance(mint, t.publicKey);
      try {
        if (!graduated && mint.equals(mints[0].mint)) {
          const ix = await c.buy(t.publicKey, mint, 100n * SOL, 0n);
          await sendAndConfirmTransaction(conn, new Transaction().add(ix), [t]);
          graduated = reader.stateOf(await reader.fetchLaunch(mint)) !== "trading";
          console.log(`whale buy on ${mint.toBase58().slice(0, 6)}…`);
        } else if (held > 0n && Math.random() < 0.35) {
          const amt = (held * BigInt(20 + Math.floor(Math.random() * 60))) / 100n;
          await sendAndConfirmTransaction(conn, new Transaction().add(await c.sell(t.publicKey, mint, amt, 0n)), [t]);
        } else {
          const sol = BigInt(Math.floor((0.05 + Math.random() * 1.5) * 1e9));
          const q = quoteBuy(curveOf(l), sol, 100);
          await sendAndConfirmTransaction(conn, new Transaction().add(await c.buy(t.publicKey, mint, sol, (q.tokensOut * 95n) / 100n)), [t]);
        }
      } catch (e) {
        console.log("trade skipped:", (e as Error).message.split("\n")[0]);
      }
    }
    await sleep(1200);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
