import { Buffer } from "buffer";

// The SDK and web3.js expect Node's Buffer in the browser.
if (typeof globalThis !== "undefined" && !(globalThis as { Buffer?: unknown }).Buffer) {
  (globalThis as { Buffer?: unknown }).Buffer = Buffer;
}
