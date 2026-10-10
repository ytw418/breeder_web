# GPT/Codex 작업 규칙

이 문서는 이 저장소에서 Codex/GPT가 항상 참고해야 하는 프로젝트 운영 규칙이다.

## DB 안전 규칙 (MANDATORY — 다른 모든 규칙보다 우선)
2026-10-08 22:15 KST, 에이전트가 손으로 쓴 마이그레이션을 맞춰 보려고 `npx prisma migrate diff --from-migrations ... --shadow-database-url <.env 의 DIRECT_URL>` 를 실행해 **dev DB(Supabase breeder2) 데이터가 전부 지워졌다.** Prisma 의 shadow DB 는 실행할 때마다 비워진다. 두 Supabase 프로젝트 모두 Free 플랜이라 백업이 없어 운영 데이터를 복사해 되살렸다. 원인·방어·백업 계획은 `docs/ops/db-safety-and-backup.md`.

- **실제 DB 를 비우거나 구조를 직접 바꾸는 명령은 어떤 이유로도 실행하지 않는다.**
  - `prisma migrate reset`, `prisma migrate dev`, `prisma db push`, `prisma db execute`, `--force-reset`, `--accept-data-loss`
  - shadow DB 를 실제 DB 로 가리키는 `prisma migrate diff`(shadow 는 localhost 만)
  - `supabase db reset/push`, `supabase projects/branches delete`, Supabase 관리 API 의 삭제·SQL 실행
  - `npm run seed:dummy:reset`(·`-- --reset`), `dropdb`, `pg_restore --clean`
  - DB 클라이언트·스크립트로 `DROP`, `TRUNCATE`, `ALTER TABLE … DROP`, WHERE 없는 `DELETE`/`UPDATE`, 조건 없는 `deleteMany()`/`updateMany()`
- **스키마 변경은 마이그레이션 파일 + `npx prisma migrate deploy` 만** 쓴다. Vercel 빌드(`vercel.json` → `npm run vercel-build`)가 모든 브랜치 프리뷰에서 공유 dev DB 에, main 에서 운영 DB 에 `migrate deploy` 를 돌린다. **푸시만 해도 dev DB 에 적용된다.**
  - 데이터를 지우거나 덮어쓰는 SQL(`DROP TABLE/COLUMN/SCHEMA`, `TRUNCATE`, `DELETE FROM`, `ALTER COLUMN TYPE`, `UPDATE`)이 든 마이그레이션은 사용자 확인 뒤 파일에 `-- bredy:allow-destructive <이유>` 줄을 넣는다. 없으면 `scripts/check-migration-safety.mjs` 가 빌드·CI·`migrate deploy` 를 멈춘다.
  - 마이그레이션 ↔ schema.prisma 일치 검사는 `npm run db:check-migrations`(임시 Postgres 를 shadow 로 쓴다). 새 마이그레이션 SQL 은 DB 없이 `npx prisma migrate diff --from-schema-datamodel <이전 schema> --to-schema-datamodel prisma/schema.prisma --script` 로 만든다.
- 로컬 `.env` 의 `DATABASE_URL`/`DIRECT_URL` 은 **공유 dev DB** 다. 로컬 실험용 DB 가 아니다. 테스트 데이터는 내가 만든 행만 id 로 지운다. 시드·import·`prisma studio` 는 사용자 확인 뒤에만 돌린다.
- **운영 DB 는 직접 건드리지 않는다.** 읽기 전용 백업(`npm run db:backup -- prod`)만 예외다. 백업 복원(`supabase backups restore`, `pg_restore`)·`prisma migrate resolve`·`supabase migration repair` 는 사용자가 직접 확인한 뒤에만 한다.
- 위험한 변경(운영 배포, 파괴적 마이그레이션) 전에는 `npm run db:backup -- prod` 로 백업을 남기고 `npm run db:restore-check -- <덤프>` 로 복원되는지 본다.
- 이 규칙은 Claude Code 훅(`.claude/hooks/db-guard.py`, `.claude/settings.json` PreToolUse — Bash·파일 쓰기·Desktop Commander·Paseo 터미널·Vercel MCP)이 강제한다. 훅이 막으면 우회하지 말고 사용자에게 보고한다. 규칙을 바꿀 때는 `~/.claude/hooks/db-guard.py`, bredy_app·breeder_web 의 `.claude/hooks/db-guard.py` 를 함께 고치고 `python3 .claude/hooks/db-guard_test.py` 를 돌린다.

## 앱·웹 동시 개발 규칙 (MANDATORY — 2026-10-09)
웹과 앱(bredy_app, Expo)은 화면·기능을 **항상 같이** 바꾼다. 웹에서 시작한 화면 변경은 앱까지, 앱에서 시작한 변경은 웹까지 바꾼다. 기준표는 bredy_app `docs/parity/README.md`(GitHub `ytw418/bredy_app`, 로컬 `~/Desktop/pro/bredy_app`)다. 원칙·판단 순서·플랫폼 대응표·앱 전용/웹 전용 목록·현재 부채가 거기 있다.
- 예외는 웹에만 있는 것(web-only: 관리자 `/admin`, SEO·OG·랜딩, PWA, 웹 OAuth 처리, 개발용 화면)과 기기에서만 되는 것(app-only: 네이티브 푸시·OS 설정·광고·햅틱)뿐이다.
- 같은 의도를 플랫폼에 맞게 다르게 구현하는 것은 both 다. 예) 관심 카테고리 온보딩은 앱은 설치 후 첫 실행, 웹은 첫 로그인 직후에 띄운다(대응표 O-1).
- 디자인 원본은 앱 저장소의 채택 시안(`design/mockups/*`)과 PRD(`docs/prd/*`)다. 웹도 색·간격·문구를 그대로 따른다.
- API 만 바꾸는 서버 작업은 대상이 아니다. 화면 코드(`app/` 중 api·admin 제외, `components`, `hooks`, `libs/client`, `styles`)를 커밋할 때 트레일러를 단다: `Parity: both — <앱 커밋·브랜치>` 또는 `Parity: web-only — <이유>`. 앱을 미뤄야 하면 답변에 `Parity: pending — <이유>`를 적고 기준표 §7 에 올린다.
- 훅 `.claude/hooks/parity-guard.py`(bredy_app 사본과 같은 내용)가 강제한다. 커밋 게이트는 트레일러 없는 화면 코드 커밋을 막고, Stop 점검은 한쪽만 고친 세션을 되돌려 보낸다. 바꿀 때는 두 사본을 같이 고치고 `python3 .claude/hooks/parity-guard_test.py`를 돌린다.

## 화면 용어 — '상품·판매' 대신 '분양' (MANDATORY — 2026-10-10)
사용자 결정("상품이라고 하면 이미지가 안 좋아"). 화면·서버 응답·알림·SEO 문구에 '상품'·'판매'·'구매'를 쓰지 않는다. 용어표는 bredy_app `docs/terminology.md`다.
- 상품 → 분양글(글 하나)·분양(메뉴·동작)·개체(동물 자체), 상품명·상품 설명·상품 타입 → 제목·설명·종류, 판매중·판매완료 → 분양중·분양완료, 판매내역·구매내역 → 분양내역·입양내역, 판매자·구매자 → 분양자·입양자, 구매확정 → 입양 확정, 거래 유형 판매·분양 → 유료 분양·무료 분양, 허위 매물 → 허위 분양글.
- DB·API 값(`판매중`·`판매완료`, `sale`·`adoption`)과 코드 이름(`Product`, `/products`)은 그대로 둔다. 화면에 보일 때만 `productStatusLabel()`·`dealTypeLabel()`(`libs/shared/productTerms.ts` = 앱 `src/lib/productTerms.ts` 사본)을 거친다.
- 시안·PRD·옛 기록의 '판매·구매·관심', '판매중·예약중 상품' 같은 문구는 이 표로 바꿔 읽는다.

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

## PR·완료 보고 스크린샷 (MANDATORY — 2026-10-09)
사용자는 PR 에서 화면을 직접 보고 머지한다("PR 생성할 때랑 작업 다 했다고 보고할 때 스크린샷을 보여주고 PR 에 넣어줘").
- 화면이 바뀐 작업은 바뀐 화면마다 캡처한다. 웹은 로컬 `next dev`나 Vercel 프리뷰를 Playwright 모바일 뷰포트로 찍고, 앱은 에뮬레이터(`adb exec-out screencap -p > /tmp/x.png`)로 찍는다. 색을 바꿨으면 다크도 찍는다. 찍은 파일은 직접 열어 의도한 화면인지 확인한다.
- `scripts/pr-screenshots.sh <파일...>` 로 공개 저장소 `ytw418/pr-assets`에 올리면 파일마다 PR 표 칸용 `<img>` 줄과 보고용 `![캡션](URL)` 줄이 나온다. 파일 이름이 캡션이 된다(`01-profile-light.png`).
- PR 본문에 `## 스크린샷` 표를 넣는다. 앱·웹을 같이 바꿨으면 한 행에 앱 | 웹을 둔다. 앱은 master 로 바로 푸시해 PR 이 없으니, 앱 캡처도 이 저장소의 짝 PR 에 같이 넣는다. 릴리스 PR(dev → main)은 포함 PR 들의 이미지 줄을 모아 넣는다.
- 완료 보고에도 같은 이미지를 `![캡션](URL)`로 넣고 로컬 파일 경로를 함께 적는다.
- 화면 변화가 없거나(API·훅·문서만) 캡처할 수 없으면 PR 본문에 `스크린샷 없음 — <이유>` 한 줄을 넣고, 보고에서도 그 이유를 알린다.
- `pr-assets`는 공개 저장소다. 채팅 내용·연락처·주소처럼 다른 사용자의 개인정보가 보이는 화면은 테스트 계정 데이터로 찍거나 가린다.
- 훅 `.claude/hooks/pr-guard.py`가 이미지도 `스크린샷 없음` 줄도 없는 `gh pr create`·`gh pr edit --body…`를 막는다. 훅·스크립트를 바꿀 때는 bredy_app 사본과 같이 고치고 `python3 .claude/hooks/pr-guard_test.py`를 돌린다.

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
