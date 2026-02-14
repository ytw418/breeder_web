#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   bash scripts/slack-notify.sh "제목" "본문"
# Env:
#   SLACK_WEBHOOK_URL (preferred)

TITLE="${1:-알림}"
BODY="${2:-}"

WEBHOOK_URL="${SLACK_WEBHOOK_URL:-}"
if [[ -z "${WEBHOOK_URL}" && -f ".env" ]]; then
  line="$(grep -E '^SLACK_WEBHOOK_URL=' .env | tail -n1 || true)"
  if [[ -n "${line}" ]]; then
    WEBHOOK_URL="${line#SLACK_WEBHOOK_URL=}"
    WEBHOOK_URL="${WEBHOOK_URL%\"}"
    WEBHOOK_URL="${WEBHOOK_URL#\"}"
  fi
fi

if [[ -z "${WEBHOOK_URL}" ]]; then
  echo "SLACK_WEBHOOK_URL is not set."
  exit 1
fi

TIMESTAMP="$(date '+%Y-%m-%d %H:%M:%S %Z')"
TEXT="[$TITLE]
$BODY
time: $TIMESTAMP"

PAYLOAD="$(node -e 'console.log(JSON.stringify({ text: process.argv[1] }))' "$TEXT")"

curl -sS -X POST \
  -H "Content-type: application/json" \
  --data "${PAYLOAD}" \
  "${WEBHOOK_URL}" >/dev/null

echo "Slack notification sent."
