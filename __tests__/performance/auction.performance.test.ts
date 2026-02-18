import { describe, it, expect } from "@jest/globals";
import {
  getBidIncrement,
  getMinimumBid,
  isAuctionDurationValid,
  isBidAmountValid,
  canEditAuction,
} from "@/libs/auctionRules";

/**
 * 경매 비즈니스 로직 성능 테스트
 * 고빈도로 호출되는 경매 관련 함수들의 성능을 측정합니다.
 */
describe("경매 로직 성능 테스트", () => {
  const measurePerformance = (fn: () => void, iterations: number) => {
    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      fn();
    }
    const end = performance.now();
    const totalTime = end - start;
    const avgTime = totalTime / iterations;
    const opsPerSecond = (iterations / totalTime) * 1000;

    return {
      totalTime: totalTime.toFixed(2),
      avgTime: avgTime.toFixed(4),
      opsPerSecond: opsPerSecond.toFixed(0),
      iterations,
    };
  };

  describe("getBidIncrement() 성능", () => {
    it("100,000회 실행 - 다양한 가격대", () => {
      const prices = [
        5000, 50000, 150000, 500000, 1000000, 5000000, 10000000,
      ];

      const result = measurePerformance(() => {
        const price = prices[Math.floor(Math.random() * prices.length)];
        getBidIncrement(price);
      }, 100000);

      console.log("\n📊 getBidIncrement() 성능 측정:");
      console.log(`   총 실행 시간: ${result.totalTime}ms`);
      console.log(`   평균 실행 시간: ${result.avgTime}ms`);
      console.log(`   초당 처리량: ${result.opsPerSecond} ops/sec`);

      // 평균 실행 시간이 0.01ms 미만이어야 함 (매우 빠름)
      expect(parseFloat(result.avgTime)).toBeLessThan(0.01);
    });
  });

  describe("getMinimumBid() 성능", () => {
    it("100,000회 실행 - 최소 입찰가 계산", () => {
      const currentPrices = [
        1000, 9000, 15000, 95000, 150000, 950000, 1500000,
      ];

      const result = measurePerformance(() => {
        const price =
          currentPrices[Math.floor(Math.random() * currentPrices.length)];
        getMinimumBid(price);
      }, 100000);

      console.log("\n📊 getMinimumBid() 성능 측정:");
      console.log(`   총 실행 시간: ${result.totalTime}ms`);
      console.log(`   평균 실행 시간: ${result.avgTime}ms`);
      console.log(`   초당 처리량: ${result.opsPerSecond} ops/sec`);

      expect(parseFloat(result.avgTime)).toBeLessThan(0.02);
    });
  });

  describe("isAuctionDurationValid() 성능", () => {
    it("50,000회 실행 - 경매 기간 검증", () => {
      const now = new Date();
      const validEndDates = [
        new Date(now.getTime() + 2 * 60 * 60 * 1000), // 2시간 후
        new Date(now.getTime() + 12 * 60 * 60 * 1000), // 12시간 후
        new Date(now.getTime() + 24 * 60 * 60 * 1000), // 24시간 후
        new Date(now.getTime() + 48 * 60 * 60 * 1000), // 48시간 후
      ];

      const result = measurePerformance(() => {
        const endDate =
          validEndDates[Math.floor(Math.random() * validEndDates.length)];
        isAuctionDurationValid(endDate, now);
      }, 50000);

      console.log("\n📊 isAuctionDurationValid() 성능 측정:");
      console.log(`   총 실행 시간: ${result.totalTime}ms`);
      console.log(`   평균 실행 시간: ${result.avgTime}ms`);
      console.log(`   초당 처리량: ${result.opsPerSecond} ops/sec`);

      expect(parseFloat(result.avgTime)).toBeLessThan(0.02);
    });
  });

  describe("isBidAmountValid() 성능", () => {
    it("75,000회 실행 - 입찰 금액 검증", () => {
      const testCases = [
        { currentPrice: 5000, bidAmount: 6000 },
        { currentPrice: 50000, bidAmount: 60000 },
        { currentPrice: 150000, bidAmount: 200000 },
        { currentPrice: 500000, bidAmount: 600000 },
      ];

      const result = measurePerformance(() => {
        const testCase =
          testCases[Math.floor(Math.random() * testCases.length)];
        isBidAmountValid(testCase);
      }, 75000);

      console.log("\n📊 isBidAmountValid() 성능 측정:");
      console.log(`   총 실행 시간: ${result.totalTime}ms`);
      console.log(`   평균 실행 시간: ${result.avgTime}ms`);
      console.log(`   초당 처리량: ${result.opsPerSecond} ops/sec`);

      expect(parseFloat(result.avgTime)).toBeLessThan(0.03);
    });
  });

  describe("canEditAuction() 성능", () => {
    it("50,000회 실행 - 경매 수정 가능 여부 확인", () => {
      const now = new Date();
      const testCases = [
        {
          isOwner: true,
          createdAt: new Date(now.getTime() - 5 * 60 * 1000),
          status: "진행중",
          bidCount: 0,
        },
        {
          isOwner: true,
          createdAt: new Date(now.getTime() - 15 * 60 * 1000),
          status: "진행중",
          bidCount: 0,
        },
        {
          isOwner: false,
          createdAt: new Date(now.getTime() - 5 * 60 * 1000),
          status: "진행중",
          bidCount: 0,
        },
      ];

      const result = measurePerformance(() => {
        const testCase =
          testCases[Math.floor(Math.random() * testCases.length)];
        canEditAuction({ ...testCase, now });
      }, 50000);

      console.log("\n📊 canEditAuction() 성능 측정:");
      console.log(`   총 실행 시간: ${result.totalTime}ms`);
      console.log(`   평균 실행 시간: ${result.avgTime}ms`);
      console.log(`   초당 처리량: ${result.opsPerSecond} ops/sec`);

      expect(parseFloat(result.avgTime)).toBeLessThan(0.05);
    });
  });

  describe("경매 로직 종합 벤치마크", () => {
    it("모든 경매 함수 통합 테스트 - 200,000회", () => {
      const now = new Date();

      const result = measurePerformance(() => {
        const rand = Math.random();
        const price = Math.floor(Math.random() * 1000000) + 1000;

        if (rand < 0.2) {
          getBidIncrement(price);
        } else if (rand < 0.4) {
          getMinimumBid(price);
        } else if (rand < 0.6) {
          const endDate = new Date(
            now.getTime() + Math.random() * 72 * 60 * 60 * 1000
          );
          isAuctionDurationValid(endDate, now);
        } else if (rand < 0.8) {
          isBidAmountValid({
            currentPrice: price,
            bidAmount: price + getBidIncrement(price),
          });
        } else {
          canEditAuction({
            isOwner: true,
            createdAt: new Date(now.getTime() - 5 * 60 * 1000),
            status: "진행중",
            bidCount: 0,
            now,
          });
        }
      }, 200000);

      console.log("\n📊 경매 로직 종합 벤치마크:");
      console.log(`   총 실행 시간: ${result.totalTime}ms`);
      console.log(`   평균 실행 시간: ${result.avgTime}ms`);
      console.log(`   초당 처리량: ${result.opsPerSecond} ops/sec`);
      console.log(`   총 반복 횟수: ${result.iterations.toLocaleString()}`);

      // 200,000번 실행이 2초 이내에 완료되어야 함
      expect(parseFloat(result.totalTime)).toBeLessThan(2000);
    });
  });

  describe("실전 시나리오 시뮬레이션", () => {
    it("1000명이 동시에 입찰하는 시나리오", () => {
      const currentPrice = 100000;
      const users = 1000;

      const start = performance.now();

      // 각 사용자가 입찰 검증을 수행
      for (let i = 0; i < users; i++) {
        const increment = getBidIncrement(currentPrice);
        const minBid = getMinimumBid(currentPrice);
        const bidAmount = minBid + increment * Math.floor(Math.random() * 3);
        const isValid = isBidAmountValid({ currentPrice, bidAmount });

        // 입찰 검증 결과 확인
        expect(typeof isValid).toBe("boolean");
      }

      const end = performance.now();
      const totalTime = (end - start).toFixed(2);
      const avgTime = ((end - start) / users).toFixed(4);

      console.log("\n📊 동시 입찰 시나리오 (1000명):");
      console.log(`   총 처리 시간: ${totalTime}ms`);
      console.log(`   사용자당 평균: ${avgTime}ms`);
      console.log(`   처리량: ${((users / (end - start)) * 1000).toFixed(0)} ops/sec`);

      // 1000명 처리가 100ms 이내여야 함
      expect(parseFloat(totalTime)).toBeLessThan(100);
    });
  });
});
