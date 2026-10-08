#!/usr/bin/env node
/**
 * 마이그레이션 안전 검사 — 데이터를 지우거나 덮어쓰는 SQL 이 표시 없이 들어 있으면 실패한다.
 *
 * Vercel 빌드(`npm run vercel-build`)가 매 빌드마다 `prisma migrate deploy` 를 돌린다. 프리뷰 빌드(모든 브랜치 푸시)는
 * 공유 dev DB 에, main 빌드는 운영 DB 에 적용된다. 그래서 검토 없이 들어간 DROP·DELETE 가 푸시만으로 데이터를 지운다.
 * 이 검사는 그 앞에서 멈춘다. 의도한 변경이면 사용자 확인 뒤 migration.sql 에
 *   -- bredy:allow-destructive <이유>
 * 줄을 넣는다(AGENTS.md 'DB 안전 규칙'). 이미 운영·dev 에 나간 마이그레이션은 scripts/migration-safety-legacy.json 에 둔다.
 *
 * 규칙은 .claude/hooks/db-guard.py 의 DESTRUCTIVE_SQL 과 같게 유지한다.
 * 사용: node scripts/check-migration-safety.mjs [prisma/migrations 경로]
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const migrationsDir = process.argv[2] ?? join(root, "prisma", "migrations");
const legacy = new Set(JSON.parse(readFileSync(join(root, "scripts", "migration-safety-legacy.json"), "utf8")));

const MARKER = /^\s*--\s*bredy:allow-destructive\b[ \t]*\S/m;
const RULES = [
  [/\bdrop\s+table\b/i, "DROP TABLE"],
  [/\balter\s+table\b[^;]*?\bdrop\s+column\b/is, "DROP COLUMN"],
  [/\bdrop\s+schema\b/i, "DROP SCHEMA"],
  [/\btruncate\b/i, "TRUNCATE"],
  [/\bdelete\s+from\b/i, "DELETE FROM"],
  [/\balter\s+table\b[^;]*?\balter\s+column\b[^;]*?\btype\b/is, "ALTER COLUMN TYPE"],
  [/\bupdate\s+["\w.]+\s+set\b/i, "UPDATE"],
];

const stripComments = (sql) => sql.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/--[^\n]*/g, " ");

const problems = [];
let checked = 0;
for (const name of readdirSync(migrationsDir).sort()) {
  const file = join(migrationsDir, name, "migration.sql");
  if (!statSync(join(migrationsDir, name)).isDirectory() || !existsSync(file)) continue;
  if (legacy.has(name)) continue;
  checked += 1;
  const sql = readFileSync(file, "utf8");
  const body = stripComments(sql);
  const found = RULES.filter(([pattern]) => pattern.test(body)).map(([, label]) => label);
  if (found.length && !MARKER.test(sql)) problems.push(`${name} (${found.join(", ")})`);
}

if (problems.length) {
  console.error("표시 없는 파괴적 마이그레이션:");
  for (const problem of problems) console.error(`  - ${problem}`);
  console.error(
    "데이터가 사라지거나 덮어써지는 변경이다. 의도한 것이면 사용자 확인 뒤 migration.sql 에 " +
      "`-- bredy:allow-destructive <이유>` 줄을 넣는다(AGENTS.md 'DB 안전 규칙').",
  );
  process.exit(1);
}
console.log(`마이그레이션 안전 검사 통과(새 마이그레이션 ${checked}개 검사, 기존 ${legacy.size}개 제외).`);
