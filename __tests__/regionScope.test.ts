import { REGIONS } from "@libs/shared/regions";
import {
  NEIGHBOR_RADIUS_KM,
  nearbyRegions,
  regionDistanceKm,
  regionScopeLabel,
  regionScopeOr,
} from "@libs/shared/regionScope";

const names = (list: { sido: string; sigungu: string }[]) => list.map((r) => `${r.sido} ${r.sigungu}`);

describe("regionScopeLabel", () => {
  it.each([
    ["서울특별시", "구로구", "서울"],
    ["대전광역시", "유성구", "대전"],
    ["부산광역시", "기장군", "부산"],
    ["세종특별자치시", "세종특별자치시", "세종"],
    ["경기도", "수원시", "수원시"],
    ["충청북도", "청주시", "청주시"],
    ["충청북도", "보은군", "보은군 근처"],
    ["제주특별자치도", "제주시", "제주시"],
  ])("%s %s → %s", (sido, sigungu, label) => {
    expect(regionScopeLabel(sido, sigungu)).toBe(label);
  });

  it("라벨에 구 이름이 들어가지 않는다", () => {
    for (const entry of REGIONS) {
      for (const sigungu of entry.sigungu) {
        if (sigungu.endsWith("구")) expect(regionScopeLabel(entry.sido, sigungu)).not.toContain(sigungu);
      }
    }
  });

  it("동네가 없으면 빈 문자열", () => {
    expect(regionScopeLabel(null, null)).toBe("");
  });
});

describe("nearbyRegions (AC-18)", () => {
  it(`반경 기본값은 ${NEIGHBOR_RADIUS_KM}km`, () => {
    expect(NEIGHBOR_RADIUS_KM).toBe(50);
  });

  it("보은군 사용자 범위에 청주시·대전 구가 들어가고, 내 군이 맨 앞(0km)", () => {
    const list = nearbyRegions("충청북도", "보은군");
    expect(list[0]).toEqual({ sido: "충청북도", sigungu: "보은군", distanceKm: 0 });
    expect(names(list)).toEqual(expect.arrayContaining(["충청북도 청주시", "대전광역시 동구", "대전광역시 대덕구"]));
    expect(names(list)).not.toContain("서울특별시 종로구");
    // 가까운 순
    const distances = list.map((r) => r.distanceKm);
    expect(distances).toEqual([...distances].sort((a, b) => a - b));
  });

  it("구로구 사용자 범위에 서울 25개 구 전부 + 광명시·부천시", () => {
    const list = nearbyRegions("서울특별시", "구로구");
    const seoul = REGIONS.find((r) => r.sido === "서울특별시")!.sigungu;
    for (const gu of seoul) expect(names(list)).toContain(`서울특별시 ${gu}`);
    expect(names(list)).toEqual(expect.arrayContaining(["경기도 광명시", "경기도 부천시"]));
    expect(names(list)).not.toContain("부산광역시 중구");
  });

  it("같은 광역시는 거리와 무관하게 전부(부산 기장군 ↔ 강서구)", () => {
    const list = nearbyRegions("부산광역시", "기장군", 5);
    const busan = REGIONS.find((r) => r.sido === "부산광역시")!.sigungu;
    expect(list.filter((r) => r.sido === "부산광역시")).toHaveLength(busan.length);
  });

  it("좌표를 모르는 조합이면 내 시/군/구 하나만", () => {
    expect(nearbyRegions("없는도", "없는시")).toEqual([{ sido: "없는도", sigungu: "없는시", distanceKm: 0 }]);
  });
});

describe("regionDistanceKm·regionScopeOr", () => {
  it("같은 곳은 0, 모르면 null", () => {
    expect(regionDistanceKm({ sido: "경기도", sigungu: "수원시" }, { sido: "경기도", sigungu: "수원시" })).toBe(0);
    expect(regionDistanceKm({ sido: "x", sigungu: "y" }, { sido: "경기도", sigungu: "수원시" })).toBeNull();
    expect(regionDistanceKm({ sido: "서울특별시", sigungu: "구로구" }, { sido: "경기도", sigungu: "광명시" })).toBeLessThan(5);
  });

  it("시/도별로 묶는다", () => {
    expect(
      regionScopeOr([
        { sido: "경기도", sigungu: "수원시" },
        { sido: "서울특별시", sigungu: "구로구" },
        { sido: "경기도", sigungu: "광명시" },
      ]),
    ).toEqual([
      { regionSido: "경기도", regionSigungu: { in: ["수원시", "광명시"] } },
      { regionSido: "서울특별시", regionSigungu: { in: ["구로구"] } },
    ]);
  });
});
