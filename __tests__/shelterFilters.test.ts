/**
 * 보호소 아이들 필터(앱 design/mockups/adoption-v2): 주소·API 쿼리 읽고 쓰기, 크기 구간, 필터 줄 글자.
 */
import {
  hasShelterFilters,
  parseShelterFilters,
  shelterFilterSummary,
  shelterFiltersToQuery,
  shelterSizeOf,
} from "@libs/shared/shelterFilters";

describe("shelterFilters", () => {
  it("쿼리 ↔ 필터 왕복: 쉼표 목록, 크기 키는 dogSize, 기본 정렬·모르는 값은 버린다", () => {
    const filters = {
      category: "강아지" as const,
      sido: ["경기도"],
      sigungu: ["수원시", "화성시"],
      breed: ["말티즈", "비숑 프리제"],
      size: "small" as const,
      sort: "deadline" as const,
    };
    const query = shelterFiltersToQuery(filters);
    expect(query).toEqual({
      category: "강아지",
      sido: "경기도",
      sigungu: "수원시,화성시",
      breed: "말티즈,비숑 프리제",
      dogSize: "small",
      sort: "deadline",
    });
    expect(parseShelterFilters(query)).toEqual(filters);
    // URLSearchParams(주소)도 같은 결과, 쪽 크기 size 는 크기 필터로 읽지 않는다.
    expect(parseShelterFilters(new URLSearchParams({ ...query, size: "12" }))).toEqual(filters);
    expect(parseShelterFilters({ sort: "latest", dogSize: "huge", category: "토끼", sido: " , " })).toEqual({});
    // 고양이에는 크기를 걸지 않는다.
    expect(parseShelterFilters({ category: "고양이", dogSize: "small" })).toEqual({ category: "고양이" });
    expect(hasShelterFilters({ category: "강아지" })).toBe(false);
  });

  it("크기 구간은 7 이하·7 초과 15 이하·15 초과이고 몸무게를 모르면 없다", () => {
    expect([shelterSizeOf(7), shelterSizeOf(7.1), shelterSizeOf(15), shelterSizeOf(15.1), shelterSizeOf(null)]).toEqual([
      "small",
      "medium",
      "medium",
      "large",
      null,
    ]);
  });

  it("필터 줄 글자: 걸리지 않으면 이름만, 걸리면 '지역: 수원시 외 1'", () => {
    expect(shelterFilterSummary({})).toMatchObject({
      region: { label: "지역", applied: false },
      sort: { label: "정렬: 최신 공고", applied: false },
    });
    expect(
      shelterFilterSummary({ sido: ["경기도"], sigungu: ["수원시", "화성시"], breed: ["말티즈", "푸들"], size: "small", sort: "deadline" })
    ).toMatchObject({
      region: { label: "지역: 수원시 외 1", applied: true },
      breed: { label: "품종: 말티즈 외 1", applied: true },
      size: { label: "크기: 소형", applied: true },
      sort: { label: "정렬: 마감 임박", applied: true },
    });
  });
});
