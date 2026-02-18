# 성능 테스트 가이드

이 디렉토리는 Bredy Web 프로젝트의 종합 성능 테스트 스위트입니다.

## 📊 테스트 구성

### 1. `utils.performance.test.ts` - 유틸리티 함수 성능
- **cn()** 함수: 클래스 이름 병합 (10,000회 테스트)
- **makeImageUrl()** 함수: 이미지 URL 생성 (50,000회 테스트)
- **getTimeAgoString()** 함수: 시간 차이 계산 (30,000회 테스트)
- **종합 벤치마크**: 100,000회 혼합 실행

**주요 측정 지표:**
- 평균 실행 시간
- 초당 처리량 (ops/sec)
- 총 실행 시간

### 2. `auction.performance.test.ts` - 경매 비즈니스 로직 성능
- **getBidIncrement()**: 입찰 단위 계산 (100,000회)
- **getMinimumBid()**: 최소 입찰가 계산 (100,000회)
- **isAuctionDurationValid()**: 경매 기간 검증 (50,000회)
- **isBidAmountValid()**: 입찰 금액 검증 (75,000회)
- **canEditAuction()**: 경매 수정 가능 여부 (50,000회)
- **실전 시나리오**: 1000명 동시 입찰 시뮬레이션

**목표 성능:**
- 각 함수 평균 실행 시간 < 0.05ms
- 200,000회 통합 테스트 < 2초
- 1000명 동시 입찰 처리 < 100ms

### 3. `data-processing.performance.test.ts` - 대규모 데이터 처리
- **배열 처리**: 100만개 배열 생성 및 순회
- **필터링**: 10만개 객체 배열 필터링
- **정렬**: 10만개 배열 정렬
- **Map vs Object**: 10만개 항목 성능 비교
- **문자열 처리**: 문자열 연결, 정규식 매칭, JSON 파싱
- **실전 시나리오**: 상품 목록 페이지 데이터 처리

**목표 성능:**
- 100만개 배열 처리 < 200ms
- 10만개 필터링 < 50ms
- 복잡한 데이터 변환 < 100ms

### 4. `async.performance.test.ts` - 비동기 및 동시성 처리
- **순차 vs 병렬**: 10개 API 호출 비교
- **Promise.all vs Promise.allSettled**: 성능 비교
- **배치 처리**: 배치 크기별 성능 측정
- **실전 시나리오**: 
  - 상품 목록 페이지 로딩
  - 경매 입찰 동시 요청 처리
  - 채팅 메시지 일괄 로딩
  - 검색 결과 다중 소스 통합

**주요 발견:**
- 병렬 처리가 순차 처리보다 5배 이상 빠름
- 배치 크기 최적화로 처리 속도 개선
- Promise.all과 Promise.allSettled 성능 차이 미미

### 5. `benchmark.performance.test.ts` - 종합 성능 벤치마크
- **고부하 테스트**: 1000명 동시 접속 시뮬레이션
- **경매 시스템**: 500개 경매, 10000건 입찰 처리
- **대규모 검색**: 100,000개 아이템 검색 및 정렬
- **메모리 효율성**: 대량 객체 생성 및 GC 영향 측정
- **캐싱 전략**: 캐시 적용 전후 성능 비교
- **E-Commerce 플로우**: 검색→상세→장바구니→주문 전체 프로세스
- **CPU 집약적 작업**: 피보나치 계산 최적화

**성능 목표:**
- 1000명 동시 접속 < 500ms
- 10000건 입찰 처리 < 1초
- 100,000개 검색 < 200ms
- 전체 쇼핑 플로우 < 100ms

## 🚀 테스트 실행 방법

### 모든 성능 테스트 실행
```bash
npm test -- __tests__/performance
```

### 특정 테스트 파일만 실행
```bash
# 유틸리티 함수 성능 테스트
npm test -- __tests__/performance/utils.performance.test.ts

# 경매 로직 성능 테스트
npm test -- __tests__/performance/auction.performance.test.ts

# 데이터 처리 성능 테스트
npm test -- __tests__/performance/data-processing.performance.test.ts

# 비동기 처리 성능 테스트
npm test -- __tests__/performance/async.performance.test.ts

# 종합 벤치마크
npm test -- __tests__/performance/benchmark.performance.test.ts
```

### 상세 로그와 함께 실행
```bash
npm test -- __tests__/performance --verbose
```

## 📈 성능 측정 지표

모든 테스트는 다음 지표를 측정합니다:

1. **총 실행 시간 (Total Time)**: 전체 작업 완료 시간
2. **평균 실행 시간 (Average Time)**: 단일 연산당 평균 시간
3. **초당 처리량 (Operations per Second)**: 초당 처리 가능한 작업 수
4. **처리량 (Throughput)**: 단위 시간당 처리된 데이터양

## 🎯 성능 기준

### 우수 (Excellent)
- 평균 실행 시간 < 0.01ms
- 초당 처리량 > 100,000 ops/sec

### 양호 (Good)
- 평균 실행 시간 < 0.1ms
- 초당 처리량 > 10,000 ops/sec

### 허용 (Acceptable)
- 평균 실행 시간 < 1ms
- 초당 처리량 > 1,000 ops/sec

### 주의 필요 (Needs Attention)
- 평균 실행 시간 > 1ms
- 초당 처리량 < 1,000 ops/sec

## 💡 성능 최적화 팁

### 1. 배열 처리
- `for` 루프가 `forEach`보다 빠름
- `map`/`filter` 체이닝보다 단일 `reduce` 사용 고려
- 큰 배열은 청크 단위로 처리

### 2. 객체 처리
- 빈번한 키-값 조회는 `Map` 사용
- 깊은 복사는 `structuredClone()` 또는 라이브러리 사용
- 불필요한 객체 생성 최소화

### 3. 비동기 처리
- 독립적인 작업은 `Promise.all`로 병렬 처리
- 대량 요청은 배치 처리
- 에러 처리는 `Promise.allSettled` 고려

### 4. 캐싱
- 반복적인 연산 결과는 캐싱
- 메모이제이션 패턴 활용
- WeakMap으로 메모리 누수 방지

### 5. 문자열 처리
- 대량 문자열 연결은 `Array.join()` 사용
- 템플릿 리터럴 활용
- 정규식은 미리 컴파일

## 📊 성능 테스트 결과 해석

### 콘솔 출력 예시
```
📊 cn() 성능 측정 결과:
   총 실행 시간: 45.23ms
   평균 실행 시간: 0.0045ms
   초당 처리량: 221000 ops/sec
```

### 해석
- **총 실행 시간**: 10,000회 실행에 45.23ms 소요
- **평균 실행 시간**: 한 번 실행에 0.0045ms (매우 빠름)
- **초당 처리량**: 1초에 221,000번 실행 가능 (우수)

## 🔧 성능 이슈 디버깅

### 성능이 기대에 미치지 못할 때
1. 테스트 환경 확인 (CPU, 메모리 사용률)
2. 다른 프로세스 간섭 여부 체크
3. 테스트를 여러 번 실행하여 평균값 확인
4. Node.js 버전 및 설정 확인

### 성능 프로파일링
```bash
# Node.js 프로파일러로 실행
node --prof node_modules/.bin/jest __tests__/performance

# Chrome DevTools로 분석
node --inspect-brk node_modules/.bin/jest __tests__/performance
```

## 📝 테스트 추가 가이드

새로운 성능 테스트를 추가할 때:

1. 적절한 파일 선택 (또는 새 파일 생성)
2. `measurePerformance` 헬퍼 함수 사용
3. 충분한 반복 횟수 설정 (최소 1,000회 이상)
4. 명확한 설명과 콘솔 출력 추가
5. 합리적인 성능 기준 설정

### 템플릿
```typescript
it("새로운 함수 성능 테스트", () => {
  const result = measurePerformance(() => {
    // 테스트할 함수 호출
    myFunction();
  }, 10000); // 반복 횟수

  console.log("\n📊 새로운 함수 성능:");
  console.log(`   총 실행 시간: ${result.totalTime}ms`);
  console.log(`   평균 실행 시간: ${result.avgTime}ms`);
  console.log(`   초당 처리량: ${result.opsPerSecond} ops/sec`);

  // 성능 기준
  expect(parseFloat(result.avgTime)).toBeLessThan(0.1);
});
```

## 🎓 참고 자료

- [JavaScript Performance Best Practices](https://developer.mozilla.org/en-US/docs/Web/Performance)
- [Node.js Performance Measurement APIs](https://nodejs.org/api/perf_hooks.html)
- [Jest Performance Testing](https://jestjs.io/docs/timer-mocks)

## 📞 문의

성능 테스트 관련 문의사항이 있으면 개발팀에 문의해주세요.

---

**마지막 업데이트**: 2026-02-18
**버전**: 1.0.0
