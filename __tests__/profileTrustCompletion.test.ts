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

describe("완성 카드 보상 문구·목적지(AC-14, 앱 community-vibe §3.8)", () => {
  const none = {
    hasAvatar: false,
    hasBio: false,
    hasBanner: false,
    hasLink: false,
    hasPinnedPhoto: false,
    hasAlbum: false,
    hasListing: false,
  };

  it("단계마다 보상 문구와 목적지가 있다", () => {
    const { items } = computeProfileCompletion(none);
    expect(items.map((item) => [item.id, item.reward, item.href])).toEqual([
      ["avatar", "올리면 홈 '우리 동네 브리더'에 보여요", "/editProfile"],
      ["bio", "분양글 작성자 줄에 한 줄 소개가 붙어요", "/editProfile"],
      ["banner", "프로필이 '새로 온 브리더' 레일에 올라가요", "/editProfile"],
      ["link", "프로필 공유 링크가 깔끔해져요", "/editProfile"],
      ["pin", "프로필 사진 탭 맨 위에 고정돼요", "/editProfile"],
      ["album", "프로필 사진 탭이 채워져요", "/albums/edit"],
      ["listing", "홈 '지금 올라온 분양'에 24시간 보여요", "/products/upload"],
    ]);
  });

  it("nextItem 은 다음 할 일 행, 다 하면 null", () => {
    expect(computeProfileCompletion({ ...none, hasAvatar: true }).nextItem).toMatchObject({
      id: "bio",
      reward: "분양글 작성자 줄에 한 줄 소개가 붙어요",
    });
    const all = Object.fromEntries(Object.keys(none).map((key) => [key, true])) as typeof none;
    expect(computeProfileCompletion(all).nextItem).toBeNull();
  });
});

describe("profileTrustLine 동네", () => {
  const now = at(2026, 10, 9);
  it("공개한 동네 라벨을 끝에 붙인다", () => {
    expect(profileTrustLine({ createdAt: iso(2026, 9, 1), regionLabel: "구로구" }, now)).toBe("브리디 1개월차 · 구로구");
    expect(profileTrustLine({ completedSales: 2, createdAt: iso(2026, 9, 1), regionLabel: "보은군 근처" }, now)).toBe(
      "거래 완료 2 · 브리디 1개월차 · 보은군 근처"
    );
    expect(profileTrustLine({ createdAt: iso(2026, 9, 1), regionLabel: " " }, now)).toBe("브리디 1개월차");
    expect(profileTrustLine({ regionLabel: "서울" }, now)).toBe("서울");
  });
});
