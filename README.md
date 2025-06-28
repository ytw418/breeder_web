# 🐞 Breeder

## [브리더 접속하기](https://breeder-web.vercel.app/)

## 📚 프로젝트 소개

- Next.js, TypeScript, Prisma, TailwindCSS 기반의 중고거래/커뮤니티 플랫폼
- 주요 도메인: 상품, 유저, 채팅, 리뷰 등

---

## ⚡️ 프로젝트 실행 방법

1. **프로젝트 클론**
   ```bash
   git clone https://github.com/your-org/breeder_web.git
   cd breeder_web
   ```
2. **패키지 설치**
   ```bash
   npm install
   ```
3. **환경 변수 설정**
   - `.env` 파일을 생성하고 필요한 환경변수를 입력하세요. (예시: `.env` 참고)
   - 소유자에게 env 파일을 공유받아주세요
   - vercel에 env 를 확인하세요.
4. **Prisma 초기화 및 마이그레이션**
   ```bash
   npx prisma init
   npx prisma migrate dev --name init
   npx prisma generate
   ```
5. **개발 서버 실행**
   ```bash
   npm run dev
   ```

---

## 📁 주요 폴더 구조

```
app/                # 페이지 및 클라이언트 컴포넌트
pages/api/          # API 라우트 (도메인별 하위 폴더)
components/         # UI/기능 컴포넌트
libs/               # 서버/클라이언트 공통 유틸리티
public/             # 정적 파일(이미지 등)
.cursor/rules/      # 프로젝트 코드/아키텍처 룰
```

---

## 🛠️ 기술 스택

- **프레임워크**: Next.js 14, React
- **언어**: TypeScript
- **스타일**: TailwindCSS
- **상태관리**: react-hook-form, SWR
- **ORM/DB**: Prisma
- **인증**: iron-session

---

## 📝 주요 개발 가이드/룰

- 글로벌, 페이지, API 등 [Cursor Rules](.cursor/rules/)로 관리
- API 작성 시 반드시 [api-rule.mdc](.cursor/rules/api-rule.mdc) 참고
- 페이지/컴포넌트 작성 시 [page-rule.mdc](.cursor/rules/page-rule.mdc) 참고
- DB 접근은 반드시 [libs/server/client.ts](libs/server/client.ts) 사용
- 모든 응답은 `{ success: boolean, ... }` 형태로 통일
- 상세 가이드: `.cursor/rules/` 폴더 참고

---

## 📦 주요 API 명세

### [상품 API 명세](pages/api/products.md)

- 상품 목록 조회: `GET /api/products`
- 상품 등록: `POST /api/products`
- 상품 상세: `GET /api/products/[id]`
- 상품 수정/삭제: `POST /api/products/[id]`
- 관심 상품 등록/취소: `POST /api/products/[id]/fav`
- 특정 유저의 상품 목록: `GET /api/users/[id]/productList`

### [유저 API 명세](pages/api/users.md)

- 내 정보 조회/수정: `GET/POST /api/users/me`
- 특정 유저 정보: `GET /api/users/[id]`
- 특정 유저의 상품 목록: `GET /api/users/[id]/productList`
- 특정 유저의 구매 내역: `GET /api/users/[id]/purchases`

---

## 🧑‍💻 개발/코딩 규칙

- TailwindCSS만 사용, CSS 직접 작성 금지
- 함수/컴포넌트명, 파일/폴더명 네이밍 규칙 준수
- 불필요한 콘솔/디버깅 코드 금지
- 상세한 주석, 타입 명시 필수
- PR 리뷰 필수, 커밋 메시지 컨벤션 준수

---

## 🗂️ 기타 참고

- [global-rule.mdc](.cursor/rules/global-rule.mdc): 프로젝트 전역 룰
- [page-rule.mdc](.cursor/rules/page-rule.mdc): 페이지 작성 룰
- [api-rule.mdc](.cursor/rules/api-rule.mdc): API 작성 룰
- 기타 세부 룰 및 예시는 `.cursor/rules/` 폴더 참고

---

## ✨ 기여 및 문의

- 코드/문서 기여 환영합니다!
- 문의: 담당자 또는 이슈 등록

1
