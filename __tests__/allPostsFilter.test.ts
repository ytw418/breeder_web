import { allPostsHref, parseAllPostsParams, ALL_POSTS_CATEGORIES } from "@libs/shared/allPostsFilter";

describe("게시글 전체보기 필터(/posts/all)", () => {
  it("모르는 값은 전체·인기순으로 돌리고, 칩은 전체 다음 정보·자유·질문·자랑·후기·사진·토론·동네·변이 순이다", () => {
    expect(parseAllPostsParams(new URLSearchParams("category=없음&sort=oldest"))).toEqual({
      category: "전체",
      sort: "popular",
    });
    expect(parseAllPostsParams(new URLSearchParams("category=질문&sort=comments"))).toEqual({
      category: "질문",
      sort: "comments",
    });
    expect(ALL_POSTS_CATEGORIES.join(",")).toBe("전체,정보,자유,질문,자랑,후기,사진,토론,동네,변이");
  });

  it("기본값(전체·인기순)은 주소에서 생략하고 utm 같은 다른 쿼리는 남긴다", () => {
    expect(allPostsHref({ category: "전체", sort: "popular" })).toBe("/posts/all");
    expect(allPostsHref({ category: "정보", sort: "latest" }, "sort=popular&utm_source=a")).toBe(
      "/posts/all?category=%EC%A0%95%EB%B3%B4&sort=latest&utm_source=a"
    );
  });
});
