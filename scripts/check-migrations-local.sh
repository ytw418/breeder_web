#!/usr/bin/env bash
# 마이그레이션 ↔ schema.prisma 일치 검사(실제 DB 를 쓰지 않는다).
#
# prisma/migrations 를 차례로 적용한 결과가 prisma/schema.prisma 와 같은지 본다. 다르면 차이 SQL 을 보여 주고 실패한다.
# Prisma 는 이 검사에 쓰는 shadow DB 를 매번 비운다. 2026-10-08 에 shadow DB 자리에 공유 dev DB 주소를 넣어 dev 데이터가
# 전부 지워졌다(AGENTS.md 'DB 안전 규칙'). 그래서 이 스크립트는 실행할 때마다 유닉스 소켓만 여는 임시 Postgres 를 만들어
# shadow DB 로 쓰고, 끝나면 지운다. .env 의 DATABASE_URL/DIRECT_URL 은 쓰지 않는다.
#
# 사용: scripts/check-migrations-local.sh [--update-baseline]   (필요: PostgreSQL 서버 바이너리, 맥은 `brew install postgresql@17`)
set -euo pipefail

BIN="${PG_SERVER_BIN:-}"
if [ -z "$BIN" ]; then
  for candidate in /opt/homebrew/opt/postgresql@17/bin $(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -rV); do
    if [ -x "$candidate/initdb" ]; then BIN="$candidate"; break; fi
  done
fi
if [ -z "$BIN" ] || [ ! -x "$BIN/initdb" ]; then
  echo "PostgreSQL 서버 바이너리를 찾지 못했다(PG_SERVER_BIN)." >&2
  exit 2
fi

cd "$(dirname "$0")/.."
# 유닉스 소켓 경로 길이 제한(맥 약 103자) 때문에 /tmp 아래에 만든다.
WORK="$(mktemp -d /tmp/bredy-shadow.XXXXXX)"
cleanup() {
  "$BIN/pg_ctl" -D "$WORK/data" -m immediate stop >/dev/null 2>&1 || true
  rm -rf "$WORK"
}
trap cleanup EXIT
mkdir -p "$WORK/sock"

# 맥에서 로캘이 비어 있으면 postmaster 가 "became multithreaded during startup" 으로 멈춘다.
export LC_ALL=C
"$BIN/initdb" -D "$WORK/data" -U postgres --auth=trust --encoding=UTF8 --no-locale >/dev/null
"$BIN/pg_ctl" -D "$WORK/data" -l "$WORK/server.log" -w \
  -o "-c listen_addresses='' -k $WORK/sock -p 5432" start >/dev/null

# 실제 DB 주소가 섞이지 않게 DB 관련 환경변수를 비운다.
unset DATABASE_URL DIRECT_URL SHADOW_DATABASE_URL

set +e
npx prisma migrate diff \
  --from-migrations prisma/migrations \
  --to-schema-datamodel prisma/schema.prisma \
  --shadow-database-url "postgresql://postgres@localhost:5432/postgres?host=$WORK/sock" \
  --script --exit-code > "$WORK/diff.sql"
STATUS=$?
set -e

if [ "$STATUS" -ne 0 ] && [ "$STATUS" -ne 2 ]; then
  echo "검사를 실행하지 못했다(exit $STATUS)." >&2
  cat "$WORK/diff.sql" >&2 || true
  exit "$STATUS"
fi

# 예전 마이그레이션에는 지금 스키마와 어긋난 부분(relationMode=prisma 인데 만든 FK, 기본값 차이 등)이 남아 있다.
# 그 목록을 scripts/migration-drift-baseline.sql 에 두고, 거기에 없는 '새 차이'만 실패로 본다.
BASELINE="scripts/migration-drift-baseline.sql"
statements() { grep -v '^\s*--' "$1" | tr '\n' ' ' | tr ';' '\n' | sed -E 's/[[:space:]]+/ /g; s/^ //; s/ $//' | grep -v '^$' | sort -u; }
if [ "${1:-}" = "--update-baseline" ]; then
  cp "$WORK/diff.sql" "$BASELINE"
  echo "기준선을 갱신했다: $BASELINE ($(statements "$BASELINE" | wc -l | tr -d ' ')문장)"
  exit 0
fi
statements "$WORK/diff.sql" > "$WORK/now.txt"
if [ -f "$BASELINE" ]; then statements "$BASELINE" > "$WORK/base.txt"; else : > "$WORK/base.txt"; fi
NEW="$(comm -23 "$WORK/now.txt" "$WORK/base.txt")"
FIXED="$(comm -13 "$WORK/now.txt" "$WORK/base.txt")"
if [ -n "$NEW" ]; then
  echo "마이그레이션에 빠진 변경이 있다(아래 SQL 을 새 마이그레이션으로 만든다):" >&2
  echo "$NEW" | sed 's/$/;/' >&2
  exit 1
fi
if [ -n "$FIXED" ]; then
  echo "기준선의 차이 중 $(echo "$FIXED" | grep -c .)개가 해소됐다. scripts/check-migrations-local.sh --update-baseline 으로 기준선을 줄인다."
fi
echo "마이그레이션과 schema.prisma 가 일치한다(기준선의 예전 차이 $(grep -c . "$WORK/base.txt")개 제외)."
