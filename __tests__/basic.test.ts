import { describe, it, expect } from "@jest/globals";

// 가장 기본적인 테스트
describe("기본 테스트", () => {
  // 단순한 숫자 더하기 테스트
  it("1 + 1은 2여야 합니다", () => {
    expect(1 + 1).toBe(2);
  });

  // 배열 테스트
  it("배열에 특정 요소가 포함되어 있어야 합니다", () => {
    const fruits = ["사과", "바나나", "오렌지"];
    expect(fruits).toContain("바나나");
  });

  // 객체 테스트
  it("객체가 특정 속성을 가지고 있어야 합니다", () => {
    const user = {
      name: "홍길동",
      age: 30,
    };
    expect(user).toHaveProperty("name");
    expect(user.name).toBe("홍길동");
  });
});
