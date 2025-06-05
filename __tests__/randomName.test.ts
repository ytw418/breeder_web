import { describe, it, expect } from "@jest/globals";
import { randomUsername } from "@libs/client/randomName";
import { USERNAME_ADJECTIVES, USERNAME_PRONOUNS } from "@libs/constants";

describe("randomUsername 함수", () => {
  it("기본 형식의 사용자 이름을 생성해야 함", () => {
    const username = randomUsername({});

    // 형용사 + 명사 + 숫자 형식인지 확인
    const hasAdjective = USERNAME_ADJECTIVES.some((adj) =>
      username.includes(adj)
    );
    const hasPronoun = USERNAME_PRONOUNS.some((pron) =>
      username.includes(pron)
    );

    expect(hasAdjective).toBe(true);
    expect(hasPronoun).toBe(true);
  });

  it("maxNum이 주어지면 해당 범위 내의 숫자를 포함해야 함", () => {
    const maxNum = 100;
    const username = randomUsername({ maxNum });

    // 마지막 부분이 숫자인지 확인
    const numberPart = username.match(/\d+$/)?.[0];
    expect(numberPart).toBeDefined();
    if (numberPart) {
      const num = parseInt(numberPart);
      expect(num).toBeGreaterThanOrEqual(1);
      expect(num).toBeLessThanOrEqual(maxNum);
    }
  });

  it("maxLength가 주어지면 해당 길이를 초과하지 않아야 함", () => {
    const maxLength = 10;
    const username = randomUsername({ maxLength });

    expect(username.length).toBeLessThanOrEqual(maxLength);
  });

  it("maxLength와 maxNum이 모두 주어지면 두 조건을 모두 만족해야 함", () => {
    const maxLength = 10;
    const maxNum = 100;
    const username = randomUsername({ maxLength, maxNum });

    expect(username.length).toBeLessThanOrEqual(maxLength);
    const numberPart = username.match(/\d+$/)?.[0];
    if (numberPart) {
      const num = parseInt(numberPart);
      expect(num).toBeLessThanOrEqual(maxNum);
    }
  });
});
