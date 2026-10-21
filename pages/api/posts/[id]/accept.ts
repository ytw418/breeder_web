import { NextApiRequest, NextApiResponse } from "next";
import withHandler, { ResponseType } from "@libs/server/withHandler";
import client from "@libs/server/client";
import { withAuth } from "@libs/server/auth";
import { extractPostIdFromPath } from "@libs/post-route";
import { createNotification } from "@libs/server/notification";
import { parsePositiveIntId } from "@libs/shared/normalize";

/** 질문 글 카테고리. 채택은 질문 글에만 있다. */
const QUESTION_CATEGORY = "질문";
/** 알림 문구에 넣는 질문 제목 길이. 넘으면 말줄임. */
const TITLE_MAX = 30;

export interface PostAcceptResponse {
  success: true;
  acceptedCommentId: number | null;
  resolvedAt: string | null;
}

const fail = (res: NextApiResponse, status: number, errorCode: string, error: string) =>
  res.status(status).json({ success: false, error, message: error, errorCode });

/**
 * 질문 답변 채택(앱 docs/prd/feed-engagement.md 2026-10-21 '해결').
 * - POST { commentId }: 질문자만, 그 질문에 달린 남의 댓글(지우거나 숨기지 않은 것)을 채택한다. 다른 답으로 바꿀 수 있다.
 *   답한 사람에게 ANSWER_ACCEPTED 알림('"{제목}" 질문에 회원님의 답변이 채택됐어요', 같은 댓글은 한 번).
 * - DELETE: 채택을 푼다(acceptedCommentId·resolvedAt 을 비운다). 보낸 알림은 그대로 둔다.
 */
async function handler(req: NextApiRequest, res: NextApiResponse<ResponseType | PostAcceptResponse>) {
  const postId = extractPostIdFromPath(req.query.id);
  if (!Number.isInteger(postId) || postId <= 0) {
    return fail(res, 400, "POST_INVALID_ID", "유효하지 않은 게시글 ID입니다.");
  }
  const user = req.user!;
  const post = await client.post.findUnique({
    where: { id: postId },
    select: { id: true, userId: true, title: true, category: true, acceptedCommentId: true },
  });
  if (!post) return fail(res, 404, "POST_NOT_FOUND", "게시글을 찾을 수 없습니다.");
  if (post.userId !== user.id) return fail(res, 403, "ACCEPT_FORBIDDEN", "질문을 올린 사람만 채택할 수 있어요.");
  if (post.category !== QUESTION_CATEGORY) {
    return fail(res, 400, "ACCEPT_NOT_QUESTION", "질문 글에서만 답변을 채택할 수 있어요.");
  }

  if (req.method === "DELETE") {
    await client.post.update({ where: { id: postId }, data: { acceptedCommentId: null, resolvedAt: null } });
    return res.json({ success: true, acceptedCommentId: null, resolvedAt: null });
  }

  const commentId = parsePositiveIntId(req.body?.commentId);
  if (commentId === null) return fail(res, 400, "ACCEPT_INVALID_COMMENT", "채택할 답변이 올바르지 않습니다.");
  const comment = await client.comment.findUnique({
    where: { id: commentId },
    select: { id: true, postId: true, userId: true, deletedAt: true, isHidden: true },
  });
  if (!comment || comment.postId !== postId || comment.deletedAt || comment.isHidden) {
    return fail(res, 404, "ACCEPT_COMMENT_NOT_FOUND", "채택할 답변을 찾을 수 없습니다.");
  }
  if (comment.userId === post.userId) {
    return fail(res, 400, "ACCEPT_OWN_COMMENT", "내 댓글은 채택할 수 없어요.");
  }

  const updated = await client.post.update({
    where: { id: postId },
    data: { acceptedCommentId: comment.id, resolvedAt: new Date() },
    select: { acceptedCommentId: true, resolvedAt: true },
  });
  if (post.acceptedCommentId !== comment.id) {
    const title = (post.title ?? "").trim();
    const shortTitle = title.length > TITLE_MAX ? `${title.slice(0, TITLE_MAX)}…` : title;
    await createNotification({
      type: "ANSWER_ACCEPTED",
      userId: comment.userId,
      senderId: user.id,
      message: `"${shortTitle}" 질문에 회원님의 답변이 채택됐어요`,
      targetId: postId,
      targetType: "post",
      commentId: comment.id,
      // 채택했다 풀고 다시 같은 답을 채택해도 알림은 한 번만.
      dedupe: true,
      pushTitle: title || undefined,
    });
  }
  return res.json({
    success: true,
    acceptedCommentId: updated.acceptedCommentId,
    resolvedAt: updated.resolvedAt?.toISOString() ?? null,
  });
}

export default withAuth(
  withHandler({
    methods: ["POST", "DELETE"],
    handler,
    isPrivate: true,
  })
);
