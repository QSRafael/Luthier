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

EXCLUDE_TAURI=false
RUN_TESTS=false

for arg in "$@"; do
  case "$arg" in
    --exclude-tauri)
      EXCLUDE_TAURI=true
      ;;
    --with-tests)
      RUN_TESTS=true
      ;;
    *)
      echo "Unknown argument: $arg" >&2
      echo "Usage: $0 [--exclude-tauri] [--with-tests]" >&2
      exit 2
      ;;
  esac
done

RUST_ARGS=(--workspace --all-targets)
if [[ "$EXCLUDE_TAURI" == true ]]; then
  RUST_ARGS+=(--exclude luthier-backend)
fi

# Keep warning-free baseline and add a small curated lint set.
# The extra lints are intentionally selective to reduce noisy style churn.
CLIPPY_LINT_ARGS=(
  -D warnings
  -W clippy::if_not_else
  -W clippy::option_if_let_else
  -W clippy::redundant_pub_crate
  -W clippy::dbg_macro
  -W clippy::todo
  -W clippy::unwrap_used
  -W clippy::expect_used
)

echo "[rust] fmt --check"
"$CARGO_BIN" fmt --all -- --check

echo "[rust] clippy -D warnings + selective pedantic/nursery"
"$CARGO_BIN" clippy "${RUST_ARGS[@]}" -- "${CLIPPY_LINT_ARGS[@]}"

if [[ "$RUN_TESTS" == true ]]; then
  echo "[rust] test"
  "$CARGO_BIN" test "${RUST_ARGS[@]}"
fi
