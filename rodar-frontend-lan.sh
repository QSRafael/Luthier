#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$ROOT_DIR/apps/creator-tauri"
PORT="${PORT:-1420}"
HOST="${HOST:-0.0.0.0}"

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

port_in_use() {
  if command -v lsof >/dev/null 2>&1; then
    lsof -tiTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1
    return $?
  fi
  return 1
}

local_ip() {
  if command -v hostname >/dev/null 2>&1; then
    hostname -I 2>/dev/null | awk '{print $1}'
    return 0
  fi
  return 1
}

MISE_BIN="$(find_mise || true)"
if [[ -z "${MISE_BIN:-}" ]]; then
  echo "Erro: 'mise' não foi encontrado (nem em \$HOME/.local/bin/mise)." >&2
  exit 1
fi

cd "$APP_DIR"

if [[ ! -d node_modules ]]; then
  echo "Instalando dependências npm..."
  "$MISE_BIN" exec -- npm install
fi

if port_in_use; then
  echo "Erro: a porta $PORT já está em uso." >&2
  if command -v lsof >/dev/null 2>&1; then
    echo "Processo(s) escutando na porta $PORT:" >&2
    lsof -iTCP:"$PORT" -sTCP:LISTEN -n -P >&2 || true
  fi
  echo "Feche o processo antigo ou use: PORT=1421 ./rodar-frontend-lan.sh" >&2
  exit 1
fi

IP_ADDR="$(local_ip || true)"
echo "Subindo frontend (Vite) em modo LAN..."
echo "URL local: http://127.0.0.1:$PORT"
if [[ -n "${IP_ADDR:-}" ]]; then
  echo "URL na rede: http://$IP_ADDR:$PORT"
fi
echo

exec "$MISE_BIN" exec -- npm run dev -- --host "$HOST" --port "$PORT"

