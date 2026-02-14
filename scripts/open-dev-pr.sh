#!/usr/bin/env bash
set -euo pipefail

SKIP_VERIFY="${1:-}"
CURRENT_BRANCH="$(git branch --show-current)"

if [[ "${CURRENT_BRANCH}" != "dev" ]]; then
  echo "Current branch is '${CURRENT_BRANCH}'. Switch to 'dev' first."
  exit 1
fi

if ! command -v gh >/dev/null 2>&1; then
  echo "'gh' CLI is required. Install GitHub CLI first."
  exit 1
fi

if [[ "${SKIP_VERIFY}" != "--skip-verify" ]]; then
  echo "[pre-check] Running verification before PR..."
  npm run verify:ci
fi

if [[ -n "$(git status --porcelain)" ]]; then
  echo "Working tree is not clean. Commit or stash changes before opening PR."
  exit 1
fi

echo "[push] git push origin dev"
git push origin dev

EXISTING_PR_URL="$(gh pr list --state open --base main --head dev --json url --jq '.[0].url')"

if [[ -n "${EXISTING_PR_URL}" && "${EXISTING_PR_URL}" != "null" ]]; then
  echo "[info] Open PR already exists: ${EXISTING_PR_URL}"
  gh pr view "${EXISTING_PR_URL}" --web
  exit 0
fi

echo "[create] Opening new PR: dev -> main"
gh pr create \
  --base main \
  --head dev \
  --title "Release: dev to main" \
  --body "## Summary
- Promote latest changes from dev to main

## Verification
- [x] npm run verify:ci
" \
  --web
