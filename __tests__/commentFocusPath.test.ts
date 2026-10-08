import { toPostCommentPath } from "@libs/post-route";
import { getNotificationHref } from "@/app/(web)/notifications/notificationFormat";

/** 댓글 알림·프로필 댓글 행은 글을 열고 그 댓글까지 스크롤한다(?commentId=). */
describe("댓글로 가는 경로", () => {
  it("댓글 id 가 있으면 ?commentId= 를 붙이고, 없으면 글 경로", () => {
    expect(toPostCommentPath(10, 5)).toBe("/posts/10?commentId=5");
    expect(toPostCommentPath(10, 5, "레게 사육 후기")).toBe("/posts/10-레게-사육-후기?commentId=5");
    expect(toPostCommentPath(10, null)).toBe("/posts/10");
  });

  it("게시글 알림에 commentId 가 있으면 그 댓글로 간다", () => {
    expect(getNotificationHref("post", 10, 5)).toBe("/posts/10?commentId=5");
    expect(getNotificationHref("post", 10, null)).toBe("/posts/10");
    expect(getNotificationHref("post", 10)).toBe("/posts/10");
  });
});
