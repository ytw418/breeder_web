# 캐싱 빠른 참조 가이드

## 새로운 API에 캐싱 추가하기

### 1. 기본 패턴

```typescript
// pages/api/your-endpoint.ts
async function handler(req: NextApiRequest, res: NextApiResponse) {
  // GET 요청에만 캐싱 적용
  if (req.method === "GET") {
    // 캐시 시간 설정 (초 단위)
    const cacheTime = 60; // 1분
    res.setHeader(
      'Cache-Control',
      `public, s-maxage=${cacheTime}, stale-while-revalidate=${cacheTime * 2}`
    );
    
    // 데이터 조회 및 응답
    const data = await fetchData();
    return res.json({ success: true, data });
  }
  
  // POST/PUT/DELETE는 캐싱하지 않음
}
```

### 2. 조건부 캐싱

검색이나 필터가 있는 경우 다른 캐시 시간 적용:

```typescript
const { search, filter } = req.query;
const hasFilters = search || filter;

// 필터가 있으면 짧은 캐시, 없으면 긴 캐시
const cacheTime = hasFilters ? 30 : 60;
res.setHeader(
  'Cache-Control',
  `public, s-maxage=${cacheTime}, stale-while-revalidate=${cacheTime * 2}`
);
```

### 3. 탭/카테고리별 캐싱

```typescript
const { tab } = req.query;

// 탭에 따라 다른 캐시 시간
const cacheTime = tab === "realtime" ? 15 : tab === "popular" ? 120 : 60;
res.setHeader(
  'Cache-Control',
  `public, s-maxage=${cacheTime}, stale-while-revalidate=${cacheTime * 2}`
);
```

## 새로운 페이지에 ISR 추가하기

### 1. 기본 패턴

```typescript
// app/(web)/your-page/page.tsx
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "페이지 제목",
  description: "페이지 설명",
};

/**
 * ISR 설정
 * - 60초마다 페이지 재생성
 * - 설명 추가
 */
export const revalidate = 60;

export default function Page() {
  return <YourPageClient />;
}
```

### 2. 동적 라우트 + ISR

```typescript
// app/(web)/items/[id]/page.tsx
interface Props {
  params: { id: string };
}

// 빌드 시 생성할 페이지 목록
export async function generateStaticParams() {
  const items = await fetchItems();
  return items.map(item => ({ id: String(item.id) }));
}

// ISR 설정
export const revalidate = 60;

export default async function ItemPage({ params }: Props) {
  const item = await fetchItem(params.id);
  return <ItemDetail item={item} />;
}
```

## 캐시 시간 가이드라인

| 콘텐츠 타입 | 권장 캐시 시간 | 예시 |
|-----------|--------------|------|
| 실시간 데이터 | 15-30초 | 경매 입찰, 채팅 |
| 자주 변경되는 목록 | 30-60초 | 최신 게시글, 상품 목록 |
| 일반 콘텐츠 | 1-5분 | 인기 콘텐츠, 랭킹 |
| 정적 콘텐츠 | 5분 이상 | 공지사항, 통계 |

## 캐싱하면 안 되는 경우

❌ **다음 경우에는 캐싱을 적용하지 마세요:**

1. **사용자별 데이터**
   ```typescript
   // 로그인한 사용자의 정보 - 캐싱 X
   const userData = await getUserData(session.user.id);
   ```

2. **민감한 정보**
   ```typescript
   // 개인정보, 결제 정보 - 캐싱 X
   const payment = await getPaymentInfo(orderId);
   ```

3. **실시간 업데이트 필요**
   ```typescript
   // 채팅 메시지, 실시간 알림 - 캐싱 X (Pusher 사용)
   const messages = await getChatMessages(roomId);
   ```

4. **변경 작업 (POST/PUT/DELETE)**
   ```typescript
   if (req.method === "POST") {
     // POST 요청은 캐싱하지 않음
     await createItem(data);
   }
   ```

## 캐시 무효화

### 자동 무효화

ISR과 CDN 캐시는 설정된 시간 후 자동으로 무효화됩니다.

### 수동 무효화 (On-Demand Revalidation)

특정 이벤트 발생 시 즉시 캐시를 무효화하려면:

```typescript
// pages/api/revalidate.ts
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { path } = req.body;
  
  try {
    await res.revalidate(path);
    return res.json({ revalidated: true });
  } catch (err) {
    return res.status(500).json({ error: "Error revalidating" });
  }
}
```

사용 예시:
```typescript
// 상품 수정 후 캐시 무효화
await fetch('/api/revalidate', {
  method: 'POST',
  body: JSON.stringify({ path: `/products/${productId}` }),
});
```

## 디버깅

### 캐시 헤더 확인

브라우저 개발자 도구에서:
1. Network 탭 열기
2. 요청 선택
3. Response Headers 확인
4. `cache-control` 헤더 값 확인

예상 값:
```
cache-control: public, s-maxage=60, stale-while-revalidate=120
```

### ISR 동작 확인

1. 페이지 첫 방문: 서버 렌더링
2. revalidate 시간 내: 캐시된 페이지 제공
3. revalidate 시간 초과 후 첫 방문: 캐시 제공 + 백그라운드 재생성
4. 이후 방문: 재생성된 페이지 제공

## 체크리스트

새로운 기능 추가 시:

- [ ] GET 요청에만 캐싱 적용했는가?
- [ ] 사용자별 데이터는 캐싱하지 않았는가?
- [ ] 적절한 캐시 시간을 선택했는가?
- [ ] stale-while-revalidate를 설정했는가?
- [ ] ISR이 필요한 페이지에 revalidate를 추가했는가?
- [ ] 실시간성이 중요한 데이터는 짧은 캐시를 사용했는가?

## 도움말

더 자세한 내용은 다음 문서를 참조하세요:
- `docs/CACHING_STRATEGY.md` - 전체 캐싱 전략
- [Next.js ISR 문서](https://nextjs.org/docs/app/building-your-application/data-fetching/incremental-static-regeneration)
- [HTTP 캐싱 가이드](https://web.dev/http-cache/)
