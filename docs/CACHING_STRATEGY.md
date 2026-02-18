# 캐싱 전략 가이드

## 개요

이 문서는 브리디 웹 애플리케이션의 캐싱 전략을 설명합니다. 캐싱을 통해 데이터베이스 부하를 줄이고, API 응답 시간을 개선하며, 전체적인 사용자 경험을 향상시킵니다.

## 캐싱 레이어

### 1. CDN 캐싱 (API 레벨)

API 응답에 `Cache-Control` 헤더를 설정하여 CDN(Vercel Edge Network)에서 캐싱합니다.

#### 캐시 헤더 형식
```typescript
res.setHeader(
  'Cache-Control',
  'public, s-maxage=60, stale-while-revalidate=120'
);
```

- **public**: 응답을 캐시 가능하도록 설정
- **s-maxage**: CDN/서버 캐시 유지 시간(초)
- **stale-while-revalidate**: 백그라운드에서 재검증하는 동안 stale 데이터 제공 시간(초)

#### API별 캐시 시간

| API 엔드포인트 | 캐시 시간 | SWR 시간 | 이유 |
|--------------|---------|---------|------|
| `/api/products/popular` | 300초 (5분) | 600초 (10분) | 인기 상품 변동이 적음 |
| `/api/ranking/index?tab=popular` | 120초 (2분) | 240초 (4분) | 인기 게시글은 빠른 업데이트 필요 |
| `/api/ranking/index?tab=bredy` | 300초 (5분) | 600초 (10분) | 랭킹 계산 비용이 높음 |
| `/api/ranking/index?tab=guinness` | 300초 (5분) | 600초 (10분) | 기네스 기록 변동이 적음 |
| `/api/auctions/index` | 30초 | 60초 | 진행중 경매는 실시간성 중요 |
| `/api/auctions/index?q=검색어` | 15초 | 30초 | 검색 결과는 더 짧은 캐시 |
| `/api/products/index` | 60초 | 120초 | 일반 상품 목록 |
| `/api/products/index?category=곤충` | 30초 | 60초 | 필터링된 목록은 짧은 캐시 |
| `/api/posts/index?sort=latest` | 30초 | 60초 | 최신 게시글은 빠른 업데이트 |
| `/api/posts/index?sort=popular` | 120초 (2분) | 240초 (4분) | 인기 게시글은 계산 비용 절감 |

### 2. ISR (Incremental Static Regeneration)

Next.js 페이지 레벨에서 정적 생성과 서버 렌더링의 장점을 결합합니다.

#### 페이지별 Revalidate 시간

| 페이지 | Revalidate | 이유 |
|--------|-----------|------|
| 메인 페이지 (`/`) | 60초 | 자주 방문되는 페이지, 적절한 균형 |
| 랭킹 페이지 (`/ranking`) | 60초 | 랭킹 데이터의 실시간성과 성능 균형 |
| 경매 목록 (`/auctions`) | 30초 | 진행중 경매의 실시간성 유지 |
| 경매 상세 (`/auctions/[id]`) | 15초 | 입찰 정보의 실시간성 중요 |
| 상품 상세 (`/products/[id]`) | 60초 | 기존 설정 유지 |

#### ISR 구현 예시

```typescript
// app/(web)/ranking/page.tsx
export const revalidate = 60; // 60초마다 페이지 재생성

export const metadata: Metadata = {
  // ... 메타데이터
};

const page = () => {
  return <RankingClient />;
};

export default page;
```

### 3. 클라이언트 캐싱 (SWR)

기존 SWR 설정을 그대로 유지하여 클라이언트 측 캐싱을 활용합니다.

```typescript
const { data } = useSWR('/api/products/popular', fetcher, {
  revalidateOnFocus: false,
  dedupingInterval: 5 * 60 * 1000, // 5분
});
```

## 캐싱 전략 원칙

### 1. 실시간성 기반 차등 캐싱

데이터의 실시간성 요구사항에 따라 캐시 시간을 차등 적용:

- **실시간 데이터** (15-30초): 경매 입찰, 진행중 경매 목록
- **준실시간 데이터** (30-60초): 최신 게시글, 필터링된 목록
- **정적 데이터** (2-5분): 랭킹, 인기 콘텐츠, 통계

### 2. Stale-While-Revalidate 패턴

모든 캐시에 SWR 시간을 캐시 시간의 2배로 설정:
- 캐시 만료 시 즉시 백그라운드에서 재검증
- 재검증 중에도 stale 데이터 제공으로 빠른 응답
- 사용자는 대기 시간 없이 콘텐츠 확인 가능

### 3. 검색/필터 기반 캐시 조정

사용자 입력이 있는 경우 캐시 시간을 단축:
- 기본 목록: 긴 캐시 시간
- 검색/필터 적용: 짧은 캐시 시간

```typescript
const hasFilters = q || (category && category !== "전체");
const cacheTime = hasFilters ? 15 : 30;
```

## 성능 최적화 설정

### Next.js Configuration

```javascript
// next.config.js
const nextConfig = {
  // 페이지를 메모리에 유지하는 설정
  onDemandEntries: {
    maxInactiveAge: 60 * 1000,     // 60초간 메모리 유지
    pagesBufferLength: 5,           // 최대 5개 페이지 버퍼
  },
};
```

## 모니터링 및 조정

### 캐시 효율성 측정

다음 지표를 모니터링하여 캐시 전략을 조정합니다:

1. **캐시 히트율**: CDN 캐시 히트율 (목표: 60-80%)
2. **응답 시간**: API 평균 응답 시간 (목표: 50-70% 단축)
3. **DB 쿼리 수**: 데이터베이스 쿼리 횟수 (목표: 70-80% 감소)
4. **사용자 만족도**: 페이지 로딩 속도 개선

### 캐시 시간 조정 가이드

- **캐시 히트율이 낮은 경우**: 캐시 시간 증가 고려
- **데이터 신선도 문제**: 캐시 시간 감소 또는 수동 재검증 추가
- **서버 부하 증가**: 캐시 시간 증가 또는 SWR 시간 증가

## 캐시 무효화

### 자동 무효화

- ISR: revalidate 시간 경과 시 자동 재생성
- CDN: s-maxage 시간 경과 시 자동 만료

### 수동 무효화 (필요 시)

```typescript
// On-Demand Revalidation 사용 예시
await fetch('/api/revalidate?path=/ranking', {
  method: 'POST',
});
```

## 주의사항

1. **인증이 필요한 API**: 캐싱하지 않음 (user-specific 데이터)
2. **POST/PUT/DELETE 요청**: 캐싱하지 않음 (변경 작업)
3. **실시간 채팅/알림**: 캐싱하지 않음 (Pusher 사용)
4. **입찰 API**: 캐싱하지 않음 (실시간 경매)

## 비용 절감 효과

### 예상 효과

- **데이터베이스 쿼리**: 70-80% 감소
- **서버 CPU 사용률**: 40-60% 감소  
- **API 응답 시간**: 50-70% 단축
- **CDN 트래픽 감소**: 인프라 비용 절감
- **사용자 경험**: 페이지 로딩 30-50% 개선

### 실제 측정 (배포 후 업데이트 예정)

- [ ] 캐시 히트율: __%
- [ ] 평균 응답 시간: __ms → __ms
- [ ] DB 쿼리 수: __회/분 → __회/분
- [ ] 인프라 비용: __원/월 → __원/월

## 추가 개선 사항 (향후 고려)

1. **Redis 캐싱**: 고빈도 API를 위한 인메모리 캐시
2. **GraphQL DataLoader**: N+1 쿼리 문제 해결
3. **CDN Purging**: 콘텐츠 변경 시 즉시 캐시 무효화
4. **Service Worker**: 오프라인 지원 및 추가 캐싱
5. **Partial Prerendering (PPR)**: Next.js 14+ 실험적 기능 활용

## 참고 자료

- [Next.js ISR Documentation](https://nextjs.org/docs/app/building-your-application/data-fetching/incremental-static-regeneration)
- [HTTP Caching Best Practices](https://web.dev/http-cache/)
- [Vercel Edge Network](https://vercel.com/docs/edge-network/overview)
- [SWR Documentation](https://swr.vercel.app/)
