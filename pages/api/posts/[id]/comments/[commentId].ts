import { NextApiRequest, NextApiResponse } from "next";
import withHandler, { ResponseType } from "@libs/server/withHandler";

import client from "@libs/server/client";
import { extractPostIdFromPath } from "@libs/post-route";
import { withAuth } from "@libs/server/auth";
import { deleteOwnComment, sendCommentError } from "@libs/server/comments";
import { validateCommentBody } from "@libs/shared/comment";
import { parsePositiveIntId } from "@libs/shared/normalize";

/** PATCH /api/posts/:id/comments/:commentId 성공 응답 */
export interface CommentUpdateResponse {
  success: true;
  comment: { id: number; comment: string; editedAt: Date | null };
}

/** DELETE /api/posts/:id/comments/:commentId 성공 응답. placeholder = 답글이 남아 '삭제된 댓글' 자리로 남김 */
export interface CommentDeleteResponse {
  success: true;
  mode: "hard" | "placeholder";
}

/**
 * PATCH  /api/posts/:id/comments/:commentId — 작성자 본인의 댓글 수정 { comment }
 * DELETE /api/posts/:id/comments/:commentId — 작성자 본인의 댓글 삭제
 * 실패는 { success:false, error, message, errorCode }.
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

  const target = await client.comment.findUnique({
    where: { id: commentId },
    select: { userId: true, postId: true, parentId: true, deletedAt: true },
  });
  if (!target || target.postId !== postId || target.deletedAt) {
    return sendCommentError(res, 404, "COMMENT_NOT_FOUND", "댓글을 찾을 수 없습니다.");
  }
  if (target.userId !== user.id) {
    return sendCommentError(
      res,
      403,
      "COMMENT_FORBIDDEN",
      "본인 댓글만 수정·삭제할 수 있습니다."
    );
  }

  if (req.method === "DELETE") {
    const mode = await deleteOwnComment({ id: commentId, parentId: target.parentId });
    const body: CommentDeleteResponse = { success: true, mode };
    return res.json(body);
  }

  const validation = validateCommentBody(req.body?.comment);
  if (!validation.ok) {
    return sendCommentError(res, 400, validation.errorCode, validation.message);
  }
  const updated = await client.comment.update({
    where: { id: commentId },
    data: { comment: validation.comment, editedAt: new Date() },
    select: { id: true, comment: true, editedAt: true },
  });
  const body: CommentUpdateResponse = { success: true, comment: updated };
  return res.json(body);
}

export default withAuth(
  withHandler({
    methods: ["PATCH", "DELETE"],
    handler,
    isPrivate: true,
  })
);
