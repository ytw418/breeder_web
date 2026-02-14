# Dev to Main PR Workflow

This repository now supports an automated quality gate for the `dev -> main` pull request flow.

## What runs automatically

GitHub Actions workflow: `.github/workflows/dev-to-main-quality.yml`
AI review workflow: `.github/workflows/ai-pr-review.yml`

When a pull request targets `main` from `dev`, it runs:

1. `npm ci`
2. `npm run verify:ci` (lint + typecheck + test)
3. Slack notification when quality check passes
4. AI review comment on PR diff (blocking 이슈 감지 시 실패)

## Required setup (one-time)

1. Add repository secret in GitHub:
   - Name: `SLACK_WEBHOOK_URL`
   - Value: your Slack Incoming Webhook URL
2. Add repository secret for AI review:
   - Name: `OPENAI_API_KEY`
   - Value: OpenAI API key
3. (Optional) Add repository variable for model:
   - Name: `OPENAI_REVIEW_MODEL`
   - Example: `gpt-4.1-mini`
4. Authenticate GitHub CLI once on your machine:
   - `gh auth login`
5. (Optional) Protect `main` branch and require these checks:
   - `Dev to Main Quality Gate / quality`
   - `AI PR Review / review`

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
