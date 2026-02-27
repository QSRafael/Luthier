#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RULES_FILE="$ROOT_DIR/scripts/rust-architecture.rules"

if ! command -v rg >/dev/null 2>&1; then
  echo "[rust-arch] error: rg (ripgrep) is required but was not found in PATH." >&2
  exit 127
fi

if [[ ! -f "$RULES_FILE" ]]; then
  echo "[rust-arch] error: rules file not found: $RULES_FILE" >&2
  exit 2
fi

mapfile -t RUST_FILES < <(cd "$ROOT_DIR" && rg --files apps bins crates -g '*.rs')

if [[ ${#RUST_FILES[@]} -eq 0 ]]; then
  echo "[rust-arch] no Rust files found under apps/, bins/, crates/."
  exit 0
fi

violated_rules=0
checked_rules=0

while IFS=$'\t' read -r rule_id scope_regex forbidden_regex allow_regex message; do
  [[ -z "${rule_id// }" ]] && continue
  [[ "$rule_id" == \#* ]] && continue

  ((checked_rules += 1))

  rule_targets=()
  for file in "${RUST_FILES[@]}"; do
    if [[ "$file" =~ $scope_regex ]]; then
      if [[ "$allow_regex" != "-" && "$file" =~ $allow_regex ]]; then
        continue
      fi
      rule_targets+=("$file")
    fi
  done

  if [[ ${#rule_targets[@]} -eq 0 ]]; then
    continue
  fi

  matches="$(cd "$ROOT_DIR" && rg -nH --color=never -e "$forbidden_regex" -- "${rule_targets[@]}" || true)"

  if [[ -n "$matches" ]]; then
    ((violated_rules += 1))
    echo "[rust-arch] FAIL $rule_id"
    echo "  $message"
    while IFS= read -r line; do
      echo "  - $line"
    done <<< "$matches"
    echo
  fi
done < "$RULES_FILE"

if (( checked_rules == 0 )); then
  echo "[rust-arch] error: no rules were loaded from $RULES_FILE" >&2
  exit 2
fi

if (( violated_rules > 0 )); then
  echo "[rust-arch] blocked: $violated_rules rule(s) violated." >&2
  exit 1
fi

echo "[rust-arch] ok: $checked_rules rule(s) checked, no violations found."
