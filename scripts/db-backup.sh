#!/usr/bin/env bash
# DB 논리 백업(pg_dump, 읽기 전용). DB 를 바꾸지 않는다. 계획·복원 절차는 docs/ops/db-backup.md.
#
# 사용: scripts/db-backup.sh <prod|dev> [출력 디렉터리]
#   접속 주소는 환경변수 BACKUP_DATABASE_URL, 없으면 ~/.config/bredy-backup/<prod|dev>.url(chmod 600)에서 읽는다.
#   Supabase 세션 풀러(포트 5432) 주소를 쓴다. 트랜잭션 풀러(6543)로는 pg_dump 가 동작하지 않는다.
#   출력: <디렉터리>/bredy-<env>-<UTC시각>.dump(custom 형식, public 스키마) + .sha256
#   기본 디렉터리: ~/bredy-backups/<env> (권한 700/600)
set -euo pipefail

ENV_NAME="${1:-}"
case "$ENV_NAME" in
  prod) EXPECTED_REF="nbtiaibtenjitjuverwy" ;; # Supabase 'bredy'
  dev) EXPECTED_REF="pqvayhabtayjfpklhxxj" ;;  # Supabase 'breeder2'
  *) echo "사용: $0 <prod|dev> [출력 디렉터리]" >&2; exit 2 ;;
esac

URL="${BACKUP_DATABASE_URL:-}"
URL_FILE="$HOME/.config/bredy-backup/$ENV_NAME.url"
if [ -z "$URL" ] && [ -f "$URL_FILE" ]; then
  URL="$(tr -d '[:space:]' < "$URL_FILE")"
fi
if [ -z "$URL" ]; then
  echo "접속 주소가 없다: BACKUP_DATABASE_URL 또는 $URL_FILE" >&2
  exit 2
fi
# 다른 DB 를 백업해 놓고 '운영 백업'으로 착각하지 않게 project ref 를 확인한다.
case "$URL" in
  *"$EXPECTED_REF"*) ;;
  *) echo "주소가 $ENV_NAME($EXPECTED_REF) DB 가 아니다. 멈춘다." >&2; exit 1 ;;
esac

# 주소를 PG* 환경변수로 풀어 넘긴다. 비밀번호에 '@' 같은 문자가 인코딩 없이 들어 있어도 되고,
# 접속 오류 메시지·프로세스 목록에 비밀번호가 찍히지 않는다.
eval "$(BACKUP_URL="$URL" python3 - <<'PY'
import os, shlex
from urllib.parse import unquote
url = os.environ["BACKUP_URL"]
scheme, rest = url.split("://", 1)
userinfo, hostpart = rest.rsplit("@", 1)  # 비밀번호 속 '@' 를 견디려고 마지막 '@' 로 나눈다
user, _, password = userinfo.partition(":")
hostport, _, dbq = hostpart.partition("/")
host, _, port = hostport.partition(":")
db = dbq.split("?", 1)[0] or "postgres"
for key, value in (("PGHOST", host), ("PGPORT", port or "5432"), ("PGUSER", unquote(user)),
                   ("PGPASSWORD", unquote(password)), ("PGDATABASE", db), ("PGSSLMODE", "require")):
    print(f"export {key}={shlex.quote(value)}")
PY
)"
unset URL

PG_BIN="${PG_BIN:-}"
if [ -z "$PG_BIN" ]; then
  if [ -x /opt/homebrew/opt/libpq/bin/pg_dump ]; then PG_BIN=/opt/homebrew/opt/libpq/bin
  else PG_BIN="$(dirname "$(command -v pg_dump)")"; fi
fi

OUT_DIR="${2:-$HOME/bredy-backups/$ENV_NAME}"
umask 077
mkdir -p "$OUT_DIR"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
FILE="$OUT_DIR/bredy-$ENV_NAME-$STAMP.dump"
# 실패하면 반쯤 쓴 파일을 남기지 않는다(빈 파일을 백업으로 착각하지 않게).
trap 'rm -f "$FILE"' ERR

# pg_dump 는 서버보다 같거나 높은 메이저 버전이어야 한다(운영 PG17, dev PG15).
"$PG_BIN/pg_dump" --schema=public --format=custom --compress=6 --file="$FILE"

TABLES="$("$PG_BIN/pg_restore" --list "$FILE" | grep -c " TABLE DATA " || true)"
if [ "$TABLES" -eq 0 ]; then
  echo "덤프에 테이블 데이터가 없다: $FILE" >&2
  exit 1
fi
( cd "$OUT_DIR" && shasum -a 256 "$(basename "$FILE")" > "$(basename "$FILE").sha256" )
SIZE="$(du -h "$FILE" | cut -f1)"
echo "백업 완료: $FILE ($SIZE, 테이블 데이터 $TABLES 개)"
