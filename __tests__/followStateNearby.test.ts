import { isNearbyKey, withNearbyFollowRow } from "@libs/client/followState";

describe("팔로우 캐시 갱신 — 동네 브리더(홈 카드)", () => {
  it("nearby 키만 고른다", () => {
    expect(isNearbyKey("/api/users/nearby?limit=10")).toBe(true);
    expect(isNearbyKey("/api/users/nearby")).toBe(true);
    expect(isNearbyKey("/api/users/7")).toBe(false);
    expect(isNearbyKey(["/api/users/nearby"])).toBe(false);
  });

  it("그 사람 카드의 isFollowing 만 바꾸고 나머지는 그대로 둔다", () => {
    const data = {
      success: true,
      scope: "sigungu" as const,
      region: { sido: "서울특별시", sigungu: "강남구" },
      total: 2,
      items: [
        { user: { id: 1, name: "a", avatar: null }, isFollowing: false },
        { user: { id: 2, name: "b", avatar: null }, isFollowing: false },
      ],
    };
    const next = withNearbyFollowRow(data, 2, true);
    expect(next?.items.map((item) => item.isFollowing)).toEqual([false, true]);
    expect(next?.total).toBe(2);
    expect(data.items[1].isFollowing).toBe(false);
    expect(withNearbyFollowRow(undefined, 2, true)).toBeUndefined();
  });
});
