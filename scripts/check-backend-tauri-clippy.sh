#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if command -v cargo >/dev/null 2>&1; then
  CARGO_BIN="cargo"
elif [[ -x "$HOME/.cargo/bin/cargo" ]]; then
  CARGO_BIN="$HOME/.cargo/bin/cargo"
else
  echo "cargo not found in PATH or ~/.cargo/bin/cargo" >&2
  exit 127
fi

echo "[rust] clippy luthier-backend tauri commands with warnings denied"
"$CARGO_BIN" clippy -p luthier-backend --all-targets --features tauri-commands -- -D warnings
