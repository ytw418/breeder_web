#!/usr/bin/env python3
"""
DB 보호 하네스 — Claude Code PreToolUse 훅(Bash, Write|Edit).

2026-10-08 22:15 KST, `prisma migrate diff --from-migrations --shadow-database-url <dev DB>` 로
dev DB(Supabase) 데이터가 통째로 지워졌다(shadow DB 는 매번 초기화된다). 같은 일이 다시는
일어나지 않도록, DB 를 비우거나 구조를 직접 바꾸는 명령은 막고(deny), 복구처럼 사람이 정해야
하는 명령은 확인을 받는다(ask).

- 막는 것: prisma migrate reset/dev, shadow DB 를 쓰는 migrate diff, db push, db execute,
  --force-reset/--accept-data-loss, supabase db reset/push, 시드 --reset, dropdb,
  DB 실행 맥락의 DROP/TRUNCATE, 조건 없는 deleteMany.
- 묻는 것: supabase backups restore, prisma migrate resolve.
- 허용: prisma migrate deploy / status / validate / generate, 읽기 쿼리.

규칙 원문: 각 저장소 AGENTS.md 'DB 안전 규칙'. 이 파일의 사본이 bredy_app·breeder_web 의
.claude/hooks/db-guard.py 에 있다(셋을 같이 고친다).
"""
import json
import re
import sys

FLAGS = re.IGNORECASE | re.DOTALL

# (패턴, 이유) — 명령 전체(여러 줄 heredoc 포함)에 대해 검사한다.
DENY_COMMAND = [
    (r"prisma\s+migrate\s+reset\b", "prisma migrate reset 은 DB 를 통째로 비운다."),
    (r"prisma\s+migrate\s+dev\b", "prisma migrate dev 는 drift 가 있으면 DB 를 reset 하고 shadow DB 를 쓴다. 적용은 `prisma migrate deploy` 만 쓴다."),
    (r"prisma\s+migrate\s+diff\b.*(--shadow-database-url|--from-migrations|--to-migrations)",
     "migrate diff 의 shadow DB 는 매번 초기화된다(2026-10-08 dev DB 삭제 사고). DB 없이 `--from-schema-datamodel`/`--to-schema-datamodel` 로만 비교한다."),
    (r"prisma\s+db\s+push\b", "prisma db push 는 컬럼·테이블을 지울 수 있다. 마이그레이션 파일 + `migrate deploy` 만 쓴다."),
    (r"prisma\s+db\s+execute\b", "prisma db execute 로 SQL 을 직접 실행하지 않는다."),
    (r"--force-reset\b|--accept-data-loss\b", "데이터를 지우는 플래그(--force-reset/--accept-data-loss)는 쓰지 않는다."),
    (r"supabase\s+db\s+(reset|push)\b", "supabase db reset/push 는 원격 DB 를 비우거나 바꾼다."),
    (r"seed:dummy:reset|seed-dummy\.ts[^|;&\n]*--reset", "시드 --reset 은 기존 데이터를 지운다."),
    (r"\bdropdb\b|pg_restore\b[^|;&\n]*--clean", "dropdb / pg_restore --clean 은 DB 를 지운다."),
    (r"deleteMany\(\s*(\{\s*(where\s*:\s*\{\s*\})?\s*\})?\s*\)", "조건 없는 deleteMany() 는 테이블을 비운다."),
]

# SQL 키워드는 DB 를 실행하는 맥락에서만 막는다(커밋 메시지·문서의 단어는 통과).
DB_EXEC_CONTEXT = r"\b(psql|pgcli|mysql|sqlite3|prisma|supabase|node|tsx|ts-node|bun|deno)\b|\$executeRaw|executeRawUnsafe|\$queryRaw|queryRawUnsafe"
DENY_SQL = [
    (r"\bdrop\s+(table|schema|database|owned)\b", "DROP TABLE/SCHEMA/DATABASE 를 실행하지 않는다."),
    (r"\btruncate\s+(table\s+)?[\\\"'\w]", "TRUNCATE 를 실행하지 않는다."),
    (r"\bdelete\s+from\s+[\"'\w.]+\s*(;|$|\"|')", "WHERE 없는 DELETE FROM 을 실행하지 않는다."),
]

ASK_COMMAND = [
    (r"supabase\s+backups\s+restore\b", "백업 복원은 지금 DB 내용을 덮어쓴다. 사용자가 직접 확인해야 한다."),
    (r"prisma\s+migrate\s+resolve\b", "migrate resolve 는 마이그레이션 기록을 바꾼다. 사용자가 직접 확인해야 한다."),
]

# Write/Edit 로 만드는 스크립트 안의 파괴적 코드(마이그레이션 SQL 파일은 PR 로 검토하므로 제외).
DENY_FILE_CONTENT = [
    (r"deleteMany\(\s*(\{\s*(where\s*:\s*\{\s*\})?\s*\})?\s*\)", "조건 없는 deleteMany() 를 넣지 않는다."),
    (r"(executeRawUnsafe|\$executeRaw)[^\n]*\b(drop\s+(table|schema|database)|truncate)\b", "raw SQL 로 DROP/TRUNCATE 를 실행하는 코드를 넣지 않는다."),
    (r"migrate\s+(reset|dev)\b|--shadow-database-url|--force-reset|--accept-data-loss", "DB 를 초기화하는 prisma 명령을 스크립트에 넣지 않는다."),
]
FILE_CONTENT_EXEMPT = re.compile(r"(/prisma/migrations/|/\.claude/hooks/db-guard\.py$|/AGENTS\.md$|/CLAUDE\.md$|/memory/[^/]+\.md$|/docs/)")


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
    # git/gh 줄에서 시작하는 heredoc 본문(<<'EOF' … EOF)
    command = re.sub(
        r"(\b(?:git|gh)\b[^\n]*<<-?\s*['\"]?(\w+)['\"]?[^\n]*\n)(.*?)(\n\2\b)",
        r"\1\4",
        command,
        flags=re.DOTALL,
    )
    # -m/--message/--body/--title/--notes "…" 또는 '…'
    command = re.sub(
        r"(\s--?(?:m|message|body|title|notes))\s+(\"(?:\\.|[^\"\\])*\"|'[^']*')",
        r"\1 ''",
        command,
    )
    return command


def check_command(command: str) -> None:
    command = strip_message_text(command)
    for pattern, reason in DENY_COMMAND:
        if re.search(pattern, command, FLAGS):
            decide("deny", reason)
    if re.search(DB_EXEC_CONTEXT, command, FLAGS):
        for pattern, reason in DENY_SQL:
            if re.search(pattern, command, FLAGS | re.MULTILINE):
                decide("deny", reason)
    for pattern, reason in ASK_COMMAND:
        if re.search(pattern, command, FLAGS):
            decide("ask", reason)


def check_file(path: str, content: str) -> None:
    if not content or FILE_CONTENT_EXEMPT.search(path or ""):
        return
    for pattern, reason in DENY_FILE_CONTENT:
        if re.search(pattern, content, FLAGS):
            decide("deny", f"{reason} 파일: {path}")


def main() -> None:
    try:
        payload = json.load(sys.stdin)
    except Exception:
        sys.exit(0)  # 입력을 못 읽으면 다른 도구를 막지 않는다
    tool = payload.get("tool_name", "")
    tool_input = payload.get("tool_input") or {}
    if tool == "Bash":
        check_command(str(tool_input.get("command", "")))
    elif tool in ("Write", "Edit", "MultiEdit"):
        content = tool_input.get("content") or tool_input.get("new_string") or ""
        if tool == "MultiEdit":
            content = "\n".join(e.get("new_string", "") for e in tool_input.get("edits", []))
        check_file(str(tool_input.get("file_path", "")), str(content))
    sys.exit(0)


if __name__ == "__main__":
    main()
