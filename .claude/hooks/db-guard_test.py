#!/usr/bin/env python3
"""db-guard.py 테스트. 같은 폴더의 db-guard.py 를 훅처럼(JSON stdin) 불러 결정을 확인한다.

사용: python3 db-guard_test.py      (저장소 사본은 그 저장소의 scripts/check-migration-safety.mjs 도 함께 검사한다)
"""
import inspect
import json
import os
import shutil
import subprocess
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
GUARD = os.path.join(HERE, "db-guard.py")
REPO_CHECKER = os.path.normpath(os.path.join(HERE, "..", "..", "scripts", "check-migration-safety.mjs"))
EMPTY_DIR = tempfile.mkdtemp(prefix="db-guard-test-")
PROD_URL = "postgresql://postgres.nbtiaibtenjitjuverwy:pw@aws-1-ap-northeast-2.pooler.supabase.com:5432/postgres"


def run(tool: str, tool_input: dict, cwd: str = EMPTY_DIR) -> str:
    payload = json.dumps({"tool_name": tool, "tool_input": tool_input, "cwd": cwd})
    out = subprocess.run([sys.executable, GUARD], input=payload, capture_output=True, text=True).stdout.strip()
    return json.loads(out)["hookSpecificOutput"]["permissionDecision"] if out else "allow"


def bash(command: str, cwd: str = EMPTY_DIR) -> str:
    return run("Bash", {"command": command}, cwd)


CASES = [
    # ── 2026-10-08 사고 명령과 그 변형 ──
    ("deny", lambda: bash('npx prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma '
                          '--shadow-database-url "$(grep ^DIRECT_URL .env | cut -d= -f2- | tr -d \'"\')" --script')),
    ("deny", lambda: bash('npx prisma migrate diff --from-migrations m --to-schema-datamodel s --script')),
    ("deny", lambda: bash('npx prisma migrate diff --from-migrations m --to-schema-datamodel s --shadow-database-url "$DIRECT_URL"')),
    ("allow", lambda: bash('npx prisma migrate diff --from-migrations m --to-schema-datamodel s '
                           '--shadow-database-url "postgresql://postgres@localhost:5432/postgres?host=$W/sock" --script')),
    ("allow", lambda: bash('npx prisma migrate diff --from-schema-datamodel a.prisma --to-schema-datamodel b.prisma --script')),
    # ── prisma 초기화 명령(실행기·버전·줄바꿈 변형) ──
    ("deny", lambda: bash("npx prisma@6 migrate reset --force")),
    ("deny", lambda: bash("pnpm dlx prisma migrate dev --name x")),
    ("deny", lambda: bash("bunx prisma db push")),
    ("deny", lambda: bash("npx prisma \\\n  migrate reset")),
    ("deny", lambda: bash('git commit -m "x" && npx prisma migrate reset')),
    ("allow", lambda: bash("npx prisma migrate deploy")),
    ("allow", lambda: bash("npx prisma migrate status && npx prisma validate && npx prisma generate")),
    # ── 시드·import ──
    ("deny", lambda: bash("npm run seed:dummy -- --reset")),
    ("deny", lambda: bash("npm run seed:dummy:reset")),
    ("ask", lambda: bash("npx prisma db seed")),
    ("ask", lambda: bash("npm run seed:auction-flow")),
    ("ask", lambda: bash("npx ts-node scripts/seed-breeder-program-demo.ts")),
    ("ask", lambda: bash("npm run import:morphmarket:auction")),
    ("ask", lambda: bash("npx prisma studio")),
    # ── Supabase ──
    ("deny", lambda: bash("supabase db reset --linked")),
    ("deny", lambda: bash("supabase projects delete nbtiaibtenjitjuverwy")),
    ("deny", lambda: bash("curl -X DELETE https://api.supabase.com/v1/projects/abc")),
    ("deny", lambda: bash("curl https://api.supabase.com/v1/projects/abc/database/query -d '{\"query\":\"select 1\"}'")),
    ("ask", lambda: bash("supabase backups restore --project-ref abc --timestamp 1")),
    ("ask", lambda: bash('supabase db query "select 1" --linked')),
    ("ask", lambda: bash("npx prisma migrate resolve --applied 20261008000000_x")),
    ("allow", lambda: bash("supabase backups list --project-ref nbtiaibtenjitjuverwy -o json")),
    # ── SQL ──
    ("deny", lambda: bash("psql \"$URL\" -c 'DROP TABLE \"User\"'")),
    ("deny", lambda: bash("psql \"$URL\" -c 'ALTER TABLE \"User\" DROP COLUMN bio'")),
    ("deny", lambda: bash('psql "$URL" -c "DELETE FROM \\"User\\""')),
    ("deny", lambda: bash('psql "$URL" -c "DELETE FROM \\"User\\" WHERE true"')),
    ("deny", lambda: bash("psql \"$URL\" -c 'UPDATE \"User\" SET bio = null'")),
    ("deny", lambda: bash("node -e 'await p.$executeRawUnsafe(`TRUNCATE \"Post\"`)'")),
    ("ask", lambda: bash('psql "$URL" -c "DELETE FROM \\"ProfileAlbum\\" WHERE id = 1"')),
    ("ask", lambda: bash("psql \"$URL\" -c \"UPDATE \\\"User\\\" SET name = 'a' WHERE id = 3\"")),
    ("ask", lambda: bash('psql "$URL" -f restore.sql')),
    ("ask", lambda: bash('psql "$URL" < dump.sql')),
    ("ask", lambda: bash('psql "$URL" -c "INSERT INTO x VALUES (1)"')),
    ("allow", lambda: bash('psql "$URL" -c "select count(*) from \\"User\\""')),
    # ── Prisma Client 일괄 변경 ──
    ("deny", lambda: bash("node -e 'p.user.deleteMany()'")),
    ("deny", lambda: bash("node -e 'p.user.deleteMany({})'")),
    ("deny", lambda: bash("node -e 'p.user.deleteMany({ where: {} })'")),
    ("deny", lambda: bash("node -e 'p.user.updateMany({ data: { bio: null } })'")),
    ("allow", lambda: bash("node -e 'p.user.deleteMany({ where: { id: 5 } })'")),
    ("allow", lambda: bash("node -e 'p.user.deleteMany({ where })'")),
    ("allow", lambda: bash("node -e 'p.user.deleteMany(args)'")),
    # ── 복원·삭제 도구, 백업 폴더 ──
    ("deny", lambda: bash("pg_restore --clean -d x a.dump")),
    ("deny", lambda: bash("pg_restore -c -d x a.dump")),
    ("deny", lambda: bash("dropdb mydb")),
    ("deny", lambda: bash("rm -rf ~/bredy-backups/prod")),
    ("ask", lambda: bash("pg_restore -d postgres a.dump")),
    ("allow", lambda: bash("pg_restore --list a.dump")),
    ("allow", lambda: bash("rm -f /tmp/x.dump")),
    # ── 운영 DB 주소 ──
    ("ask", lambda: bash(f'psql "{PROD_URL}" -c "select 1"')),
    ("ask", lambda: bash(f'DATABASE_URL="{PROD_URL}" npx prisma migrate deploy')),
    ("allow", lambda: bash(f'/opt/homebrew/opt/libpq/bin/pg_dump "{PROD_URL}" --schema=public -Fc -f x.dump')),
    ("allow", lambda: bash("scripts/db-backup.sh prod")),
    # ── Vercel ──
    ("ask", lambda: bash("vercel env rm DATABASE_URL production")),
    ("ask", lambda: run("mcp__claude_ai_Vercel__update_project", {"projectId": "x", "buildCommand": "next build"})),
    ("allow", lambda: run("mcp__claude_ai_Vercel__list_deployments", {"projectId": "x"})),
    # ── 메시지·본문 안의 단어는 통과 ──
    ("allow", lambda: bash('git commit -m "prisma migrate reset 금지 규칙 추가"')),
    ("allow", lambda: bash('gh pr create --title "DB 보호" --body "DROP TABLE 과 prisma db push 를 막는다"')),
    # ── 다른 실행 도구 ──
    ("deny", lambda: run("mcp__plugin_desktop-commander_desktop-commander__start_process", {"command": "npx prisma migrate reset", "timeout_ms": 1})),
    ("deny", lambda: run("mcp__plugin_desktop-commander_desktop-commander__interact_with_process", {"pid": 1, "input": "DROP TABLE \"User\"; -- psql"})),
    ("deny", lambda: run("mcp__paseo__send_terminal_keys", {"terminalId": "t", "keys": "npx prisma db push\n"})),
    # ── 파일 쓰기 ──
    ("deny", lambda: run("Write", {"file_path": "/x/scripts/wipe.ts", "content": "await prisma.post.deleteMany();"})),
    ("deny", lambda: run("Write", {"file_path": "/x/scripts/a.sh", "content": "npx prisma migrate dev --name a"})),
    ("deny", lambda: run("Write", {"file_path": "/x/scripts/a.sh", "content": 'npx prisma migrate diff --from-migrations m --shadow-database-url "$DIRECT_URL"'})),
    ("deny", lambda: run("Edit", {"file_path": "/x/prisma/schema.prisma", "old_string": "a", "new_string": 'shadowDatabaseUrl = env("SHADOW")'})),
    ("deny", lambda: run("Write", {"file_path": "/x/.env", "content": "SHADOW_DATABASE_URL=postgresql://u:p@aws-0-ap-northeast-2.pooler.supabase.com:5432/postgres"})),
    ("deny", lambda: run("mcp__plugin_desktop-commander_desktop-commander__write_file", {"path": "/x/w.ts", "content": "prisma.user.deleteMany({})"})),
    ("ask", lambda: run("Write", {"file_path": "/x/prisma/migrations/20261010000000_a/migration.sql", "content": 'DROP TABLE "Old";'})),
    ("ask", lambda: run("Write", {"file_path": "/x/prisma/migrations/20261010000000_a/migration.sql", "content": 'ALTER TABLE "Post" DROP COLUMN "x";'})),
    ("allow", lambda: run("Write", {"file_path": "/x/prisma/migrations/20261010000000_a/migration.sql",
                                    "content": '-- bredy:allow-destructive 안 쓰는 테이블 정리(사용자 확인 10-10)\nDROP TABLE "Old";'})),
    ("allow", lambda: run("Write", {"file_path": "/x/prisma/migrations/20261010000000_a/migration.sql", "content": 'ALTER TABLE "Post" ADD COLUMN "x" TEXT;'})),
    ("allow", lambda: run("Write", {"file_path": "/x/scripts/ok.ts", "content": "await prisma.post.deleteMany({ where: { id: { in: ids } } });"})),
]


def migrate_deploy_cases():
    """저장소 사본이면 check-migration-safety.mjs 로 migrate deploy 를 막는지 본다."""
    if not os.path.isfile(REPO_CHECKER) or not shutil.which("node"):
        return []
    repo = tempfile.mkdtemp(prefix="db-guard-repo-")
    os.makedirs(os.path.join(repo, "scripts"))
    shutil.copy(REPO_CHECKER, os.path.join(repo, "scripts"))
    with open(os.path.join(repo, "scripts", "migration-safety-legacy.json"), "w") as f:
        json.dump(["20200101000000_old"], f)
    for name, sql in (("20200101000000_old", 'DROP TABLE "Legacy";'), ("20990101000000_new", 'CREATE TABLE "A" (id int);')):
        os.makedirs(os.path.join(repo, "prisma", "migrations", name))
        open(os.path.join(repo, "prisma", "migrations", name, "migration.sql"), "w").write(sql)
    bad = os.path.join(repo, "prisma", "migrations", "20990102000000_bad")

    def add_bad(sql):
        os.makedirs(bad, exist_ok=True)
        open(os.path.join(bad, "migration.sql"), "w").write(sql)
        return bash(f"cd {repo} && npx prisma migrate deploy")

    return [
        ("allow", lambda: bash(f"cd {repo} && npx prisma migrate deploy")),
        ("deny", lambda: add_bad('ALTER TABLE "Post" DROP COLUMN "x";')),
        ("allow", lambda: add_bad('-- bredy:allow-destructive 확인함\nALTER TABLE "Post" DROP COLUMN "x";')),
        ("deny", lambda: add_bad('UPDATE "User" SET "bio" = NULL;')),
    ]


def main() -> None:
    failures = 0
    cases = CASES + migrate_deploy_cases()
    for index, (expected, case) in enumerate(cases, 1):
        got = case()
        if got != expected:
            failures += 1
            source = inspect.getsource(case).strip() if case.__name__ == "<lambda>" else case.__name__
            print(f"FAIL #{index}: 기대 {expected}, 실제 {got} — {source[:160]}")
    print(f"{len(cases) - failures}/{len(cases)} 통과")
    sys.exit(1 if failures else 0)


if __name__ == "__main__":
    main()
