#!/usr/bin/env bash
# 백업 복원 검사: 덤프를 '이번 실행 전용 임시 Postgres'에 복원해 보고 테이블별 행 수를 보여 준다.
# 임시 클러스터는 TCP 를 열지 않고(유닉스 소켓만) 끝나면 통째로 지운다. 원격 DB 에는 절대 접속하지 않는다.
#
# 사용: scripts/db-restore-check.sh <덤프 파일(.dump)>
#   필요: PostgreSQL 서버 바이너리(initdb·pg_ctl·pg_restore·psql). 맥은 `brew install postgresql@17`.
#   PG_SERVER_BIN 으로 경로를 바꿀 수 있다. 덤프를 만든 서버와 같거나 높은 메이저 버전이어야 한다.
# 성공 조건: 복원 오류 0건, "User" 테이블 행이 1개 이상.
set -euo pipefail

DUMP="${1:-}"
if [ -z "$DUMP" ] || [ ! -f "$DUMP" ]; then
  echo "사용: $0 <덤프 파일>" >&2
  exit 2
fi
if [ -f "$DUMP.sha256" ]; then
  ( cd "$(dirname "$DUMP")" && shasum -a 256 -c "$(basename "$DUMP").sha256" >/dev/null ) \
    || { echo "체크섬이 맞지 않는다: $DUMP" >&2; exit 1; }
fi

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

# 유닉스 소켓 경로 길이 제한(맥 약 103자) 때문에 긴 $TMPDIR 대신 /tmp 아래에 만든다.
WORK="$(mktemp -d /tmp/bredy-restore.XXXXXX)"
DATA="$WORK/data"
SOCK="$WORK/sock"
mkdir -p "$SOCK"
cleanup() {
  "$BIN/pg_ctl" -D "$DATA" -m immediate stop >/dev/null 2>&1 || true
  rm -rf "$WORK"
}
trap cleanup EXIT

# 맥에서 로캘이 비어 있으면 postmaster 가 "became multithreaded during startup" 으로 멈춘다.
export LC_ALL=C
"$BIN/initdb" -D "$DATA" -U postgres --auth=trust --encoding=UTF8 --no-locale >/dev/null
# listen_addresses='' → TCP 를 열지 않는다. 접속은 이 실행의 소켓 디렉터리로만 된다.
"$BIN/pg_ctl" -D "$DATA" -l "$WORK/server.log" -w \
  -o "-c listen_addresses='' -k $SOCK -p 5432" start >/dev/null

export PGHOST="$SOCK" PGPORT=5432 PGUSER=postgres PGDATABASE=postgres
unset PGPASSWORD PGSSLMODE

# Supabase 전용 역할(anon·authenticated 등) 권한·소유자는 빼고 복원한다.
set +e
"$BIN/pg_restore" --no-owner --no-privileges --dbname=postgres "$DUMP" 2> "$WORK/restore.err"
set -e
# 새 클러스터에도 public 스키마가 있어 'schema "public" already exists' 는 늘 난다(무해). 그 밖의 오류만 센다.
grep "^pg_restore: error" "$WORK/restore.err" | grep -v 'schema "public" already exists' > "$WORK/restore.real-err" || true
ERRORS="$(grep -c "^pg_restore: error" "$WORK/restore.real-err" || true)"

COUNTS="$("$BIN/psql" -X -A -t -F $'\t' -c "
  select c.relname, (xpath('/row/n/text()', query_to_xml(format('select count(*) as n from public.%I', c.relname), false, true, '')))[1]::text
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r' order by 1")"
if command -v column >/dev/null; then echo "$COUNTS" | column -t -s $'\t'; else echo "$COUNTS"; fi

USERS="$(echo "$COUNTS" | awk -F'\t' '$1=="User"{print $2}')"
echo "---"
echo "복원 오류: ${ERRORS}건, 테이블 $(echo "$COUNTS" | grep -c . ) 개, User ${USERS:-0} 행"
if [ "$ERRORS" -gt 0 ]; then
  head -40 "$WORK/restore.real-err" >&2
  exit 1
fi
if [ "${USERS:-0}" -lt 1 ]; then
  echo "User 테이블이 비어 있다." >&2
  exit 1
fi
echo "복원 검사 통과: $DUMP"
