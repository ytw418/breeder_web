/**
 * 프로필 신뢰 줄·완성 카드 규칙(앱 src/lib/profileTrust.ts·profileCompletion.ts 와 같은 사본).
 * 앱 docs/prd/profile.md v5.
 */
import { bredyTenureLabel, monthsSince, profileTrustLine } from "@libs/shared/profileTrust";
import { computeProfileCompletion } from "@libs/shared/profileCompletion";

const at = (y: number, m: number, d: number) => new Date(y, m - 1, d, 12).getTime();
const iso = (y: number, m: number, d: number) => new Date(y, m - 1, d, 12).toISOString();

describe("monthsSince", () => {
  it("달력 기준으로 센다(날짜가 못 미치면 한 달 덜)", () => {
    expect(monthsSince(iso(2026, 10, 1), at(2026, 10, 9))).toBe(0);
    expect(monthsSince(iso(2026, 9, 9), at(2026, 10, 9))).toBe(1);
    expect(monthsSince(iso(2026, 9, 10), at(2026, 10, 9))).toBe(0);
    expect(monthsSince(iso(2025, 2, 3), at(2026, 10, 9))).toBe(20);
  });

  it("미래·잘못된 날짜는 0", () => {
    expect(monthsSince(iso(2027, 1, 1), at(2026, 10, 9))).toBe(0);
    expect(monthsSince("not-a-date", at(2026, 10, 9))).toBe(0);
  });
});

describe("bredyTenureLabel", () => {
  it("첫 달 · N개월차 · N년차", () => {
    expect(bredyTenureLabel(0)).toBe("브리디 첫 달");
    expect(bredyTenureLabel(1)).toBe("브리디 1개월차");
    expect(bredyTenureLabel(11)).toBe("브리디 11개월차");
    expect(bredyTenureLabel(12)).toBe("브리디 1년차");
    expect(bredyTenureLabel(23)).toBe("브리디 1년차");
    expect(bredyTenureLabel(24)).toBe("브리디 2년차");
  });
});

describe("profileTrustLine", () => {
  const now = at(2026, 10, 9);
  it("거래 완료가 있으면 앞에, 없으면 기간만", () => {
    expect(profileTrustLine({ completedSales: 12, createdAt: iso(2026, 2, 3) }, now)).toBe(
      "거래 완료 12 · 브리디 8개월차"
    );
    expect(profileTrustLine({ completedSales: 0, createdAt: iso(2026, 2, 3) }, now)).toBe("브리디 8개월차");
  });

  it("가입일이 없으면 거래만, 둘 다 없으면 null", () => {
    expect(profileTrustLine({ completedSales: 3 }, now)).toBe("거래 완료 3");
    expect(profileTrustLine({}, now)).toBeNull();
  });
});

describe("computeProfileCompletion", () => {
  const none = {
    hasAvatar: false,
    hasBio: false,
    hasBanner: false,
    hasLink: false,
    hasPinnedPhoto: false,
    hasAlbum: false,
    hasListing: false,
  };

  it("순서대로 다음 할 일을 고른다(v6: 소개 다음 커버·대표 링크)", () => {
    expect(computeProfileCompletion(none)).toMatchObject({ done: 0, total: 7, next: "avatar" });
    expect(computeProfileCompletion({ ...none, hasAvatar: true, hasBio: true })).toMatchObject({
      done: 2,
      next: "banner",
    });
    expect(computeProfileCompletion({ ...none, hasAvatar: true, hasBio: true, hasBanner: true })).toMatchObject({
      done: 3,
      next: "link",
    });
    expect(
      computeProfileCompletion({ ...none, hasAvatar: true, hasBio: true, hasBanner: true, hasLink: true })
    ).toMatchObject({ done: 4, next: "pin" });
  });

  it("다 채우면 next 가 없다", () => {
    const all = Object.fromEntries(Object.keys(none).map((key) => [key, true])) as typeof none;
    expect(computeProfileCompletion(all)).toMatchObject({ done: 7, total: 7, next: null });
  });

  it("항목 이름", () => {
    expect(computeProfileCompletion(none).items.map((item) => item.label)).toEqual([
      "프로필 사진",
      "소개",
      "커버 사진",
      "대표 링크",
      "대표 사진 고정",
      "앨범 만들기",
      "첫 분양 글",
    ]);
  });
});
