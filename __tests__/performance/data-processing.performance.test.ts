import { describe, it, expect } from "@jest/globals";

/**
 * 대규모 데이터 처리 성능 테스트
 * 배열, 객체, 문자열 등의 데이터를 대량으로 처리할 때의 성능을 측정합니다.
 */
describe("대규모 데이터 처리 성능 테스트", () => {
  const measurePerformance = (fn: () => void, iterations: number = 1) => {
    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      fn();
    }
    const end = performance.now();
    const totalTime = end - start;

    return {
      totalTime: totalTime.toFixed(2),
      avgTime: iterations > 1 ? (totalTime / iterations).toFixed(4) : "N/A",
      opsPerSecond:
        iterations > 1 ? ((iterations / totalTime) * 1000).toFixed(0) : "N/A",
    };
  };

  describe("배열 처리 성능", () => {
    it("100만개 배열 생성 및 순회", () => {
      const result = measurePerformance(() => {
        const arr = Array.from({ length: 1000000 }, (_, i) => i);
        let sum = 0;
        for (let i = 0; i < arr.length; i++) {
          sum += arr[i];
        }
        return sum;
      });

      console.log("\n📊 100만개 배열 처리:");
      console.log(`   총 실행 시간: ${result.totalTime}ms`);

      // 100만개 배열 처리가 200ms 이내여야 함
      expect(parseFloat(result.totalTime)).toBeLessThan(200);
    });

    it("10만개 객체 배열 필터링", () => {
      const data = Array.from({ length: 100000 }, (_, i) => ({
        id: i,
        name: `User ${i}`,
        age: 20 + (i % 50),
        isActive: i % 2 === 0,
      }));

      const result = measurePerformance(() => {
        const filtered = data.filter((user) => user.age > 40 && user.isActive);
        return filtered.length;
      });

      console.log("\n📊 10만개 객체 배열 필터링:");
      console.log(`   총 실행 시간: ${result.totalTime}ms`);

      // 10만개 필터링이 50ms 이내여야 함
      expect(parseFloat(result.totalTime)).toBeLessThan(50);
    });

    it("5만개 배열 map + reduce 체이닝", () => {
      const numbers = Array.from({ length: 50000 }, (_, i) => i + 1);

      const result = measurePerformance(() => {
        const sum = numbers
          .map((n) => n * 2)
          .filter((n) => n % 3 === 0)
          .reduce((acc, n) => acc + n, 0);
        return sum;
      });

      console.log("\n📊 5만개 배열 map + reduce 체이닝:");
      console.log(`   총 실행 시간: ${result.totalTime}ms`);

      expect(parseFloat(result.totalTime)).toBeLessThan(100);
    });

    it("배열 정렬 성능 - 10만개", () => {
      const arr = Array.from({ length: 100000 }, () =>
        Math.floor(Math.random() * 1000000)
      );

      const result = measurePerformance(() => {
        arr.sort((a, b) => a - b);
      });

      console.log("\n📊 10만개 배열 정렬:");
      console.log(`   총 실행 시간: ${result.totalTime}ms`);

      expect(parseFloat(result.totalTime)).toBeLessThan(100);
    });
  });

  describe("객체 처리 성능", () => {
    it("10만개 객체 생성 및 속성 접근", () => {
      const result = measurePerformance(() => {
        const objects = [];
        for (let i = 0; i < 100000; i++) {
          objects.push({
            id: i,
            name: `Item ${i}`,
            price: 1000 + i,
            category: `Category ${i % 10}`,
            createdAt: new Date(),
          });
        }

        // 속성 접근 테스트
        let totalPrice = 0;
        for (const obj of objects) {
          totalPrice += obj.price;
        }

        return totalPrice;
      });

      console.log("\n📊 10만개 객체 생성 및 접근:");
      console.log(`   총 실행 시간: ${result.totalTime}ms`);

      expect(parseFloat(result.totalTime)).toBeLessThan(150);
    });

    it("Map vs Object 성능 비교 - 10만개 항목", () => {
      const iterations = 100000;

      // Object 성능
      const objResult = measurePerformance(() => {
        const obj: Record<string, number> = {};
        for (let i = 0; i < iterations; i++) {
          obj[`key${i}`] = i;
        }
        // 조회
        for (let i = 0; i < iterations; i++) {
          const val = obj[`key${i}`];
        }
      });

      // Map 성능
      const mapResult = measurePerformance(() => {
        const map = new Map<string, number>();
        for (let i = 0; i < iterations; i++) {
          map.set(`key${i}`, i);
        }
        // 조회
        for (let i = 0; i < iterations; i++) {
          const val = map.get(`key${i}`);
        }
      });

      console.log("\n📊 Map vs Object 성능 비교 (10만개):");
      console.log(`   Object: ${objResult.totalTime}ms`);
      console.log(`   Map: ${mapResult.totalTime}ms`);
      console.log(
        `   성능 차이: ${(parseFloat(objResult.totalTime) - parseFloat(mapResult.totalTime)).toFixed(2)}ms`
      );

      // 둘 다 500ms 이내여야 함
      expect(parseFloat(objResult.totalTime)).toBeLessThan(500);
      expect(parseFloat(mapResult.totalTime)).toBeLessThan(500);
    });

    it("깊은 객체 복사 성능 - 1000개", () => {
      const complexObject = {
        id: 1,
        user: {
          name: "홍길동",
          profile: {
            age: 30,
            address: {
              city: "서울",
              district: "강남구",
              detail: "테헤란로 123",
            },
          },
        },
        items: Array.from({ length: 100 }, (_, i) => ({
          id: i,
          name: `Item ${i}`,
        })),
      };

      const result = measurePerformance(() => {
        for (let i = 0; i < 1000; i++) {
          const copied = JSON.parse(JSON.stringify(complexObject));
        }
      });

      console.log("\n📊 복잡한 객체 깊은 복사 1000회:");
      console.log(`   총 실행 시간: ${result.totalTime}ms`);

      expect(parseFloat(result.totalTime)).toBeLessThan(200);
    });
  });

  describe("문자열 처리 성능", () => {
    it("문자열 연결 성능 - 10만회", () => {
      const iterations = 100000;

      // + 연산자
      const concatResult = measurePerformance(() => {
        let str = "";
        for (let i = 0; i < iterations; i++) {
          str += "a";
        }
      });

      // Array.join
      const joinResult = measurePerformance(() => {
        const arr = [];
        for (let i = 0; i < iterations; i++) {
          arr.push("a");
        }
        const str = arr.join("");
      });

      console.log("\n📊 문자열 연결 성능 비교 (10만회):");
      console.log(`   + 연산자: ${concatResult.totalTime}ms`);
      console.log(`   Array.join: ${joinResult.totalTime}ms`);

      // 둘 다 합리적인 시간 내에 완료되어야 함
      expect(parseFloat(concatResult.totalTime)).toBeLessThan(10000);
      expect(parseFloat(joinResult.totalTime)).toBeLessThan(10000);
    });

    it("정규식 매칭 성능 - 10만회", () => {
      const testStrings = [
        "test@example.com",
        "invalid-email",
        "user123@domain.co.kr",
        "admin@test.com",
      ];

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      const result = measurePerformance(() => {
        for (let i = 0; i < 100000; i++) {
          const str = testStrings[i % testStrings.length];
          emailRegex.test(str);
        }
      });

      console.log("\n📊 정규식 매칭 10만회:");
      console.log(`   총 실행 시간: ${result.totalTime}ms`);

      expect(parseFloat(result.totalTime)).toBeLessThan(100);
    });

    it("JSON 파싱 성능 - 1만회", () => {
      const jsonString = JSON.stringify({
        users: Array.from({ length: 100 }, (_, i) => ({
          id: i,
          name: `User ${i}`,
          email: `user${i}@example.com`,
        })),
      });

      const result = measurePerformance(() => {
        for (let i = 0; i < 10000; i++) {
          JSON.parse(jsonString);
        }
      });

      console.log("\n📊 JSON 파싱 1만회:");
      console.log(`   총 실행 시간: ${result.totalTime}ms`);

      expect(parseFloat(result.totalTime)).toBeLessThan(500);
    });
  });

  describe("메모리 집약적 작업", () => {
    it("대용량 데이터 셋 생성 및 처리", () => {
      const result = measurePerformance(() => {
        // 1만개의 상품 데이터 생성
        const products = Array.from({ length: 10000 }, (_, i) => ({
          id: i,
          name: `Product ${i}`,
          description: `This is a detailed description for product ${i}. `.repeat(
            5
          ),
          price: 10000 + Math.random() * 90000,
          category: `Category ${i % 50}`,
          tags: [`tag${i % 10}`, `tag${i % 20}`, `tag${i % 30}`],
          reviews: Array.from({ length: 10 }, (_, j) => ({
            id: j,
            rating: Math.floor(Math.random() * 5) + 1,
            comment: `Review ${j} for product ${i}`,
          })),
        }));

        // 데이터 필터링 및 집계
        const expensive = products.filter((p) => p.price > 50000);
        const avgPrice =
          products.reduce((sum, p) => sum + p.price, 0) / products.length;
        const categoryCount = products.reduce((acc, p) => {
          acc[p.category] = (acc[p.category] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);

        return { expensive: expensive.length, avgPrice, categoryCount };
      });

      console.log("\n📊 대용량 데이터셋 처리:");
      console.log(`   총 실행 시간: ${result.totalTime}ms`);

      expect(parseFloat(result.totalTime)).toBeLessThan(500);
    });
  });

  describe("종합 벤치마크", () => {
    it("실전 시나리오: 상품 목록 페이지 데이터 처리", () => {
      const result = measurePerformance(() => {
        // 1. 10,000개의 상품 생성
        const products = Array.from({ length: 10000 }, (_, i) => ({
          id: i,
          name: `상품 ${i}`,
          price: 10000 + i * 100,
          category: `카테고리 ${i % 20}`,
          rating: 3 + Math.random() * 2,
          soldCount: Math.floor(Math.random() * 1000),
          createdAt: new Date(Date.now() - Math.random() * 30 * 86400000),
        }));

        // 2. 필터링 (가격 범위, 카테고리)
        const filtered = products.filter(
          (p) => p.price >= 20000 && p.price <= 80000 && p.category.includes("5")
        );

        // 3. 정렬 (인기순)
        filtered.sort((a, b) => b.soldCount - a.soldCount);

        // 4. 페이지네이션 (30개씩)
        const page1 = filtered.slice(0, 30);

        // 5. 데이터 변환 (클라이언트 형식)
        const transformed = page1.map((p) => ({
          ...p,
          priceFormatted: `${p.price.toLocaleString()}원`,
          ratingStars: "⭐".repeat(Math.floor(p.rating)),
          isPopular: p.soldCount > 500,
        }));

        return transformed.length;
      });

      console.log("\n📊 실전 시나리오 - 상품 목록 페이지:");
      console.log(`   총 실행 시간: ${result.totalTime}ms`);
      console.log(`   (10,000개 생성 → 필터 → 정렬 → 페이지 → 변환)`);

      // 전체 프로세스가 100ms 이내여야 함
      expect(parseFloat(result.totalTime)).toBeLessThan(100);
    });
  });
});
