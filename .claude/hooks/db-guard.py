#!/usr/bin/env python3
"""
DB 보호 하네스 — Claude Code PreToolUse 훅.

2026-10-08 22:15 KST, 마이그레이션 SQL 을 맞춰 보려고
`prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel ... --shadow-database-url <.env DIRECT_URL>`
을 실행해 dev DB(Supabase breeder2) 데이터가 통째로 지워졌다. Prisma 는 shadow DB 를 매번 비우고 마이그레이션을
처음부터 다시 적용한다. Free 플랜이라 백업이 없어 운영 데이터를 복사해 되살렸다.

막는 것(deny)
  - DB 를 비우는 도구: prisma migrate reset/dev, db push, db execute, --force-reset/--accept-data-loss,
    supabase db reset/push, supabase projects/branches/orgs delete, Supabase 관리 API 의 DELETE·SQL 실행,
    시드 --reset, dropdb, pg_restore --clean/-c
  - shadow DB 가 localhost 가 아닌 prisma migrate diff(--from/--to-migrations 는 localhost shadow 를 직접 넘겨야 한다)
  - DB 실행 맥락의 DROP·TRUNCATE·ALTER TABLE … DROP·WHERE 없는(또는 WHERE true) DELETE/UPDATE
  - 조건 없는 deleteMany()/updateMany()
  - 저장소의 scripts/check-migration-safety.mjs 가 막는 마이그레이션이 있을 때의 prisma migrate deploy
  - 백업 보관 폴더(~/bredy-backups, ~/.config/bredy-backup) 삭제
  - schema.prisma 의 shadowDatabaseUrl, localhost 가 아닌 SHADOW_DATABASE_URL
묻는 것(ask)
  - 백업 복원·기록 수정: supabase backups restore, supabase migration repair, prisma migrate resolve
  - 데이터를 쓰는 도구: 시드(prisma db seed, npm run seed*, seed*.ts), import 스크립트, prisma studio,
    supabase db query, supabase storage rm/secrets unset, pg_restore(목록 보기 제외)
  - psql 에 SQL 파일·표준입력을 넘기거나 쓰기 SQL(INSERT/UPDATE/ALTER/CREATE/GRANT/…)을 실행할 때
  - 운영 DB(Supabase bredy) 주소가 들어간 명령(읽기 전용 pg_dump·백업 스크립트 제외)
  - vercel env 로 DB 주소 바꾸기, Vercel MCP 로 프로젝트 설정·환경변수·배포 승격·롤백
  - 파괴적 SQL 이 든 마이그레이션 파일 작성(`-- bredy:allow-destructive <이유>` 줄이 있으면 통과)
허용: prisma migrate deploy/status/validate/generate, localhost shadow 를 쓰는 migrate diff,
      scripts/db-backup.sh · db-restore-check.sh · check-migrations-local.sh, 읽기 쿼리.

검사 대상 도구: Bash, Write/Edit/MultiEdit/NotebookEdit, Desktop Commander(start_process·interact_with_process·
write_file·edit_block), Paseo 터미널(send_terminal_keys), Vercel MCP 설정 변경.

규칙 원문: 각 저장소 AGENTS.md 'DB 안전 규칙'. 사본: bredy_app·breeder_web 의 .claude/hooks/db-guard.py
(셋을 같은 내용으로 유지한다). 테스트: 같은 폴더의 db-guard_test.py.
"""
import json
import os
import re
import subprocess
import sys

FLAGS = re.IGNORECASE | re.DOTALL

PROD_REF = "nbtiaibtenjitjuverwy"  # Supabase 'bredy'(운영)
PROD_HOST_HINT = r"aws-1-ap-northeast-2\.pooler\.supabase\.com"
LOCAL_DB_URL = r"""["']?postgres(?:ql)?://(?:[^@/"'\s]*@)?(?:localhost|127\.0\.0\.1|\[::1\])[:/]"""
SHADOW_FLAG = r"--shadow-database-url(?:=|\s+)"
# npx prisma@6 / pnpm dlx prisma / bunx prisma 처럼 버전·실행기가 붙어도 잡는다.
PRISMA = r"prisma(?:@[\w.^~-]+)?\s+"

# (패턴, 이유) — 명령 전체(여러 줄 heredoc 포함)에 대해 검사한다.
DENY_COMMAND = [
    (PRISMA + r"migrate\s+reset\b", "prisma migrate reset 은 DB 를 통째로 비운다."),
    (PRISMA + r"migrate\s+dev\b", "prisma migrate dev 는 drift 가 있으면 DB 를 reset 한다. 적용은 `prisma migrate deploy`, 검사는 scripts/check-migrations-local.sh 를 쓴다."),
    (PRISMA + r"db\s+push\b", "prisma db push 는 컬럼·테이블을 지울 수 있다. 마이그레이션 파일 + `migrate deploy` 만 쓴다."),
    (PRISMA + r"db\s+execute\b", "prisma db execute 로 SQL 을 직접 실행하지 않는다."),
    (r"--force-reset\b|--accept-data-loss\b", "데이터를 지우는 플래그(--force-reset/--accept-data-loss)는 쓰지 않는다."),
    (r"supabase\s+db\s+(reset|push)\b", "supabase db reset/push 는 원격 DB 를 비우거나 바꾼다."),
    (r"supabase\s+(projects|branches|orgs)\s+delete\b", "Supabase 프로젝트·브랜치를 지우지 않는다."),
    (r"api\.supabase\.com[^\n]*(-X\s*DELETE|--request\s+DELETE|/database/query)|(-X\s*DELETE|--request\s+DELETE|/database/query)[^\n]*api\.supabase\.com",
     "Supabase 관리 API 로 삭제하거나 SQL 을 실행하지 않는다."),
    (r"seed:dummy:reset|seed[\w:-]*\s+--\s+[^|;&\n]*--reset\b|seed[\w-]*\.ts[^|;&\n]*--reset\b", "시드 --reset 은 기존 데이터를 지운다."),
    (r"\bdropdb\b", "dropdb 는 DB 를 지운다."),
    (r"pg_restore\b[^|;&\n]*(--clean\b|(?-i:\s-[a-zA-Z]*c[a-zA-Z]*\b))", "pg_restore --clean/-c 는 복원 전에 테이블을 지운다."),
    (r"\brm\b[^|;&\n]*(bredy-backups|\.config/bredy-backup)", "백업 보관 폴더를 지우지 않는다."),
]

# SQL 키워드는 DB 를 실행하는 맥락에서만 본다(커밋 메시지·문서의 단어는 통과).
DB_EXEC_CONTEXT = r"\b(psql|pgcli|mysql|sqlite3|prisma|supabase|node|tsx|ts-node|bun|deno|python3?|curl)\b|\$executeRaw|executeRawUnsafe|\$queryRaw|queryRawUnsafe"
DENY_SQL = [
    (r"\bdrop\s+(table|schema|database|owned|index|type|view|materialized\s+view|sequence|extension|function|trigger|policy|role|user)\b",
     "DROP 을 실행하지 않는다."),
    # SQL 문법 모양일 때만: TABLE·ONLY, 따옴표 식별자, 또는 이름 뒤에 ; , ) CASCADE·RESTRICT·RESTART·CONTINUE·줄 끝,
    # 따옴표로 끝나는 -c 인자. Tailwind 클래스(`truncate text-[16px]`)는 막지 않는다(2026-10-09 오탐).
    (r"\btruncate\s+(?:table\b|only\b|[\\\"']|[\w.]+\s*(?:[;,)]|$|\b(?:cascade|restrict|restart|continue)\b|[\"'`]\s*(?:$|[;&|)])))",
     "TRUNCATE 를 실행하지 않는다."),
    (r"\balter\s+table\b[^;]*?\bdrop\b", "ALTER TABLE … DROP 을 실행하지 않는다."),
]
# psql 로 쓰기 SQL 을 실행하거나 파일·표준입력을 넘기는 경우 → 사람이 확인
PSQL_WRITE = r"\b(insert\s+into|update\s+[\\\"'\w.]+\s+set|delete\s+from|alter\s+(table|type|role|database|schema)|create\s+(table|role|user|schema|index|type|extension|function|trigger|policy)|grant\b|revoke\b|comment\s+on|copy\s+[\\\"'\w.]+\s+from|vacuum\s+full|reindex|cluster\b)"

ASK_COMMAND = [
    (r"supabase\s+backups\s+restore\b", "백업 복원은 지금 DB 내용을 덮어쓴다. 사용자가 직접 확인해야 한다."),
    (r"supabase\s+migration\s+repair\b", "migration repair 는 마이그레이션 기록을 바꾼다. 사용자가 직접 확인해야 한다."),
    (r"supabase\s+db\s+query\b", "supabase db query 는 원격 DB 에 SQL 을 실행한다. 대상과 내용을 사용자가 확인해야 한다."),
    (r"supabase\s+(storage\s+(rm|mv)|secrets\s+unset)\b", "Supabase 저장소·비밀값을 지운다. 사용자가 확인해야 한다."),
    (PRISMA + r"migrate\s+resolve\b", "migrate resolve 는 마이그레이션 기록을 바꾼다. 사용자가 직접 확인해야 한다."),
    (PRISMA + r"studio\b", "prisma studio 는 .env 의 DB 행을 바로 고치거나 지울 수 있다. 사용자가 확인해야 한다."),
    (PRISMA + r"db\s+seed\b|\bnpm\s+run\s+seed\b|\bnpm\s+run\s+seed:|\b(ts-node|tsx|node)\b[^|;&\n]*\bseed[\w-]*\.(ts|js|mjs)\b|\bnpm\s+run\s+import:",
     "시드·import 는 공유 DB 에 데이터를 넣거나 지운다. 어느 DB 인지 사용자가 확인해야 한다."),
    (r"\bvercel\s+env\s+(add|rm|remove|update)\b", "Vercel 환경변수(특히 DB 주소)를 바꾸면 앱이 다른 DB 에 쓴다. 사용자가 확인해야 한다."),
]

# 운영 DB 주소가 들어간 명령 조각 중 읽기 전용으로 보는 것
PROD_READ_ONLY = r"^\s*(\w+=\S+\s+)*(\S*/)?(pg_dump|pg_restore\s+(--list|-l)|supabase\s+(backups\s+list|projects\s+list))\b|^\s*(\S*/)?scripts/db-backup\.sh\b"

# Write/Edit 로 만드는 스크립트 안의 파괴적 코드
DENY_FILE_CONTENT = [
    (r"(executeRawUnsafe|\$executeRaw)[^\n]*\b(drop\s+(table|schema|database)|truncate)\b", "raw SQL 로 DROP/TRUNCATE 를 실행하는 코드를 넣지 않는다."),
    (PRISMA + r"migrate\s+(reset|dev)\b|--force-reset|--accept-data-loss|" + PRISMA + r"db\s+push\b", "DB 를 초기화하는 prisma 명령을 스크립트에 넣지 않는다."),
    (r"\bshadowDatabaseUrl\b", "schema.prisma 에 shadowDatabaseUrl 을 두지 않는다(실제 DB 가 shadow 로 비워질 수 있다)."),
]
FILE_CONTENT_EXEMPT = re.compile(r"(/prisma/migrations/|/\.claude/hooks/db-guard(_test)?\.py$|/AGENTS\.md$|/CLAUDE\.md$|/memory/[^/]+\.md$|/docs/)")
MIGRATION_FILE = re.compile(r"/prisma/migrations/[^/]+/migration\.sql$")

# 마이그레이션 파일의 파괴적 SQL — breeder_web scripts/check-migration-safety.mjs 의 RULES 와 같게 유지한다.
DESTRUCTIVE_MARKER = re.compile(r"^\s*--\s*bredy:allow-destructive\b[ \t]*\S", re.MULTILINE)
DESTRUCTIVE_SQL = [
    (r"\bdrop\s+table\b", "DROP TABLE"),
    (r"\balter\s+table\b[^;]*?\bdrop\s+column\b", "DROP COLUMN"),
    (r"\bdrop\s+schema\b", "DROP SCHEMA"),
    (r"\btruncate\b", "TRUNCATE"),
    (r"\bdelete\s+from\b", "DELETE FROM"),
    (r"\balter\s+table\b[^;]*?\balter\s+column\b[^;]*?\btype\b", "ALTER COLUMN TYPE"),
    (r"\bupdate\s+[\"\w.]+\s+set\b", "UPDATE"),
]

VERCEL_MCP_ASK = re.compile(r"^mcp__claude_ai_Vercel__(edit_project_env|create_project_env|update_project|create_deployment|request_promote|request_rollback|pause_project|assign_alias)$")


def strip_sql_comments(sql: str) -> str:
    sql = re.sub(r"/\*.*?\*/", " ", sql, flags=re.DOTALL)
    return re.sub(r"--[^\n]*", " ", sql)


def destructive_statements(sql: str) -> list:
    body = strip_sql_comments(sql)
    return [label for pattern, label in DESTRUCTIVE_SQL if re.search(pattern, body, FLAGS)]


def decide(decision: str, reason: str) -> None:
    print(json.dumps({
        "hookSpecificOutput": {
            "hookEventName": "PreToolUse",
            "permissionDecision": decision,
            "permissionDecisionReason": f"[DB 보호 하네스] {reason} (AGENTS.md 'DB 안전 규칙')",
        }
    }, ensure_ascii=False))
    sys.exit(0)


def strip_message_text(command: str) -> str:
    """git/gh 에 넘기는 메시지·본문(커밋 메시지, PR 본문)은 실행되지 않으므로 검사에서 뺀다.
    같은 명령줄의 다른 부분(예: `git commit -m x && <위험 명령>`)은 그대로 검사한다."""
    command = re.sub(
        r"(\b(?:git|gh)\b[^\n]*<<-?\s*['\"]?(\w+)['\"]?[^\n]*\n)(.*?)(\n\2\b)",
        r"\1\4",
        command,
        flags=re.DOTALL,
    )
    command = re.sub(
        r"(\s--?(?:m|message|body|title|notes))\s+(\"(?:\\.|[^\"\\])*\"|'[^']*')",
        r"\1 ''",
        command,
    )
    return command


def unscoped_sql_write(text: str):
    """WHERE 없는(또는 WHERE true / 1=1) DELETE FROM·UPDATE … SET 문장. 문장 끝은 ; 또는 ` 또는 텍스트 끝."""
    for match in re.finditer(r"\b(delete\s+from|update)\s+[\\\"'\w.]+(\s+set\b)?", text, FLAGS):
        is_delete = match.group(1).lower().startswith("delete")
        if not is_delete and not match.group(2):
            continue
        end = len(text)
        for stop in (";", "`"):
            at = text.find(stop, match.end())
            if at != -1:
                end = min(end, at)
        where = re.search(r"\bwhere\b\s*(\S+(\s*=\s*\S+)?)?", text[match.end():end], FLAGS)
        if not where or re.match(r"(true|1\s*=\s*1)\b", where.group(1) or "", FLAGS):
            return "DELETE" if is_delete else "UPDATE"
    return None


def unscoped_bulk_call(text: str):
    """조건 없는 deleteMany()/updateMany(). 인자가 변수 하나면 알 수 없으므로 넘어간다."""
    for match in re.finditer(r"\b(deleteMany|updateMany)\s*\(", text):
        depth, i = 1, match.end()
        while i < len(text) and depth:
            depth += {"(": 1, ")": -1}.get(text[i], 0)
            i += 1
        args = text[match.end():i - 1]
        if re.fullmatch(r"\s*[A-Za-z_$][\w$.]*\s*", args):
            continue
        if not re.search(r"\bwhere\b\s*(:(?!\s*\{\s*\})|[,}])", args):
            return match.group(1)
    return None


def shadow_problem(text: str):
    """shadow DB 를 쓰는 migrate diff 가 localhost 가 아닌 DB 를 가리키면 이유를 돌려준다."""
    shadows = re.findall(SHADOW_FLAG + r"(\S+)", text, FLAGS)
    if any(not re.match(LOCAL_DB_URL, value, FLAGS) for value in shadows):
        return ("shadow DB 는 매번 비워진다(2026-10-08 dev DB 삭제 사고). shadow 주소는 localhost 만 쓴다 "
                "— scripts/check-migrations-local.sh 가 임시 Postgres 를 띄워 검사한다.")
    if re.search(r"--(from|to)-migrations\b", text, FLAGS) and not shadows:
        return "--from/--to-migrations 에는 localhost shadow DB 를 직접 넘긴다(scripts/check-migrations-local.sh)."
    return None


def repo_dir_for(command: str, cwd: str) -> str:
    match = re.search(r"\bcd\s+(\"[^\"]+\"|'[^']+'|\S+)\s*(&&|;)", command)
    path = match.group(1).strip("\"'") if match else cwd
    return os.path.expanduser(path)


def migration_check_failure(repo: str):
    """저장소의 scripts/check-migration-safety.mjs 를 돌려 실패 메시지를 돌려준다(없으면 None)."""
    script = os.path.join(repo, "scripts", "check-migration-safety.mjs")
    if not os.path.isfile(script):
        return None
    try:
        result = subprocess.run(["node", script], cwd=repo, capture_output=True, text=True, timeout=30)
    except Exception as error:  # node 가 없거나 멈추면 배포를 막는다
        return f"마이그레이션 안전 검사를 실행하지 못했다: {error}"
    if result.returncode != 0:
        return (result.stdout + result.stderr).strip()[-600:]
    return None


def check_command(command: str, cwd: str) -> None:
    command = strip_message_text(command).replace("\\\n", " ")
    for pattern, reason in DENY_COMMAND:
        if re.search(pattern, command, FLAGS):
            decide("deny", reason)
    reason = shadow_problem(command)
    if reason:
        decide("deny", reason)
    bulk = unscoped_bulk_call(command)
    if bulk:
        decide("deny", f"조건 없는 {bulk}() 는 테이블 전체를 바꾼다.")
    if re.search(DB_EXEC_CONTEXT, command, FLAGS):
        for pattern, reason in DENY_SQL:
            if re.search(pattern, command, FLAGS | re.MULTILINE):
                decide("deny", reason)
        kind = unscoped_sql_write(command)
        if kind:
            decide("deny", f"WHERE 없는 {kind} 를 실행하지 않는다.")
    if re.search(PRISMA + r"migrate\s+deploy\b", command, FLAGS):
        failure = migration_check_failure(repo_dir_for(command, cwd))
        if failure:
            decide("deny", f"마이그레이션 안전 검사 실패 — {failure}")
    for pattern, reason in ASK_COMMAND:
        if re.search(pattern, command, FLAGS):
            decide("ask", reason)
    if re.search(r"\bpsql\b", command):
        if re.search(r"\bpsql\b[^|;&\n]*(\s-f\s|\s--file[=\s]|<\s*\S)|\|\s*(\S*/)?psql\b|\bpsql\b[^\n]*<<", command) \
                or re.search(PSQL_WRITE, command, FLAGS):
            decide("ask", "psql 로 SQL 파일·쓰기 SQL 을 실행한다. 대상 DB 와 내용을 사용자가 확인해야 한다.")
    if re.search(r"\bpg_restore\b", command) and not re.search(r"pg_restore\s+(-l|--list)\b", command):
        decide("ask", "pg_restore 는 대상 DB 에 데이터를 쓴다. 대상이 맞는지 사용자가 확인해야 한다(검사는 scripts/db-restore-check.sh).")
    for segment in re.split(r"&&|\|\||;|\||\n", command):
        if (PROD_REF in segment or re.search(PROD_HOST_HINT, segment)) and not re.search(PROD_READ_ONLY, segment):
            decide("ask", "운영 DB(Supabase bredy)를 가리키는 명령이다. 사용자가 확인해야 한다.")


def check_file(path: str, content: str) -> None:
    if not content:
        return
    if MIGRATION_FILE.search(path or ""):
        labels = destructive_statements(content)
        if labels and not DESTRUCTIVE_MARKER.search(content):
            decide("ask", f"마이그레이션에 파괴적 SQL({', '.join(labels)})이 있다. 데이터가 사라지므로 사용자가 확인한 뒤 "
                          f"파일에 `-- bredy:allow-destructive <이유>` 를 적는다. 파일: {path}")
        return
    if FILE_CONTENT_EXEMPT.search(path or ""):
        return
    if re.search(r"(^|/)\.env[^/]*$", path or ""):
        for value in re.findall(r"^\s*SHADOW_DATABASE_URL\s*=\s*(\S+)", content, re.MULTILINE):
            if not re.match(LOCAL_DB_URL, value, FLAGS):
                decide("deny", f"SHADOW_DATABASE_URL 은 localhost 만 가리킨다. 파일: {path}")
    for pattern, reason in DENY_FILE_CONTENT:
        if re.search(pattern, content, FLAGS):
            decide("deny", f"{reason} 파일: {path}")
    reason = shadow_problem(content)
    if reason:
        decide("deny", f"{reason} 파일: {path}")
    bulk = unscoped_bulk_call(content)
    if bulk:
        decide("deny", f"조건 없는 {bulk}() 를 넣지 않는다. 파일: {path}")


def main() -> None:
    try:
        payload = json.load(sys.stdin)
    except Exception:
        sys.exit(0)  # 입력을 못 읽으면 다른 도구를 막지 않는다
    tool = str(payload.get("tool_name", ""))
    tool_input = payload.get("tool_input") or {}
    cwd = str(payload.get("cwd") or os.getcwd())

    if VERCEL_MCP_ASK.match(tool):
        decide("ask", "Vercel 프로젝트 설정·환경변수·배포를 바꾼다(빌드 명령이 운영 DB 마이그레이션을 돌린다). 사용자가 확인해야 한다.")
    if tool == "Bash" or tool.endswith("__start_process"):
        check_command(str(tool_input.get("command", "")), cwd)
    elif tool.endswith("__interact_with_process"):
        check_command(str(tool_input.get("input", "")), cwd)
    elif tool.endswith("__send_terminal_keys"):
        check_command(str(tool_input.get("keys", "")), cwd)
    elif tool in ("Write", "Edit", "MultiEdit", "NotebookEdit") or tool.endswith(("__write_file", "__edit_block")):
        path = str(tool_input.get("file_path") or tool_input.get("path") or tool_input.get("notebook_path") or "")
        if tool == "MultiEdit":
            content = "\n".join(e.get("new_string", "") for e in tool_input.get("edits", []))
        else:
            content = tool_input.get("content") or tool_input.get("new_string") or tool_input.get("new_source") or ""
        check_file(path, content if isinstance(content, str) else json.dumps(content, ensure_ascii=False))
    sys.exit(0)


if __name__ == "__main__":
    main()
