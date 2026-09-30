import { test } from "node:test";
import assert from "node:assert/strict";
import { Keypair } from "@solana/web3.js";
import { HolderMerkleTree, allocate, leafHash } from "./merkle";
import { quoteBuy, quoteSell, type CurveState } from "./curve";
import { nextCoef, unlocked } from "./vault";

test("merkle proofs verify for every leaf, including odd counts", () => {
  for (const n of [1, 2, 3, 5, 8, 13]) {
    const entries = Array.from({ length: n }, (_, i) => ({ holder: Keypair.generate().publicKey, amount: BigInt(i + 1) }));
    const tree = new HolderMerkleTree(entries);
    entries.forEach((e, i) => {
      assert.ok(HolderMerkleTree.verify(tree.proof(i), tree.root, leafHash(e.holder, e.amount)));
      assert.ok(!HolderMerkleTree.verify(tree.proof(i), tree.root, leafHash(e.holder, e.amount + 1n)));
    });
  }
});

test("allocate never exceeds the total", () => {
  const b = [3n, 7n, 11n].map((balance) => ({ holder: Keypair.generate().publicKey, balance }));
  const out = allocate(b, 1_000_003n);
  assert.ok(out.reduce((s, e) => s + e.amount, 0n) <= 1_000_003n);
});

test("curve quotes match on-chain rounding rules", () => {
  const c: CurveState = {
    virtualSol: 30_000_000_000n,
    virtualTokens: 1_073_000_000_000_000n,
    realSol: 0n,
    realTokens: 793_100_000_000_000n,
  };
  const b = quoteBuy(c, 1_000_000_000n, 100);
  assert.equal(b.fee, 10_000_000n);
  const after: CurveState = {
    virtualSol: c.virtualSol + b.solIn,
    virtualTokens: c.virtualTokens - b.tokensOut,
    realSol: b.solIn,
    realTokens: c.realTokens - b.tokensOut,
  };
  const s = quoteSell(after, b.tokensOut, 100)!;
  assert.ok(s.gross <= b.solIn);
  const all = quoteBuy(c, 1_000_000_000_000n, 100);
  assert.equal(all.tokensOut, c.realTokens);
  assert.ok(all.charged < 1_000_000_000_000n);
});

test("vault helpers mirror Rust", () => {
  assert.equal(unlocked(100n, 900n, 1000, 1000 + 3600), 400n);
  assert.equal(nextCoef(10_000, 50n, 100n), 5_000);
  assert.equal(nextCoef(5_000, 100n, 100n), 5_000);
});
