#!/usr/bin/env bash
set -euo pipefail

echo "[1/4] lint"
npm run lint

echo "[2/4] typecheck"
npm run typecheck

echo "[3/4] test"
npm test -- --ci --runInBand

echo "[4/4] build"
npm run build

echo "CI verification completed."
