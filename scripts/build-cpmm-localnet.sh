#!/usr/bin/env bash
# Builds Raydium CPMM from source for the local validator, with the local
# wallet as its admin so tests can create an AmmConfig. Output:
# target/cpmm/raydium_cp_swap.so
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/target/cpmm"
[ -f "$OUT/raydium_cp_swap.so" ] && { echo "cpmm already built"; exit 0; }
SRC="${CPMM_SRC:-$ROOT/target/cpmm-src}"
[ -d "$SRC" ] || git clone --depth 1 https://github.com/raydium-io/raydium-cp-swap "$SRC"
cd "$SRC"
# SBF cargo cannot parse edition-2024 crates pulled in by newer blake3.
cargo update -p blake3 --precise 1.5.5 >/dev/null 2>&1 || true
# Upstream needs Anchor 1.x → platform-tools with cargo >= 1.85. cargo-build-sbf
# resolves crates with the currently linked toolchain before switching, so
# install and link the newer tools up front.
TOOLS="${CPMM_TOOLS_VERSION:-v1.52}"
TOOLS_DIR="$HOME/.cache/solana/$TOOLS/platform-tools"
if [ ! -x "$TOOLS_DIR/rust/bin/cargo" ]; then
  rm -rf "$TOOLS_DIR" && mkdir -p "$TOOLS_DIR"
  curl -sSL -o /tmp/platform-tools.tar.bz2 \
    "https://github.com/anza-xyz/platform-tools/releases/download/$TOOLS/platform-tools-linux-x86_64.tar.bz2"
  tar xjf /tmp/platform-tools.tar.bz2 -C "$TOOLS_DIR" && rm /tmp/platform-tools.tar.bz2
fi
rustup toolchain link solana "$TOOLS_DIR/rust"
export CPSWAP_LOCALNET_ADMIN="$(solana address)"
(cd programs/cp-swap && cargo build-sbf --tools-version "$TOOLS" --features localnet)
mkdir -p "$OUT"
cp target/deploy/raydium_cp_swap.so "$OUT/"
echo "built $OUT/raydium_cp_swap.so (admin $CPSWAP_LOCALNET_ADMIN)"
