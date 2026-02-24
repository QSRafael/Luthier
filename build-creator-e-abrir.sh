#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$ROOT_DIR/apps/creator-tauri"
RELEASE_DIR="$APP_DIR/src-tauri/target/release"
ORCH_RESOURCE_DIR="$APP_DIR/src-tauri/resources/orchestrator-base"
ORCH_RESOURCE_BIN="$ORCH_RESOURCE_DIR/orchestrator"

find_mise() {
  if command -v mise >/dev/null 2>&1; then
    command -v mise
    return 0
  fi
  if [[ -x "$HOME/.local/bin/mise" ]]; then
    printf '%s\n' "$HOME/.local/bin/mise"
    return 0
  fi
  return 1
}

open_in_file_manager() {
  local target="$1"
  if command -v xdg-open >/dev/null 2>&1; then
    xdg-open "$target" >/dev/null 2>&1 &
    return 0
  fi
  if command -v gio >/dev/null 2>&1; then
    gio open "$target" >/dev/null 2>&1 &
    return 0
  fi
  return 1
}

MISE_BIN="$(find_mise || true)"
if [[ -z "${MISE_BIN:-}" ]]; then
  echo "Erro: 'mise' não foi encontrado (nem em \$HOME/.local/bin/mise)." >&2
  exit 1
fi

export PATH="$HOME/.cargo/bin:$PATH"

echo "Compilando orquestrador base (release)..."
cd "$ROOT_DIR"
cargo build -p orchestrator --release

mkdir -p "$ORCH_RESOURCE_DIR"
cp "$ROOT_DIR/target/release/orchestrator" "$ORCH_RESOURCE_BIN"
chmod +x "$ORCH_RESOURCE_BIN" || true
echo "Orquestrador base copiado para recurso do Creator:"
echo "  $ORCH_RESOURCE_BIN"
echo

cd "$APP_DIR"

if [[ ! -d node_modules ]]; then
  echo "Instalando dependências npm..."
  "$MISE_BIN" exec -- npm install
fi

echo "Compilando o Creator (Tauri build, sem bundle)..."
"$MISE_BIN" exec -- npm run tauri:build

echo
echo "Build concluído."
echo "Pasta do executável: $RELEASE_DIR"

if [[ -d "$RELEASE_DIR" ]]; then
  echo "Executáveis encontrados na pasta release:"
  find "$RELEASE_DIR" -maxdepth 1 -type f -executable -printf '  - %f\n' | sort || true
fi

if ! open_in_file_manager "$RELEASE_DIR"; then
  echo "Aviso: não foi possível abrir o navegador de arquivos automaticamente." >&2
fi
