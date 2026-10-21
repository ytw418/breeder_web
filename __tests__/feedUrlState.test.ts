import { DEFAULT_FEED_STATE, feedQuery, parseFeedParams } from "@libs/client/feedUrlState";

describe("홈 전체 게시글 필터 ↔ 주소 쿼리(감사 11번)", () => {
  it("기본값은 쓰지 않고, 쓴 쿼리를 다시 읽으면 같은 필터가 된다", () => {
    expect(feedQuery(DEFAULT_FEED_STATE)).toBe("");

    const state = { category: "질문", sort: "popular" as const, species: "곤충", sub: "사슴벌레" };
    const qs = feedQuery(state);
    expect(parseFeedParams(new URLSearchParams(qs))).toEqual(state);

    // 모르는 값은 기본값으로, 종이 없으면 소분류도 버린다.
    expect(parseFeedParams(new URLSearchParams("category=없는칩&sort=x&sub=사슴벌레"))).toEqual(DEFAULT_FEED_STATE);
  });
});
