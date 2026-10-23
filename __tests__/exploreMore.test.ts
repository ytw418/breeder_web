import { DEBATES_HREF, pickExploreItems, type ExploreItem } from "@libs/shared/exploreMore";

const post = (id: number): ExploreItem => ({ kind: "post", id, href: `/posts/${id}`, title: `글 ${id}`, image: null, meta: "질문" });

describe("pickExploreItems", () => {
  it("인기 글에서 지금 보는 글과 비슷한 글에 나온 글을 빼고 6개씩 자른다", () => {
    const result = pickExploreItems({
      similar: [1, 2, 3, 4, 5, 6, 7].map(post),
      popular: [9, 2, 10, 11, 12, 13, 14, 15].map(post),
      currentPostId: 9,
      hotDebate: null,
    });
    expect(result.similar.map((item) => item.id)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(result.popular.map((item) => item.id)).toEqual([10, 11, 12, 13, 14, 15]);
    expect(result.debateHref).toBe(DEBATES_HREF);
  });

  it("진행 중 토론이 있으면 그 글로 보낸다", () => {
    const result = pickExploreItems({ similar: [], popular: [], currentPostId: null, hotDebate: { id: 192, title: "레게 합사" } });
    expect(result.debateHref).toBe("/posts/192-레게-합사");
    expect(result.bloodlineCta).toBe(true);
  });

  it("강아지·고양이 글은 인기 글이 3개보다 적으면 숨기고 혈통 카드 버튼을 뺀다(앱 docs/prd/pet-space.md §5.10)", () => {
    const few = pickExploreItems({ similar: [], popular: [1, 2].map(post), currentPostId: null, hotDebate: null, petSpace: true });
    expect(few.popular).toEqual([]);
    expect(few.bloodlineCta).toBe(false);
    const enough = pickExploreItems({ similar: [], popular: [1, 2, 3].map(post), currentPostId: null, hotDebate: null, petSpace: true });
    expect(enough.popular.map((item) => item.id)).toEqual([1, 2, 3]);
    // 다른 글은 1개여도 그대로 보인다.
    const other = pickExploreItems({ similar: [], popular: [post(1)], currentPostId: null, hotDebate: null });
    expect(other.popular).toHaveLength(1);
  });
});
