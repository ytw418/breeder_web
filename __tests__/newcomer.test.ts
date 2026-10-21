import { isNewcomer } from "@libs/shared/newcomer";

// 앱 scripts/web-tests/newcomer.test.ts 와 같은 파일(앱 사본 src/lib/newcomer.ts 를 같은 입력으로 본다).
const NOW = Date.parse("2026-10-21T03:00:00.000Z");
const DAY = 24 * 60 * 60 * 1000;

describe("새 회원 판정(감사 #20)", () => {
  it("가입 7일 안이면 새 회원, 8일 지났거나 가입 시각이 없으면(옛 서버) 아니다", () => {
    expect(isNewcomer(new Date(NOW - 3 * DAY).toISOString(), NOW)).toBe(true);
    expect(isNewcomer(new Date(NOW - 7 * DAY), NOW)).toBe(true);
    expect(isNewcomer(new Date(NOW - 8 * DAY).toISOString(), NOW)).toBe(false);
    expect(isNewcomer(undefined, NOW)).toBe(false);
    expect(isNewcomer("not-a-date", NOW)).toBe(false);
  });
});
