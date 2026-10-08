# GPT/Codex 작업 규칙

이 문서는 이 저장소에서 Codex/GPT가 항상 참고해야 하는 프로젝트 운영 규칙이다.

## DB 안전 규칙 (MANDATORY — 다른 모든 규칙보다 우선)
2026-10-08 22:15 KST, 에이전트가 `npx prisma migrate diff --from-migrations ... --shadow-database-url <.env 의 DIRECT_URL>` 를 실행해 **dev DB(Supabase breeder2) 데이터가 전부 지워졌다.** Prisma 의 shadow DB 는 실행할 때마다 비워진다. dev·운영 Supabase 모두 백업이 없어(PITR 꺼짐, 백업 0개) 되살리지 못했다.

- **실제 DB 를 비우거나 구조를 직접 바꾸는 명령은 어떤 이유로도 실행하지 않는다.**
  - `prisma migrate reset`, `prisma migrate dev`, `prisma db push`, `prisma db execute`
  - `prisma migrate diff` 에 `--shadow-database-url`·`--from-migrations`·`--to-migrations` 를 붙이는 것(실제 DB 주소를 shadow 로 넘기면 그 DB 가 비워진다)
  - `--force-reset`, `--accept-data-loss`, `supabase db reset`, `supabase db push`, `npm run seed:dummy:reset`, `dropdb`, `pg_restore --clean`
  - DB 클라이언트·스크립트로 `DROP TABLE/SCHEMA/DATABASE`, `TRUNCATE`, WHERE 없는 `DELETE FROM`, 조건 없는 `deleteMany()`
- **스키마 변경은 마이그레이션 파일 + `npx prisma migrate deploy` 만** 쓴다(Vercel 빌드도 같은 명령을 쓴다). SQL 점검은 `npx prisma validate` 와 손으로 쓴 `migration.sql` 검토로 하고, 비교가 꼭 필요하면 DB 없이 `--from-schema-datamodel <old> --to-schema-datamodel <new> --script` 만 쓴다.
- 로컬 `.env` 의 `DATABASE_URL`/`DIRECT_URL` 은 **공유 dev DB** 다. 로컬 실험용 DB 가 아니다. 테스트 데이터를 넣고 지울 때는 내가 만든 행만 id 로 지운다.
- 백업 복원(`supabase backups restore`)·`prisma migrate resolve` 는 사용자가 직접 확인한 뒤에만 한다.
- 이 규칙은 Claude Code 훅(`.claude/hooks/db-guard.py`, `.claude/settings.json` PreToolUse)이 강제한다. 훅이 막으면 우회하지 말고 사용자에게 보고한다. 규칙을 바꿀 때는 `~/.claude/hooks/db-guard.py`, bredy_app·breeder_web 의 `.claude/hooks/db-guard.py` 를 함께 고친다.

## 스레드 간 일관성 규칙
- 다른 대화 스레드에서 시작하더라도 이 `AGENTS.md` 규칙을 동일하게 적용한다.
- 새 스레드의 첫 작업 전에 현재 저장소의 `AGENTS.md`를 우선 확인하고, 본 문서 기준으로 작업한다.
- 동일 저장소 내에서는 스레드가 달라도 브랜치/검증/승인/Slack 운영 규칙을 동일하게 유지한다.

## 브랜치/PR 규칙
- 기본 작업 브랜치는 `dev`를 사용한다.
- PR 대상은 항상 `main`이다. (`dev -> main`)
- 커밋 메시지와 PR 제목/본문은 한국어로 작성한다.
- 작업 시작 전 동기화 순서는 항상 `main checkout -> main pull -> dev checkout -> dev pull -> dev에서 main 기준 rebase -> 구현 시작`으로 고정한다.
- 위 순서를 건너뛰지 않으며, 별도 지시가 없는 한 다른 시작 절차보다 우선 적용한다.

## 검증 규칙
- 기본 품질 검증은 `npm run verify:ci`를 사용한다.
- `verify:ci` 범위는 `lint + typecheck + test`이다.
- `build` 검증은 필수 게이트가 아니며, 필요 시 로컬 또는 Vercel 결과로 확인한다.

## 자동화 운영 규칙
- 가능한 한 승인 요청 횟수를 줄인다.
- 상태 확인은 불필요한 잦은 수동 조회 대신 주기 조회를 사용한다.
- 사용자가 요청한 경우 PR 체크 상태 폴링은 10초 간격을 우선한다.
- PR 품질 게이트 통과 시 Slack 알림을 발송한다.
- 승인된 prefix(`git`, `gh`, `curl` 관련)는 사용자 확인 없이 즉시 실행한다.
- 승인되지 않은 명령이라도 작업 완료에 꼭 필요하면 승인 팝업을 통해 즉시 실행 시도한다.
- 승인 필요 여부를 이유로 작업을 중단하지 않고, 가능한 범위에서 계속 진행한다.
- `&&`로 묶인 명령은 세그먼트별 승인 판정이 달라질 수 있으므로, 승인 팝업 원인을 줄이기 위해 가능하면 분리 실행한다.
- `git add`와 `git push`는 즉시 실행하고, `git commit -m`/`gh` 계열은 넓은 prefix 승인 규칙을 우선 활용해 재팝업을 최소화한다.
- 승인 팝업이 다시 필요한 상황(새 prefix/권한 제한 등)이 오면, 승인 요청 전에 Slack 선알림을 먼저 보낸다.
- Slack 선알림은 `bash scripts/slack-notify.sh "승인 필요" "<대기 중인 명령 요약>"` 형식으로 보낸다.
- 이미 승인된 prefix 명령은 우선 사용하고, 새로운 명령이 꼭 필요할 때만 추가 승인을 요청한다.

## 수정 우선순위 규칙
- 서비스 영향이 없는 경미한 경고보다, 실제 장애/깨짐/오버플로우/빌드 실패를 우선 해결한다.
- 과도하게 엄격한 실패 조건은 지양하고, 배포 안정성과 속도의 균형을 맞춘다.
