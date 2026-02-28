#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

RUN_FRONTEND=true
RUN_RUST_QUALITY=true
RUN_RUST_ARCHITECTURE=true
RUN_RUST_SECURITY=true
RUN_RUST_DEADCODE=true

EXCLUDE_TAURI=true
RUST_WITH_TESTS=true
RUST_WITH_TESTS_EXPLICIT=false
MODE="full"

usage() {
  cat <<'USAGE'
Usage: scripts/check-quality.sh [options]

Modes:
  --full             Run full project gate (default, includes rust tests)
  --fast             Run quick gate (frontend + rust quality)

Subset controls:
  --frontend-only    Run only frontend quality gate
  --rust-only        Run all rust gates (quality, architecture, security, deadcode)
  --skip-frontend
  --skip-rust-quality
  --skip-rust-architecture
  --skip-rust-security
  --skip-rust-deadcode

Rust options:
  --include-tauri    Include luthier-backend in rust quality/deadcode checks
  --with-tests       Force running existing rust tests in rust quality gate

Other:
  -h, --help         Show this help
USAGE
}

run_step() {
  local label="$1"
  local script_path="$2"
  shift 2

  echo "[quality] $label"
  "$script_path" "$@"
}

for arg in "$@"; do
  case "$arg" in
    --full)
      MODE="full"
      RUN_FRONTEND=true
      RUN_RUST_QUALITY=true
      RUN_RUST_ARCHITECTURE=true
      RUN_RUST_SECURITY=true
      RUN_RUST_DEADCODE=true
      ;;
    --fast)
      MODE="fast"
      RUN_FRONTEND=true
      RUN_RUST_QUALITY=true
      RUN_RUST_ARCHITECTURE=false
      RUN_RUST_SECURITY=false
      RUN_RUST_DEADCODE=false
      ;;
    --frontend-only)
      MODE="frontend-only"
      RUN_FRONTEND=true
      RUN_RUST_QUALITY=false
      RUN_RUST_ARCHITECTURE=false
      RUN_RUST_SECURITY=false
      RUN_RUST_DEADCODE=false
      ;;
    --rust-only)
      MODE="rust-only"
      RUN_FRONTEND=false
      RUN_RUST_QUALITY=true
      RUN_RUST_ARCHITECTURE=true
      RUN_RUST_SECURITY=true
      RUN_RUST_DEADCODE=true
      ;;
    --skip-frontend)
      RUN_FRONTEND=false
      ;;
    --skip-rust-quality)
      RUN_RUST_QUALITY=false
      ;;
    --skip-rust-architecture)
      RUN_RUST_ARCHITECTURE=false
      ;;
    --skip-rust-security)
      RUN_RUST_SECURITY=false
      ;;
    --skip-rust-deadcode)
      RUN_RUST_DEADCODE=false
      ;;
    --include-tauri)
      EXCLUDE_TAURI=false
      ;;
    --with-tests)
      RUST_WITH_TESTS=true
      RUST_WITH_TESTS_EXPLICIT=true
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $arg" >&2
      usage >&2
      exit 2
      ;;
  esac
done

if [[ "$RUST_WITH_TESTS_EXPLICIT" == false ]]; then
  if [[ "$MODE" == "full" ]]; then
    RUST_WITH_TESTS=true
  else
    RUST_WITH_TESTS=false
  fi
fi

if [[ "$RUN_FRONTEND" == false ]] \
  && [[ "$RUN_RUST_QUALITY" == false ]] \
  && [[ "$RUN_RUST_ARCHITECTURE" == false ]] \
  && [[ "$RUN_RUST_SECURITY" == false ]] \
  && [[ "$RUN_RUST_DEADCODE" == false ]]; then
  echo "[quality] error: no gate selected." >&2
  usage >&2
  exit 2
fi

RUST_QUALITY_ARGS=()
RUST_DEADCODE_ARGS=()

if [[ "$EXCLUDE_TAURI" == true ]]; then
  RUST_QUALITY_ARGS+=(--exclude-tauri)
  RUST_DEADCODE_ARGS+=(--exclude-tauri)
fi

if [[ "$RUST_WITH_TESTS" == true ]]; then
  RUST_QUALITY_ARGS+=(--with-tests)
fi

echo "[quality] mode=$MODE"

if [[ "$RUN_FRONTEND" == true ]]; then
  run_step "frontend-quality" "$ROOT_DIR/scripts/check-frontend-quality.sh"
fi

if [[ "$RUN_RUST_QUALITY" == true ]]; then
  run_step "rust-quality" "$ROOT_DIR/scripts/check-rust-quality.sh" "${RUST_QUALITY_ARGS[@]}"
fi

if [[ "$RUN_RUST_ARCHITECTURE" == true ]]; then
  run_step "rust-architecture" "$ROOT_DIR/scripts/check-rust-architecture.sh"
fi

if [[ "$RUN_RUST_SECURITY" == true ]]; then
  run_step "rust-security" "$ROOT_DIR/scripts/check-rust-security.sh"
fi

if [[ "$RUN_RUST_DEADCODE" == true ]]; then
  run_step "rust-deadcode" "$ROOT_DIR/scripts/check-rust-deadcode.sh" "${RUST_DEADCODE_ARGS[@]}"
fi

echo "[quality] ok"
