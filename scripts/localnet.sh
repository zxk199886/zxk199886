#!/usr/bin/env bash
# Local validator with Unknown (mock-vrf build), Raydium CPMM and fixtures —
# the same setup `anchor test` uses, for running the app/indexer against.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PROGRAM_ID="$(solana address -k "$ROOT/target/deploy/unknown-keypair.json")"
exec solana-test-validator --reset --quiet --ledger "$ROOT/test-ledger" \
  --bpf-program "$PROGRAM_ID" "$ROOT/target/deploy/unknown.so" \
  --bpf-program CPMMoo8L3F4NbTegBCKVNunggL7H1ZpdTHKxQB5qKP1C "$ROOT/target/cpmm/raydium_cp_swap.so" \
  --account DNXgeM9EiiaAbaWvwjHj9fQQLAX5ZsfHyvmYUNRAdNC8 "$ROOT/tests/fixtures/cpmm-fee-receiver.json" \
  "$@"
