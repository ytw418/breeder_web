# 경매 전용 경로 분리 및 SEO/버그 수정 정리

## 1) 라우팅 분리 원칙
- 기존 경로는 유지합니다.
- 전용 경로(`/tool`)를 별도로 추가하고, 전용 경로에서만 UI/동작을 분기합니다.

### 기존 유지 경로
- `/auctions`
- `/auctions/create`
- `/auctions/[id]`
- `/auctions/[id]/edit`
- `/auctions/rules`

### 전용 신규 경로
- `/tool`
- `/tool/auctions`
- `/tool/auctions/create`
- `/tool/auctions/[id]`
- `/tool/login`
- `/tool/notifications`

관련 파일:
- `app/(web)/tool/layout.tsx`
- `app/(web)/tool/page.tsx`
- `app/(web)/tool/auctions/page.tsx`
- `app/(web)/tool/auctions/create/page.tsx`
- `app/(web)/tool/auctions/[id]/page.tsx`
- `app/(web)/tool/login/page.tsx`
- `app/(web)/tool/notifications/page.tsx`

## 2) 분기 처리 방식

### Layout 분기
`components/features/MainLayout.tsx`에서 아래 기준으로 분기합니다.
- `isToolPath = pathname?.startsWith('/tool')`

이 값이 `true`일 때만 다음을 숨깁니다.
- 상단 알림 아이콘
- 상단 햄버거 메뉴 버튼
- 로고/검색/알림 묶음(icon header)
- 하단 탭바

또한, 탭바를 숨길 때 하단 탭바용 패딩(`pb-[86px]`)도 함께 제거되도록 수정했습니다.

### 화면 이동 분기
- `app/(web)/auctions/create/CreateAuctionClient.tsx`
- `app/(web)/auctions/[id]/AuctionDetailClient.tsx`

위 두 파일에서 `pathname.startsWith('/tool')` 기준으로
- 로그인 `next` 파라미터
- 상세/목록 이동 경로
를 `/tool` prefix 포함 여부로 분기합니다.

## 3) 브리디 브랜드/일반 네비 요소 숨김 범위
전용 경로(`/tool`)에서는 아래 일반 서비스 탐색 요소를 노출하지 않습니다.
- 홈 아이콘
- 검색 버튼
- 알림 아이콘
- 햄버거 메뉴
- 하단 탭바(홈/게시글/경매/채팅/마이)

즉, 전용 경로는 "경매 작업 전용 흐름"에 집중되도록 제한합니다.

## 4) 이번에 함께 수정한 버그/SEO 항목

### A. sitemap canonical 불일치 수정
문제:
- 상품 sitemap URL이 `/products/{id}-{name}` 형태라 canonical(`/products/{id}`)와 불일치.

수정:
- `app/sitemap.ts`의 상품 URL을 `/products/{id}`로 변경.

효과:
- canonical과 sitemap 신호 일치.
- 상품명 특수문자/공백으로 인한 sitemap URL 깨짐 위험 제거.

### B. 경매 상세 soft-404 가능성 수정
문제:
- 잘못된 ID/없는 경매에도 상세 페이지 컴포넌트를 렌더링해 200 응답 가능.

수정:
- `app/(web)/auctions/[id]/page.tsx`에서
  - 숫자 ID 파싱 실패 시 `notFound()`
  - 경매 조회 결과 없음 시 `notFound()`

효과:
- 진짜 404 상태코드로 응답.
- SEO 관점에서 soft-404 리스크 감소.

### C. 클라이언트 title 덮어쓰기 제거
문제:
- `MainLayout`의 `next/head` title 주입이 서버 metadata title과 충돌 가능.

수정:
- `components/features/MainLayout.tsx`에서 `<Head><title>...</title></Head>` 제거.

효과:
- App Router metadata 기반 title이 일관되게 적용.

### D. 전용 경로 하단 여백 버그 수정
문제:
- `/tool`에서 탭바는 숨기지만 하단 패딩이 남아 빈 공간 발생.

수정:
- `hasTabBar && !isToolPath`일 때만 탭바 패딩 적용.

효과:
- 전용 경로 모바일 하단 레이아웃 정합성 개선.

## 5) 검증
실행 결과:
- `npm run typecheck` 통과
- `npm run lint` 통과

참고:
- `npm run build`는 현재 환경 네트워크에서 Google Fonts 접근 실패(`fonts.googleapis.com`)로 빌드 중단 가능성이 있습니다.
- 이는 코드 로직 오류가 아니라 외부 네트워크 해상도 이슈입니다.
