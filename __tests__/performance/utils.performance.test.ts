import { describe, it, expect } from "@jest/globals";
import { cn, makeImageUrl, getTimeAgoString } from "@/libs/client/utils";

/**
 * 유틸리티 함수 성능 테스트
 * 실행 시간과 처리량을 측정하여 성능을 검증합니다.
 */
describe("유틸리티 함수 성능 테스트", () => {
  /**
   * 성능 측정 헬퍼 함수
   */
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

  describe("cn() 함수 성능", () => {
    it("10,000회 실행 - 단순 클래스 병합", () => {
      const result = measurePerformance(() => {
        cn("text-red-500", "bg-blue-500");
      }, 10000);

      console.log("\n📊 cn() 성능 측정 결과:");
      console.log(`   총 실행 시간: ${result.totalTime}ms`);
      console.log(`   평균 실행 시간: ${result.avgTime}ms`);
      console.log(`   초당 처리량: ${result.opsPerSecond} ops/sec`);

      // 평균 실행 시간이 0.1ms 미만이어야 함
      expect(parseFloat(result.avgTime)).toBeLessThan(0.1);
    });

    it("10,000회 실행 - 복잡한 클래스 병합", () => {
      const result = measurePerformance(() => {
        cn(
          "text-red-500",
          "bg-blue-500",
          "hover:bg-blue-600",
          "px-4 py-2",
          "rounded-lg",
          "shadow-md",
          "transition-all"
        );
      }, 10000);

      console.log("\n📊 cn() 복잡한 병합 성능:");
      console.log(`   총 실행 시간: ${result.totalTime}ms`);
      console.log(`   평균 실행 시간: ${result.avgTime}ms`);
      console.log(`   초당 처리량: ${result.opsPerSecond} ops/sec`);

      expect(parseFloat(result.avgTime)).toBeLessThan(0.2);
    });
  });

  describe("makeImageUrl() 함수 성능", () => {
    it("50,000회 실행 - 클라우드플레어 URL 생성", () => {
      const result = measurePerformance(() => {
        makeImageUrl("test-image-id-12345", "product");
      }, 50000);

      console.log("\n📊 makeImageUrl() 성능 측정 결과:");
      console.log(`   총 실행 시간: ${result.totalTime}ms`);
      console.log(`   평균 실행 시간: ${result.avgTime}ms`);
      console.log(`   초당 처리량: ${result.opsPerSecond} ops/sec`);

      // 평균 실행 시간이 0.05ms 미만이어야 함
      expect(parseFloat(result.avgTime)).toBeLessThan(0.05);
    });

    it("50,000회 실행 - 다양한 입력값", () => {
      const testCases = [
        "image-id-1",
        "/images/test.jpg",
        "https://example.com/image.jpg",
        null,
        undefined,
        "",
      ];

      const result = measurePerformance(() => {
        const randomCase =
          testCases[Math.floor(Math.random() * testCases.length)];
        makeImageUrl(randomCase as any);
      }, 50000);

      console.log("\n📊 makeImageUrl() 다양한 입력값 성능:");
      console.log(`   총 실행 시간: ${result.totalTime}ms`);
      console.log(`   평균 실행 시간: ${result.avgTime}ms`);
      console.log(`   초당 처리량: ${result.opsPerSecond} ops/sec`);

      expect(parseFloat(result.avgTime)).toBeLessThan(0.1);
    });
  });

  describe("getTimeAgoString() 함수 성능", () => {
    it("30,000회 실행 - 시간 차이 계산", () => {
      const testDate = new Date(Date.now() - 1000 * 60 * 60 * 24 * 5); // 5일 전

      const result = measurePerformance(() => {
        getTimeAgoString(testDate);
      }, 30000);

      console.log("\n📊 getTimeAgoString() 성능 측정 결과:");
      console.log(`   총 실행 시간: ${result.totalTime}ms`);
      console.log(`   평균 실행 시간: ${result.avgTime}ms`);
      console.log(`   초당 처리량: ${result.opsPerSecond} ops/sec`);

      // 평균 실행 시간이 0.05ms 미만이어야 함
      expect(parseFloat(result.avgTime)).toBeLessThan(0.05);
    });

    it("30,000회 실행 - 다양한 시간 범위", () => {
      const dates = [
        new Date(Date.now() - 1000 * 60), // 1분 전
        new Date(Date.now() - 1000 * 60 * 60), // 1시간 전
        new Date(Date.now() - 1000 * 60 * 60 * 24), // 1일 전
        new Date(Date.now() - 1000 * 60 * 60 * 24 * 30), // 1달 전
        new Date(Date.now() - 1000 * 60 * 60 * 24 * 365), // 1년 전
      ];

      const result = measurePerformance(() => {
        const randomDate = dates[Math.floor(Math.random() * dates.length)];
        getTimeAgoString(randomDate);
      }, 30000);

      console.log("\n📊 getTimeAgoString() 다양한 시간 범위 성능:");
      console.log(`   총 실행 시간: ${result.totalTime}ms`);
      console.log(`   평균 실행 시간: ${result.avgTime}ms`);
      console.log(`   초당 처리량: ${result.opsPerSecond} ops/sec`);

      expect(parseFloat(result.avgTime)).toBeLessThan(0.1);
    });
  });

  describe("종합 성능 벤치마크", () => {
    it("모든 유틸리티 함수 혼합 테스트 - 100,000회", () => {
      const result = measurePerformance(() => {
        // 랜덤하게 함수 선택하여 실행
        const rand = Math.random();
        if (rand < 0.33) {
          cn("class1", "class2", "class3");
        } else if (rand < 0.66) {
          makeImageUrl("test-id", "product");
        } else {
          getTimeAgoString(new Date(Date.now() - 1000 * 60 * 60));
        }
      }, 100000);

      console.log("\n📊 종합 벤치마크 결과:");
      console.log(`   총 실행 시간: ${result.totalTime}ms`);
      console.log(`   평균 실행 시간: ${result.avgTime}ms`);
      console.log(`   초당 처리량: ${result.opsPerSecond} ops/sec`);
      console.log(`   총 반복 횟수: ${result.iterations.toLocaleString()}`);

      // 100,000번 실행이 1초 이내에 완료되어야 함
      expect(parseFloat(result.totalTime)).toBeLessThan(1000);
    });
  });
});
