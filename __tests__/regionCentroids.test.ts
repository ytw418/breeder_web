import { REGIONS } from "@libs/shared/regions";
import { REGION_CENTROIDS, haversineKm, regionCentroid } from "@libs/shared/regionCentroids";

const km = (a: [string, string], b: [string, string]) =>
  haversineKm(regionCentroid(a[0], a[1])!, regionCentroid(b[0], b[1])!);

describe("regionCentroids", () => {
  it("REGIONS 의 모든 시/도·시/군/구에 중심 좌표가 있다(국내 범위 안)", () => {
    let count = 0;
    for (const entry of REGIONS) {
      expect(REGION_CENTROIDS[entry.sido]).toBeDefined();
      for (const sigungu of entry.sigungu) {
        const point = REGION_CENTROIDS[entry.sido].sigungu[sigungu];
        expect(point).toBeDefined();
        const [lat, lng] = point;
        expect(lat).toBeGreaterThan(33);
        expect(lat).toBeLessThan(38.7);
        expect(lng).toBeGreaterThan(124.5);
        expect(lng).toBeLessThan(131);
        count += 1;
      }
    }
    expect(count).toBe(229);
  });

  it("표에 없는 시/군/구는 시/도 중심, 시/도도 없으면 null", () => {
    expect(regionCentroid("서울특별시", "없는구")).toEqual({ lat: 37.5665, lng: 126.978 });
    expect(regionCentroid("서울특별시")).toEqual({ lat: 37.5665, lng: 126.978 });
    expect(regionCentroid("없는도", "x")).toBeNull();
    expect(regionCentroid(null)).toBeNull();
  });

  it("알려진 거리가 그럴듯하다", () => {
    const jongno: [string, string] = ["서울특별시", "종로구"];
    const suwon: [string, string] = ["경기도", "수원시"];
    const boeun: [string, string] = ["충청북도", "보은군"];
    const cheongju: [string, string] = ["충청북도", "청주시"];
    const daejeon: [string, string] = ["대전광역시", "서구"];
    const busan: [string, string] = ["부산광역시", "부산진구"];
    expect(km(jongno, suwon)).toBeGreaterThanOrEqual(30);
    expect(km(jongno, suwon)).toBeLessThanOrEqual(40);
    expect(km(boeun, cheongju)).toBeGreaterThanOrEqual(25);
    expect(km(boeun, cheongju)).toBeLessThanOrEqual(40);
    // 보은군청 ↔ 대전 시내 직선 거리는 약 34~38km(군청 소재지 기준).
    expect(km(boeun, daejeon)).toBeGreaterThanOrEqual(30);
    expect(km(boeun, daejeon)).toBeLessThanOrEqual(50);
    expect(km(jongno, busan)).toBeGreaterThan(300);
  });
});
