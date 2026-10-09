import { groupCommentThreads, validateCommentBody } from "@libs/shared/comment";

/** 댓글 묶기·검증(웹·앱 공통 규칙). 앱 src/lib/comment.ts 와 같은 결과여야 한다. */
describe("groupCommentThreads", () => {
  const row = (id: number, parentId: number | null = null, deletedAt: string | null = null) => ({
    id,
    parentId,
    deletedAt,
  });

  it("작성순 flat 목록을 루트 아래 답글로 묶는다", () => {
    const threads = groupCommentThreads([row(1), row(2), row(3, 1), row(4, 2), row(5, 1)]);

    expect(threads.map((t) => [t.root.id, t.replies.map((r) => r.id)])).toEqual([
      [1, [3, 5]],
      [2, [4]],
    ]);
  });

  it("부모가 목록에 없는 답글(차단·숨김)은 루트로 올린다", () => {
    const threads = groupCommentThreads([row(1), row(3, 2)]);

    expect(threads.map((t) => t.root.id)).toEqual([1, 3]);
  });

  it("답글의 답글이 와도 맨 위 루트에 붙인다", () => {
    const threads = groupCommentThreads([row(1), row(2, 1), row(3, 2)]);

    expect(threads).toHaveLength(1);
    expect(threads[0].replies.map((r) => r.id)).toEqual([2, 3]);
  });

  it("'삭제된 댓글' 자리는 보이는 답글이 있을 때만 남긴다", () => {
    const deleted = "2026-10-09T00:00:00.000Z";
    const threads = groupCommentThreads([row(1, null, deleted), row(2, null, deleted), row(3, 2)]);

    expect(threads.map((t) => t.root.id)).toEqual([2]);
  });
});

describe("validateCommentBody", () => {
  it("앞뒤 공백을 지운다", () => {
    expect(validateCommentBody("  댓글\n  ")).toEqual({ ok: true, comment: "댓글" });
  });

  it("문자열이 아니거나 비면 COMMENT_EMPTY", () => {
    expect(validateCommentBody(undefined)).toMatchObject({ ok: false, errorCode: "COMMENT_EMPTY" });
    expect(validateCommentBody(" \n ")).toMatchObject({ ok: false, errorCode: "COMMENT_EMPTY" });
  });

  it("1000자까지 받는다", () => {
    expect(validateCommentBody("가".repeat(1000)).ok).toBe(true);
    expect(validateCommentBody("가".repeat(1001))).toMatchObject({
      ok: false,
      errorCode: "COMMENT_TOO_LONG",
      message: "댓글은 1,000자까지 입력할 수 있습니다.",
    });
  });
});
