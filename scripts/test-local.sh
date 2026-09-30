#!/usr/bin/env bash
# Runs the integration suite on a fresh local validator (mock-vrf build +
# Raydium CPMM). `anchor test` can't manage the validator in some sandboxes,
# so we start it ourselves.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
stop_validator() { pkill -f '^solana-test-validator' 2>/dev/null || true; }
stop_validator
sleep 1
setsid bash scripts/localnet.sh > "$ROOT/.anchor/validator.log" 2>&1 &
trap stop_validator EXIT
for _ in $(seq 1 60); do
  solana cluster-version -u localhost >/dev/null 2>&1 && break
  sleep 1
done
anchor test --skip-build --skip-local-validator --skip-deploy
