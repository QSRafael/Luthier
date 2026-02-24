#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "[quality] frontend"
"$ROOT_DIR/scripts/check-frontend-quality.sh"

echo "[quality] rust"
"$ROOT_DIR/scripts/check-rust-quality.sh" --exclude-tauri

echo "[quality] ok"
