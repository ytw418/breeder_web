# Bredy Web

[![Next.js](https://img.shields.io/badge/Next.js-16-000000?logo=nextdotjs&logoColor=white)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.1-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Prisma](https://img.shields.io/badge/Prisma-ORM-2D3748?logo=prisma&logoColor=white)](https://www.prisma.io/)
[![Playwright](https://img.shields.io/badge/E2E-Playwright-45ba63?logo=playwright&logoColor=white)](https://playwright.dev/)

중고거래 + 커뮤니티 + 채팅 + 경매 기능을 제공하는 웹 서비스입니다.  
프로덕션 URL: [https://bredy.app/](https://bredy.app/)

## Table of Contents
- [Overview](#overview)
- [Core Features](#core-features)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Scripts](#scripts)
- [Testing](#testing)
- [Project Structure](#project-structure)
- [API Docs](#api-docs)
- [Development Rules](#development-rules)

## Overview
- Framework: Next.js 16(App Router + Pages API Routes)
- Language: TypeScript
- ORM: Prisma + PostgreSQL
- Auth: `iron-session`
- State/Data Fetching: SWR, react-hook-form

## Core Features
- 상품 등록/조회/수정/삭제
- 찜/팔로우/알림
- 1:1 채팅 및 읽음 상태 동기화
- 경매 등록/입찰/종료 처리
- 관리자 페이지(유저/게시글/상품/배너/경매 운영)

## Tech Stack
- Frontend: React 18, Next.js 16, Tailwind CSS
- Backend: Next.js API Routes, Prisma Client
- Database: PostgreSQL
- Infra/Integration: Vercel Analytics, Sentry, Cloudflare Images, Web Push
- Build/Dev: Turbopack, ESLint 9 Flat Config
- Test: Jest(Unit), Playwright(E2E)

## Getting Started
### 1) Clone
```bash
git clone https://github.com/your-org/bredy_web.git
cd bredy_web
```

### 2) Install
```bash
npm install
```

### 3) Configure env
`.env` 파일을 생성하고 아래 값을 설정합니다.

`git worktree`로 별도 작업 디렉터리를 만들었다면 `.env`는 자동으로 복제되지 않습니다.
필요하면 원본 워크스페이스의 `.env`를 복사하거나 심볼릭 링크로 연결해야 합니다.

### 4) Prisma
```bash
npx prisma migrate dev --name init
npx prisma generate
```

### 5) Run
```bash
npm run dev
```

## Environment Variables
아래는 로컬 실행 시 자주 사용하는 키입니다.

| Key | Required | Description |
| --- | --- | --- |
| `DATABASE_URL` | Yes | Prisma DB 연결 문자열 |
| `DIRECT_URL` | Yes | Prisma direct connection URL |
| `COOKIE_PASSWORD` | Yes | `iron-session` 암호화 키(충분히 긴 문자열) |
| `NEXT_PUBLIC_DOMAIN_URL` | Yes | 앱 도메인 URL (로컬: `http://localhost:3000`) |
| `NEXT_PUBLIC_KAKAO_API_KEY` | Optional | 카카오 OAuth API Key |
| `NEXT_PUBLIC_KAKAO_JAVASCRIPT_KEY` | Optional | 카카오 JS SDK Key |
| `CF_ID` | Optional | Cloudflare Account ID |
| `CF_TOKEN` | Optional | Cloudflare API Token |

## Scripts
`package.json` 기준 실행 명령입니다.

| Script | Description |
| --- | --- |
| `npm run dev` | Next 16 개발 서버 실행 (`next dev`, Turbopack 기본 사용) |
| `npm run build` | ESLint + 타입 체크 + 프로덕션 빌드 |
| `npm run start` | 프로덕션 서버 시작 |
| `npm run lint` | ESLint 9 Flat Config 기준 검사 (`eslint .`) |
| `npm run typecheck` | 타입 체크 |
| `npm run verify:ci` | 기본 품질 게이트 (`lint + typecheck + test`) |
| `npm run verify:full` | 전체 검증 (`verify:ci + build`) |
| `npm test` | Jest 테스트 실행 |
| `npm run test:e2e:help` | E2E 실행 가이드 출력 |
| `npm run test:e2e:install` | Playwright Chromium 설치(최초 1회) |
| `npm run test:e2e` | E2E headless 실행 |
| `npm run test:e2e:headed` | E2E headed 실행 |
| `npm run test:e2e:ui` | Playwright UI 실행 |
| `npm run seed:dummy` | 더미 데이터 시드 |
| `npm run seed:dummy:reset` | 더미 데이터 reset + 시드 |
| `npm run seed:auction-flow` | 경매 플로우용 시드 |

## Testing
### Unit Tests (Jest)
```bash
npm test
```

### E2E Tests (Playwright)
```bash
# 1회 설치
npm run test:e2e:install

# 기본 실행
npm run test:e2e
```

추가 실행 모드:
```bash
npm run test:e2e:headed
npm run test:e2e:ui
```

참고:
- E2E 테스트 코드는 `e2e/` 아래에 있습니다.
- Playwright 리포트는 `playwright-report/`에 생성됩니다.
- `package.json`은 JSON 형식이라 script 항목에 주석을 직접 달 수 없어 `test:e2e:help`를 제공합니다.

## Runtime Conventions
- 라우팅 가드는 `middleware.ts` 대신 `proxy.ts`를 사용합니다.
- Sentry 클라이언트 초기화는 `sentry.client.config.ts` 대신 `instrumentation-client.ts`를 사용합니다.
- App Router 전역 렌더링 오류는 `app/global-error.tsx`에서 처리합니다.
- `robots.txt` 정적 파일 대신 `app/robots.ts`를 사용합니다.
- SVG 컴포넌트 import는 `next.config.js`의 `turbopack.rules`와 `@svgr/webpack` 기준으로 동작합니다.
- `next lint`는 사용하지 않고 `npm run lint`로 검사합니다.

## Project Structure
```text
app/                App Router pages and layouts
pages/api/          REST-like API routes
components/         UI/components
hooks/              Custom hooks
libs/               Shared server/client utilities
prisma/             Prisma schema and migrations
public/             Static assets
e2e/                Playwright E2E specs
docs/               Internal project docs
```

## API Docs
- 상품 API 문서: [pages/api/products.md](./pages/api/products.md)
- 유저 API 문서: [pages/api/users.md](./pages/api/users.md)

## Development Rules
- 프로젝트 룰: [AGENTS.md](./AGENTS.md), `.cursor/rules/`
- API 룰: `.cursor/rules/api-rule.mdc`
- 페이지 룰: `.cursor/rules/page-rule.mdc`
- DB 접근은 `libs/server/client.ts`를 통해 수행
- API 응답은 가능한 `{ success: boolean, ... }` 형태 유지
