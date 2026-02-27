#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if command -v cargo >/dev/null 2>&1; then
  CARGO_BIN="cargo"
elif [[ -x "$HOME/.cargo/bin/cargo" ]]; then
  CARGO_BIN="$HOME/.cargo/bin/cargo"
else
  echo "[rust-security] error: cargo not found in PATH or ~/.cargo/bin/cargo" >&2
  exit 127
fi

require_cargo_subcommand() {
  local subcommand="$1"
  local install_hint="$2"

  if ! "$CARGO_BIN" "$subcommand" --version >/dev/null 2>&1; then
    echo "[rust-security] error: cargo $subcommand is not installed." >&2
    echo "[rust-security] hint: $install_hint" >&2
    exit 127
  fi
}

DENY_CONFIG="$ROOT_DIR/deny.toml"

if [[ ! -f "$DENY_CONFIG" ]]; then
  echo "[rust-security] error: missing config file $DENY_CONFIG" >&2
  exit 2
fi

require_cargo_subcommand "deny" "install with: cargo install cargo-deny"
require_cargo_subcommand "audit" "install with: cargo install cargo-audit"

echo "[rust-security] cargo deny (advisories, licenses, bans, sources)"
"$CARGO_BIN" deny -L error check --config "$DENY_CONFIG" advisories licenses bans sources

echo "[rust-security] cargo audit"
"$CARGO_BIN" audit

echo "[rust-security] ok"
