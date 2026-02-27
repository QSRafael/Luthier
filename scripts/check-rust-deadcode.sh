#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if command -v cargo >/dev/null 2>&1; then
  CARGO_BIN="cargo"
elif [[ -x "$HOME/.cargo/bin/cargo" ]]; then
  CARGO_BIN="$HOME/.cargo/bin/cargo"
else
  echo "[rust-deadcode] error: cargo not found in PATH or ~/.cargo/bin/cargo" >&2
  exit 127
fi

EXCLUDE_TAURI=false

for arg in "$@"; do
  case "$arg" in
    --exclude-tauri)
      EXCLUDE_TAURI=true
      ;;
    *)
      echo "Unknown argument: $arg" >&2
      echo "Usage: $0 [--exclude-tauri]" >&2
      exit 2
      ;;
  esac
done

require_cargo_subcommand() {
  local subcommand="$1"
  local install_hint="$2"

  if ! "$CARGO_BIN" "$subcommand" --version >/dev/null 2>&1; then
    echo "[rust-deadcode] error: cargo $subcommand is not installed." >&2
    echo "[rust-deadcode] hint: $install_hint" >&2
    exit 127
  fi
}

RUST_ARGS=(--workspace --all-targets)
if [[ "$EXCLUDE_TAURI" == true ]]; then
  RUST_ARGS+=(--exclude luthier-backend)
fi

require_cargo_subcommand "machete" "install with: cargo install cargo-machete"
require_cargo_subcommand "udeps" "install with: cargo install cargo-udeps"

echo "[rust-deadcode] cargo machete"
"$CARGO_BIN" machete

echo "[rust-deadcode] cargo udeps"
set +e
UDEPS_OUTPUT="$("$CARGO_BIN" udeps "${RUST_ARGS[@]}" 2>&1)"
UDEPS_STATUS=$?
set -e

if (( UDEPS_STATUS == 0 )); then
  if [[ -n "$UDEPS_OUTPUT" ]]; then
    echo "$UDEPS_OUTPUT"
  fi
  echo "[rust-deadcode] ok"
  exit 0
fi

if [[ "$UDEPS_OUTPUT" == *"requires a nightly"* ]] \
  || [[ "$UDEPS_OUTPUT" == *"only accepted on the nightly compiler"* ]] \
  || [[ "$UDEPS_OUTPUT" == *"-Z"*"nightly"* ]]; then
  echo "[rust-deadcode] cargo udeps requires nightly; retrying with +nightly"
  set +e
  UDEPS_NIGHTLY_OUTPUT="$("$CARGO_BIN" +nightly udeps "${RUST_ARGS[@]}" 2>&1)"
  UDEPS_NIGHTLY_STATUS=$?
  set -e

  if (( UDEPS_NIGHTLY_STATUS == 0 )); then
    if [[ -n "$UDEPS_NIGHTLY_OUTPUT" ]]; then
      echo "$UDEPS_NIGHTLY_OUTPUT"
    fi
    echo "[rust-deadcode] ok"
    exit 0
  fi

  echo "$UDEPS_NIGHTLY_OUTPUT" >&2
  echo "[rust-deadcode] error: cargo +nightly udeps failed." >&2
  echo "[rust-deadcode] hint: install nightly with 'rustup toolchain install nightly' and rust-src with 'rustup component add rust-src --toolchain nightly'." >&2
  exit $UDEPS_NIGHTLY_STATUS
fi

echo "$UDEPS_OUTPUT" >&2
echo "[rust-deadcode] error: cargo udeps failed." >&2
exit $UDEPS_STATUS
