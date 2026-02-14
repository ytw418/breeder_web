# Dev to Main PR Workflow

This repository now supports an automated quality gate for the `dev -> main` pull request flow.

## What runs automatically

GitHub Actions workflow: `.github/workflows/dev-to-main-quality.yml`
GitHub Actions workflow: `.github/workflows/review-loop-gate.yml`

When a pull request targets `main` from `dev`, it runs:

1. `npm ci`
2. `npm run verify:ci` (lint + typecheck + test)
3. Vercel deployment check wait (`Vercel` check must be `success`)
4. Slack notification only after quality + Vercel checks pass
5. Review loop gate check (Codex/Gemini 위험 버그 신호 감지 시 실패)

## Required setup (one-time)

1. Add repository secret in GitHub:
   - Name: `SLACK_WEBHOOK_URL`
   - Value: your Slack Incoming Webhook URL
2. Authenticate GitHub CLI once on your machine:
   - `gh auth login`
3. (Optional) Protect `main` branch and require these checks:
   - `Dev to Main Quality Gate / quality`
   - `Review Loop Gate / gate`

## Local pre-check command

Use one of these before pushing:

```bash
npm run verify:ci
```

or

```bash
bash scripts/ci-verify.sh
```

Optional local full check (includes build):

```bash
npm run verify:full
```

## Create or open `dev -> main` PR

```bash
bash scripts/open-dev-pr.sh
```

If you need to skip local verify once:

```bash
bash scripts/open-dev-pr.sh --skip-verify
```

## Notes

- Slack notification is skipped if `SLACK_WEBHOOK_URL` is not set.
- Mergeability (`clean`) is validated in GitHub PR UI / Vercel checks, not in this workflow.
