import { NextApiRequest, NextApiResponse } from "next";
import withHandler, { ResponseType } from "@libs/server/withHandler";

import client from "@libs/server/client";
import { extractPostIdFromPath } from "@libs/post-route";
import { withAuth } from "@libs/server/auth";
import { getBlockRelation } from "@libs/server/blocks";
import { commentVisibilityWhere, sendCommentError } from "@libs/server/comments";
import { createNotification } from "@libs/server/notification";
import { parsePositiveIntId } from "@libs/shared/normalize";

/** POST /api/posts/:id/comments/:commentId/like 성공 응답 */
export interface CommentLikeResponse {
  success: true;
  liked: boolean;
  likeCount: number;
}

/**
 * POST /api/posts/:id/comments/:commentId/like — 댓글 좋아요 토글.
 * 볼 수 없는 댓글(다른 글·지운 자리·숨김·차단한 사람)은 404 COMMENT_NOT_FOUND.
 */
async function handler(req: NextApiRequest, res: NextApiResponse<ResponseType>) {
  const { user } = req;
  if (!user?.id) {
    return sendCommentError(res, 401, "COMMENT_AUTH_REQUIRED", "로그인이 필요합니다.");
  }

  const postId = extractPostIdFromPath(req.query.id ?? "");
  const rawCommentId = Array.isArray(req.query.commentId)
    ? req.query.commentId[0]
    : req.query.commentId;
  const commentId = parsePositiveIntId(rawCommentId);
  if (!Number.isInteger(postId) || postId <= 0 || commentId === null) {
    return sendCommentError(res, 400, "COMMENT_INVALID_ID", "유효하지 않은 댓글입니다.");
  }

  const visibility = await commentVisibilityWhere(user);
  const comment = await client.comment.findFirst({
    where: {
      AND: [{ id: commentId, postId, deletedAt: null }, ...(visibility ? [visibility] : [])],
    },
    select: { userId: true },
  });
  if (!comment) {
    return sendCommentError(res, 404, "COMMENT_NOT_FOUND", "댓글을 찾을 수 없습니다.");
  }

  const existing = await client.commentLike.findUnique({
    where: { userId_commentId: { userId: user.id, commentId } },
    select: { id: true },
  });
  if (existing) {
    await client.commentLike.delete({ where: { id: existing.id } });
  } else {
    try {
      await client.commentLike.create({ data: { userId: user.id, commentId } });
    } catch (error) {
      // 두 번 빠르게 눌러 이미 들어간 좋아요(유니크 충돌)는 좋아요한 것으로 본다.
      if ((error as { code?: string })?.code !== "P2002") throw error;
    }

    // 알림은 부가 작업이라 실패해도 좋아요 응답에 영향을 주지 않는다.
    // 껐다 켜도 알림·푸시는 처음 한 번만(dedupe), 작성자가 나를 차단했으면 보내지 않는다.
    try {
      const authorBlockedMe =
        comment.userId !== user.id &&
        (await getBlockRelation(comment.userId, user.id)).blockedByMe;
      const sender = await client.user.findUnique({
        where: { id: user.id },
        select: { name: true },
      });
      if (!authorBlockedMe && sender) {
        await createNotification({
          type: "LIKE",
          userId: comment.userId,
          senderId: user.id,
          message: `${sender.name}님이 회원님의 댓글을 좋아합니다.`,
          targetId: postId,
          targetType: "post",
          commentId,
          dedupe: true,
        });
      }
    } catch (error) {
      console.error("posts.comments.like.notification.error", error);
    }
  }

  const likeCount = await client.commentLike.count({ where: { commentId } });
  const body: CommentLikeResponse = { success: true, liked: !existing, likeCount };
  return res.json(body);
}

export default withAuth(
  withHandler({
    methods: ["POST"],
    handler,
    isPrivate: true,
  })
);
