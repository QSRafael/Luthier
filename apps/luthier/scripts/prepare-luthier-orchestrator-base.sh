#!/usr/bin/env bash
set -euo pipefail

PROFILE="${1:-debug}"
if [[ "$PROFILE" != "debug" && "$PROFILE" != "release" ]]; then
  echo "Uso: $0 [debug|release]" >&2
  exit 1
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
RESOURCE_DIR="$ROOT_DIR/apps/luthier/src-tauri/resources/luthier-orchestrator-base"
RESOURCE_BIN="$RESOURCE_DIR/luthier-orchestrator"
SOURCE_BIN="$ROOT_DIR/target/$PROFILE/luthier-orchestrator"

find_cargo() {
  if command -v cargo >/dev/null 2>&1; then
    command -v cargo
    return 0
  fi
  if [[ -x "$HOME/.cargo/bin/cargo" ]]; then
    printf '%s\n' "$HOME/.cargo/bin/cargo"
    return 0
  fi
  return 1
}

CARGO_BIN="$(find_cargo || true)"
if [[ -z "${CARGO_BIN:-}" ]]; then
  echo "Erro: cargo não encontrado (nem em \$HOME/.cargo/bin/cargo)." >&2
  exit 1
fi

mkdir -p "$RESOURCE_DIR"

needs_build="1"
if [[ -f "$SOURCE_BIN" && -f "$RESOURCE_BIN" && "$RESOURCE_BIN" -nt "$SOURCE_BIN" ]]; then
  needs_build="0"
fi

if [[ "$needs_build" == "1" ]]; then
  echo "[luthier] Compilando Luthier Orchestrator base ($PROFILE)..."
  if [[ "$PROFILE" == "release" ]]; then
    "$CARGO_BIN" build -p luthier-orchestrator --release --manifest-path "$ROOT_DIR/Cargo.toml"
  else
    "$CARGO_BIN" build -p luthier-orchestrator --manifest-path "$ROOT_DIR/Cargo.toml"
  fi
else
  echo "[luthier] Reutilizando Luthier Orchestrator base já compilado ($PROFILE)."
fi

if [[ ! -f "$SOURCE_BIN" ]]; then
  echo "Erro: binário do Luthier Orchestrator não encontrado após build: $SOURCE_BIN" >&2
  exit 1
fi

cp "$SOURCE_BIN" "$RESOURCE_BIN"
chmod +x "$RESOURCE_BIN" || true
echo "[luthier] Recurso do Luthier Orchestrator pronto: $RESOURCE_BIN"
