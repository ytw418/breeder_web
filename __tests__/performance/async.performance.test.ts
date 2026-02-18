import { describe, it, expect } from "@jest/globals";

/**
 * 비동기 및 동시성 처리 성능 테스트
 * Promise, async/await, 병렬 처리 등의 성능을 측정합니다.
 */
describe("비동기 처리 성능 테스트", () => {
  const measureAsync = async (fn: () => Promise<any>) => {
    const start = performance.now();
    await fn();
    const end = performance.now();
    const totalTime = end - start;

    return {
      totalTime: totalTime.toFixed(2),
    };
  };

  // 모의 API 호출 함수
  const mockApiCall = (delay: number): Promise<string> => {
    return new Promise((resolve) => {
      setTimeout(() => resolve(`Response after ${delay}ms`), delay);
    });
  };

  // 모의 데이터베이스 쿼리
  const mockDbQuery = (complexity: number): Promise<any[]> => {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(
          Array.from({ length: complexity }, (_, i) => ({
            id: i,
            data: `Data ${i}`,
          }))
        );
      }, Math.random() * 10 + 5);
    });
  };

  describe("Promise 처리 성능", () => {
    it("순차 처리 vs 병렬 처리 - 10개 API 호출", async () => {
      // 순차 처리
      const sequentialResult = await measureAsync(async () => {
        for (let i = 0; i < 10; i++) {
          await mockApiCall(10);
        }
      });

      // 병렬 처리
      const parallelResult = await measureAsync(async () => {
        const promises = Array.from({ length: 10 }, () => mockApiCall(10));
        await Promise.all(promises);
      });

      console.log("\n📊 순차 vs 병렬 처리 (10개 API, 각 10ms):");
      console.log(`   순차 처리: ${sequentialResult.totalTime}ms`);
      console.log(`   병렬 처리: ${parallelResult.totalTime}ms`);
      console.log(
        `   성능 개선: ${((parseFloat(sequentialResult.totalTime) / parseFloat(parallelResult.totalTime)) - 1).toFixed(1)}배 빠름`
      );

      // 병렬 처리가 최소 5배 이상 빨라야 함
      expect(parseFloat(parallelResult.totalTime)).toBeLessThan(
        parseFloat(sequentialResult.totalTime) / 5
      );
    });

    it("Promise.all vs Promise.allSettled 성능 비교", async () => {
      const promises = Array.from({ length: 100 }, (_, i) =>
        Promise.resolve(i)
      );

      // Promise.all
      const allResult = await measureAsync(async () => {
        await Promise.all(promises);
      });

      // Promise.allSettled
      const allSettledResult = await measureAsync(async () => {
        await Promise.allSettled(promises);
      });

      console.log("\n📊 Promise.all vs Promise.allSettled (100개):");
      console.log(`   Promise.all: ${allResult.totalTime}ms`);
      console.log(`   Promise.allSettled: ${allSettledResult.totalTime}ms`);

      // 둘 다 빨라야 함 (50ms 이내)
      expect(parseFloat(allResult.totalTime)).toBeLessThan(50);
      expect(parseFloat(allSettledResult.totalTime)).toBeLessThan(50);
    });

    it("대량 Promise 동시 처리 - 1000개", async () => {
      const result = await measureAsync(async () => {
        const promises = Array.from({ length: 1000 }, (_, i) =>
          Promise.resolve(i * 2)
        );
        const results = await Promise.all(promises);
        return results.reduce((sum, n) => sum + n, 0);
      });

      console.log("\n📊 1000개 Promise 동시 처리:");
      console.log(`   총 실행 시간: ${result.totalTime}ms`);

      // 1000개 Promise가 100ms 이내에 처리되어야 함
      expect(parseFloat(result.totalTime)).toBeLessThan(100);
    });
  });

  describe("배치 처리 성능", () => {
    it("배치 크기별 처리 성능 비교", async () => {
      const totalItems = 1000;
      const batchSizes = [10, 50, 100, 200];

      console.log("\n📊 배치 크기별 처리 성능:");

      for (const batchSize of batchSizes) {
        const result = await measureAsync(async () => {
          const batches = Math.ceil(totalItems / batchSize);
          for (let i = 0; i < batches; i++) {
            const batchPromises = Array.from(
              { length: Math.min(batchSize, totalItems - i * batchSize) },
              (_, j) => Promise.resolve(i * batchSize + j)
            );
            await Promise.all(batchPromises);
          }
        });

        console.log(`   배치 크기 ${batchSize}: ${result.totalTime}ms`);
        expect(parseFloat(result.totalTime)).toBeLessThan(200);
      }
    });

    it("청크 단위 데이터 처리", async () => {
      const data = Array.from({ length: 10000 }, (_, i) => i);
      const chunkSize = 100;

      const result = await measureAsync(async () => {
        const results = [];
        for (let i = 0; i < data.length; i += chunkSize) {
          const chunk = data.slice(i, i + chunkSize);
          const processed = await Promise.all(
            chunk.map(async (item) => item * 2)
          );
          results.push(...processed);
        }
        return results;
      });

      console.log("\n📊 청크 단위 처리 (10,000개, 청크 100):");
      console.log(`   총 실행 시간: ${result.totalTime}ms`);

      expect(parseFloat(result.totalTime)).toBeLessThan(500);
    });
  });

  describe("실전 시나리오 시뮬레이션", () => {
    it("상품 목록 페이지 로딩 시나리오", async () => {
      const result = await measureAsync(async () => {
        // 병렬로 여러 데이터 소스에서 데이터 가져오기
        const [products, categories, user, banners] = await Promise.all([
          mockDbQuery(30), // 상품 30개
          mockDbQuery(10), // 카테고리 10개
          mockApiCall(15), // 사용자 정보
          mockDbQuery(5), // 배너 5개
        ]);

        // 데이터 후처리
        const processedProducts = products.map((p) => ({
          ...p,
          processed: true,
        }));

        return {
          products: processedProducts,
          categories,
          user,
          banners,
        };
      });

      console.log("\n📊 상품 목록 페이지 로딩:");
      console.log(`   총 로딩 시간: ${result.totalTime}ms`);
      console.log(`   (상품 + 카테고리 + 사용자 + 배너 병렬 로딩)`);

      // 전체 페이지 로딩이 100ms 이내여야 함
      expect(parseFloat(result.totalTime)).toBeLessThan(100);
    });

    it("경매 입찰 동시 요청 처리", async () => {
      const concurrentBids = 100;
      const currentPrice = 100000;

      const processBid = async (bidAmount: number): Promise<boolean> => {
        // 입찰 처리 시뮬레이션 (5-15ms)
        await new Promise((resolve) =>
          setTimeout(resolve, Math.random() * 10 + 5)
        );
        return bidAmount > currentPrice;
      };

      const result = await measureAsync(async () => {
        const bidPromises = Array.from({ length: concurrentBids }, (_, i) =>
          processBid(currentPrice + 1000 * (i + 1))
        );
        const results = await Promise.all(bidPromises);
        return results.filter((r) => r).length;
      });

      console.log("\n📊 100건 동시 입찰 처리:");
      console.log(`   총 처리 시간: ${result.totalTime}ms`);

      // 100건 동시 입찰 처리가 50ms 이내여야 함
      expect(parseFloat(result.totalTime)).toBeLessThan(50);
    });

    it("채팅 메시지 일괄 로딩", async () => {
      const messageCount = 500;

      const result = await measureAsync(async () => {
        // 50개씩 배치로 메시지 로딩
        const batchSize = 50;
        const batches = Math.ceil(messageCount / batchSize);
        const allMessages = [];

        for (let i = 0; i < batches; i++) {
          const batchMessages = await mockDbQuery(
            Math.min(batchSize, messageCount - i * batchSize)
          );
          allMessages.push(...batchMessages);
        }

        return allMessages;
      });

      console.log("\n📊 채팅 메시지 500개 로딩:");
      console.log(`   총 로딩 시간: ${result.totalTime}ms`);

      // 500개 메시지 로딩이 200ms 이내여야 함
      expect(parseFloat(result.totalTime)).toBeLessThan(200);
    });

    it("검색 결과 다중 소스 통합", async () => {
      const searchQuery = "파이썬";

      const result = await measureAsync(async () => {
        // 여러 소스에서 동시에 검색
        const [products, posts, users] = await Promise.all([
          mockDbQuery(100), // 상품 검색
          mockDbQuery(50), // 게시글 검색
          mockDbQuery(20), // 사용자 검색
        ]);

        // 결과 통합 및 정렬
        const combined = [
          ...products.map((p) => ({ ...p, type: "product" })),
          ...posts.map((p) => ({ ...p, type: "post" })),
          ...users.map((u) => ({ ...u, type: "user" })),
        ];

        // 관련도 점수 계산 (시뮬레이션)
        const scored = combined.map((item) => ({
          ...item,
          score: Math.random(),
        }));

        scored.sort((a, b) => b.score - a.score);

        return scored.slice(0, 30); // 상위 30개 반환
      });

      console.log("\n📊 통합 검색 (상품 + 게시글 + 사용자):");
      console.log(`   총 검색 시간: ${result.totalTime}ms`);

      expect(parseFloat(result.totalTime)).toBeLessThan(150);
    });
  });

  describe("에러 처리 성능", () => {
    it("실패한 Promise 처리 - try/catch vs Promise.catch", async () => {
      const failingPromise = () =>
        Promise.reject(new Error("Test error")).catch(() => null);

      // try/catch
      const tryCatchResult = await measureAsync(async () => {
        for (let i = 0; i < 1000; i++) {
          try {
            await Promise.reject(new Error("Test"));
          } catch (e) {
            // 에러 처리
          }
        }
      });

      // .catch()
      const catchResult = await measureAsync(async () => {
        const promises = Array.from({ length: 1000 }, () =>
          Promise.reject(new Error("Test")).catch(() => null)
        );
        await Promise.all(promises);
      });

      console.log("\n📊 에러 처리 성능 (1000회):");
      console.log(`   try/catch: ${tryCatchResult.totalTime}ms`);
      console.log(`   .catch(): ${catchResult.totalTime}ms`);

      expect(parseFloat(tryCatchResult.totalTime)).toBeLessThan(200);
      expect(parseFloat(catchResult.totalTime)).toBeLessThan(200);
    });
  });

  describe("종합 성능 테스트", () => {
    it("복잡한 비즈니스 로직 실행", async () => {
      const result = await measureAsync(async () => {
        // 1. 사용자 인증
        const user = await mockApiCall(10);

        // 2. 병렬로 여러 데이터 가져오기
        const [products, orders, notifications] = await Promise.all([
          mockDbQuery(50),
          mockDbQuery(20),
          mockDbQuery(10),
        ]);

        // 3. 데이터 가공
        const processedProducts = products.map((p) => ({
          ...p,
          processed: true,
        }));

        // 4. 추가 정보 가져오기 (순차)
        const productDetails = [];
        for (let i = 0; i < Math.min(5, processedProducts.length); i++) {
          const detail = await mockApiCall(5);
          productDetails.push(detail);
        }

        return {
          user,
          products: processedProducts,
          orders,
          notifications,
          productDetails,
        };
      });

      console.log("\n📊 복잡한 비즈니스 로직 실행:");
      console.log(`   총 실행 시간: ${result.totalTime}ms`);

      expect(parseFloat(result.totalTime)).toBeLessThan(300);
    });
  });
});
