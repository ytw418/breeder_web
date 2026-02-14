#!/usr/bin/env bash
set -euo pipefail

echo "[1/3] lint"
npm run lint

echo "[2/3] typecheck"
npm run typecheck

echo "[3/3] test"
npm test -- --ci --runInBand

echo "CI verification completed."
