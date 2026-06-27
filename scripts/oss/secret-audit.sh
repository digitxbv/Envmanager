#!/usr/bin/env bash
# Pre-cutover secret audit for the EnvManager OSS split.
# Scans (1) the working tree and (2) the FULL git history for committed secrets.
# Exits non-zero if gitleaks finds anything, so this is safe to gate the cutover on.
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"
REPORT_DIR="${ROOT}/scripts/oss/.audit"
mkdir -p "$REPORT_DIR"

if ! command -v gitleaks >/dev/null 2>&1; then
  echo "gitleaks not found. Install with: brew install gitleaks" >&2
  exit 127
fi

echo "==> [1/3] Scanning tracked working tree (no git history)"
gitleaks detect \
  --source "$ROOT" \
  --config "$ROOT/.gitleaks.toml" \
  --no-git \
  --redact \
  --report-format json \
  --report-path "$REPORT_DIR/worktree.json" \
  --verbose

echo "==> [2/3] Scanning FULL git history (all commits)"
gitleaks detect \
  --source "$ROOT" \
  --config "$ROOT/.gitleaks.toml" \
  --redact \
  --report-format json \
  --report-path "$REPORT_DIR/history.json" \
  --verbose

echo "==> [3/3] Confirming .env is NOT tracked by git"
if git ls-files --error-unmatch .env >/dev/null 2>&1; then
  echo "FAIL: .env is tracked by git. Remove it before cutover." >&2
  exit 1
fi
echo "OK: .env is not tracked."

echo "==> Audit complete. Reports in $REPORT_DIR"
