# GitHub Issue → PR 자동화

## 목표
GitHub 이슈를 기준으로 브랜치/초기 작업 파일/초안 PR을 자동 생성해, 수동 작업 절차를 줄입니다.

## 사용 방법 (로컬)
1. 이슈 생성 후 라벨 `auto-pr`을 붙입니다.
2. 로컬에서 실행:
   - `npm run issue:auto-pr 123`
   - 또는 `gh` CLI를 사용해 수동 실행:
     - `node scripts/issue-auto-pr.mjs 123`
3. 실행 결과:
   - `codex/issue-<번호>-<slug>` 브랜치 생성
   - `.github/issue-auto-pr/issue-<번호>.md` 작업 노트 생성
   - Draft PR 생성 (`Closes #이슈번호` 포함)

## 사용 방법 (클라우드/GitHub Actions)
- 이슈 라벨 `auto-pr`이 붙으면 자동 실행
- 또는 이슈에 댓글로 `/create-pr` 작성
- 수동으로 실행할 때는 GitHub Actions의 **Issue Auto PR** 워크플로를 `workflow_dispatch`로 실행

## 권장 운영 규칙
- 이슈 본문에는 핵심 요구사항(재현 경로, 기대 동작, 스크린샷/로그)을 3줄 이내로 정리
- PR 생성 후에는 `.github/issue-auto-pr/issue-<번호>.md`에서 작업 체크리스트를 기준으로 실제 변경사항 반영
- 커밋이 커지면 Draft PR을 `Ready for review`로 전환

## 주의
- 자동화는 브랜치/PR 부트스트랩만 수행합니다.
- 실제 코드 수정은 이슈 정보 기반으로 로컬에서 이어서 진행해야 합니다.
- 게이트 체크가 과거 실패로 꼬였을 경우 `ci-rerun` 코멘트로 재평가할 수 있습니다.
