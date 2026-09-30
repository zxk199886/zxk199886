import { PublicKey } from "@solana/web3.js";
import { sha256 } from "@noble/hashes/sha256";

/** Mirrors `math::merkle_leaf` / `math::verify_merkle`: sorted pairs, domain-separated. */
export function leafHash(holder: PublicKey, amount: bigint): Uint8Array {
  const amt = Buffer.alloc(8);
  amt.writeBigUInt64LE(amount);
  return sha256(Buffer.concat([Buffer.from([0]), holder.toBuffer(), amt]));
}

function parent(a: Uint8Array, b: Uint8Array): Uint8Array {
  const [l, r] = Buffer.compare(Buffer.from(a), Buffer.from(b)) <= 0 ? [a, b] : [b, a];
  return sha256(Buffer.concat([Buffer.from([1]), l, r]));
}

export interface MerkleEntry {
  holder: PublicKey;
  amount: bigint;
}

export class HolderMerkleTree {
  readonly leaves: Uint8Array[];
  readonly layers: Uint8Array[][];

  constructor(readonly entries: MerkleEntry[]) {
    if (entries.length === 0) throw new Error("empty tree");
    this.leaves = entries.map((e) => leafHash(e.holder, e.amount));
    this.layers = [this.leaves];
    while (this.layers[this.layers.length - 1].length > 1) {
      const prev = this.layers[this.layers.length - 1];
      const next: Uint8Array[] = [];
      for (let i = 0; i < prev.length; i += 2) {
        // Odd node is promoted unchanged.
        next.push(i + 1 < prev.length ? parent(prev[i], prev[i + 1]) : prev[i]);
      }
      this.layers.push(next);
    }
  }

  get root(): Uint8Array {
    return this.layers[this.layers.length - 1][0];
  }

  proof(index: number): Uint8Array[] {
    const proof: Uint8Array[] = [];
    let i = index;
    for (let l = 0; l < this.layers.length - 1; l++) {
      const layer = this.layers[l];
      const sibling = i ^ 1;
      if (sibling < layer.length) proof.push(layer[sibling]);
      i >>= 1;
    }
    return proof;
  }

  static verify(proof: Uint8Array[], root: Uint8Array, leaf: Uint8Array): boolean {
    let node = leaf;
    for (const s of proof) node = parent(node, s);
    return Buffer.compare(Buffer.from(node), Buffer.from(root)) === 0;
  }
}

/**
 * Pro-rata split of `total` lamports across balances, rounding down; the
 * rounding dust stays in the pool for a later epoch.
 */
export function allocate(balances: { holder: PublicKey; balance: bigint }[], total: bigint): MerkleEntry[] {
  const sum = balances.reduce((s, b) => s + b.balance, 0n);
  if (sum === 0n) return [];
  return balances
    .map((b) => ({ holder: b.holder, amount: (total * b.balance) / sum }))
    .filter((e) => e.amount > 0n);
}
