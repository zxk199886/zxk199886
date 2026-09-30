// Copies the Anchor build's IDL and TS types into the SDK so every package
// (app, indexer, tests) consumes one source of truth.
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "packages/sdk/src/idl");
mkdirSync(out, { recursive: true });
copyFileSync(join(root, "target/idl/unknown.json"), join(out, "unknown.json"));
copyFileSync(join(root, "target/types/unknown.ts"), join(out, "unknown.ts"));
console.log("IDL synced to packages/sdk/src/idl");
