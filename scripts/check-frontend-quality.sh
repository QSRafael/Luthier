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

cd "$APP_DIR"

echo "[frontend] typecheck"
run_npm run typecheck

echo "[frontend] build"
run_npm run build
