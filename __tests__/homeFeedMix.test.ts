import { HOME_PRODUCT_EVERY, mixHomeFeed, productsNeeded } from "@libs/shared/homeFeedMix";

const kinds = (rows: { kind: string }[]) => rows.map((row) => (row.kind === "post" ? "p" : "S")).join("");

describe("mixHomeFeed", () => {
  it("게시글 3개마다 분양글 하나", () => {
    expect(HOME_PRODUCT_EVERY).toBe(3);
    const rows = mixHomeFeed([1, 2, 3, 4, 5, 6, 7], ["a", "b", "c"], { postsDone: false });
    expect(kinds(rows)).toBe("pppSpppSp");
  });

  it("게시글이 더 올 수 있으면 남은 분양글은 아껴 둔다", () => {
    const rows = mixHomeFeed([1, 2, 3], ["a", "b", "c"], { postsDone: false });
    expect(kinds(rows)).toBe("pppS");
  });

  it("게시글이 끝났으면 남은 분양글을 뒤에 붙인다", () => {
    const rows = mixHomeFeed([1, 2], ["a", "b"], { postsDone: true });
    expect(kinds(rows)).toBe("ppSS");
    expect(mixHomeFeed([], ["a"], { postsDone: true })).toEqual([{ kind: "product", product: "a" }]);
  });

  it("분양글이 모자라면 게시글만 이어진다", () => {
    const rows = mixHomeFeed([1, 2, 3, 4, 5, 6], ["a"], { postsDone: false });
    expect(kinds(rows)).toBe("pppSppp");
  });

  it("다음 페이지가 붙어도 앞 행 순서는 그대로", () => {
    const first = mixHomeFeed([1, 2, 3, 4], ["a", "b"], { postsDone: false });
    const next = mixHomeFeed([1, 2, 3, 4, 5, 6, 7], ["a", "b", "c"], { postsDone: false });
    expect(next.slice(0, first.length)).toEqual(first);
  });

  it("productsNeeded", () => {
    expect(productsNeeded(0)).toBe(0);
    expect(productsNeeded(8)).toBe(2);
    expect(productsNeeded(9)).toBe(3);
  });
});
