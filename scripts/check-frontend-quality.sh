#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_DIR="$ROOT_DIR/apps/luthier"

run_npm() {
  if command -v mise >/dev/null 2>&1; then
    mise exec -- npm "$@"
  elif [[ -x "$HOME/.local/bin/mise" ]]; then
    "$HOME/.local/bin/mise" exec -- npm "$@"
  else
    npm "$@"
  fi
}

run_gate() {
  local gate_name="$1"
  echo "[frontend] $gate_name"
  run_npm run "$gate_name"
}

cd "$APP_DIR"

run_gate "typecheck"
run_gate "lint"
run_gate "format:check"
run_gate "knip"
run_gate "depcruise"
run_gate "madge:circular"
run_gate "test:unit"
run_gate "build"
