import { NextApiRequest, NextApiResponse } from "next";
import withHandler, { ResponseType } from "@libs/server/withHandler";

import client from "@libs/server/client";
import { extractPostIdFromPath } from "@libs/post-route";
import { withAuth } from "@libs/server/auth";
import { isModeratorUser } from "@libs/server/adminAccess";
import { createNotification } from "@libs/server/notification";
import { incrementUserMissionProgress } from "@libs/server/growth";
import { getBlockRelation } from "@libs/server/blocks";
import { sendCommentError } from "@libs/server/comments";
import { validateCommentBody } from "@libs/shared/comment";
import { parsePositiveIntId } from "@libs/shared/normalize";

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseType>
) {
  const {
    query: { id = "" },
    user,
    body,
  } = req;

  const postId = extractPostIdFromPath(id);
  if (Number.isNaN(postId)) {
    return res.status(400).json({ success: false, error: "유효하지 않은 게시글 ID입니다." });
  }

  // 운영자가 숨긴 글에는 작성자·관리자만 댓글을 단다(다른 사람에겐 404 와 같다).
  const post = await client.post.findUnique({
    where: { id: postId },
    select: { userId: true, isHidden: true, category: true },
  });
  if (!post) {
    return res.status(404).json({ success: false, error: "게시글을 찾을 수 없습니다." });
  }
  if (post.isHidden && post.userId !== user?.id && !isModeratorUser(user)) {
    return res.status(404).json({
      success: false,
      error: "운영 정책에 따라 비공개된 게시글입니다.",
    });
  }

  const validation = validateCommentBody(body?.comment);
  if (!validation.ok) {
    return sendCommentError(res, 400, validation.errorCode, validation.message);
  }

  // 대댓글은 1단계다. 답글에 답글을 달면 그 루트에 붙인다.
  let parent: { id: number; notifyUserId: number | null } | null = null;
  if (body?.parentId != null) {
    const parentId = parsePositiveIntId(body.parentId);
    if (parentId === null) {
      return sendCommentError(res, 400, "COMMENT_INVALID_PARENT", "답글을 남길 댓글이 올바르지 않습니다.");
    }
    const target = await client.comment.findUnique({
      where: { id: parentId },
      select: { id: true, userId: true, postId: true, parentId: true, isHidden: true, deletedAt: true },
    });
    const root =
      target?.parentId != null
        ? await client.comment.findUnique({
            where: { id: target.parentId },
            select: { id: true, userId: true, postId: true, parentId: true, isHidden: true, deletedAt: true },
          })
        : target;
    // 숨긴 댓글은 작성자·관리자에게만 보이므로 다른 사람에겐 없는 댓글과 같다.
    const hiddenFromViewer =
      root?.isHidden && root.userId !== user?.id && !isModeratorUser(user);
    if (!root || root.postId !== postId || hiddenFromViewer) {
      return sendCommentError(res, 404, "COMMENT_PARENT_NOT_FOUND", "답글을 남길 댓글을 찾을 수 없습니다.");
    }
    // 답글의 답글은 그 답글 작성자에게 알린다(입력창 대상 표시와 같은 사람). 지운 댓글 작성자에겐 알리지 않는다.
    const replyTo = target ?? root;
    parent = { id: root.id, notifyUserId: replyTo.deletedAt ? null : replyTo.userId };
  }

  const newAnswer = await client.comment.create({
    data: {
      user: {
        connect: {
          id: user?.id,
        },
      },
      post: {
        connect: {
          id: postId,
        },
      },
      comment: validation.comment,
      parentId: parent?.id ?? null,
    },
  });

  const senderUser = await client.user.findUnique({
    where: { id: user?.id },
    select: { name: true },
  });

  if (user?.id && senderUser) {
    // 받는 사람이 차단한 사람의 댓글은 그 사람에게 숨겨지므로 알림·푸시도 보내지 않는다.
    const blockedBy = async (receiverId: number) =>
      receiverId !== user.id && (await getBlockRelation(receiverId, user.id)).blockedByMe;

    // 답글 알림(부모 댓글 작성자에게)
    const replyReceiverId = parent?.notifyUserId ?? null;
    if (replyReceiverId !== null && !(await blockedBy(replyReceiverId))) {
      await createNotification({
        type: "COMMENT",
        userId: replyReceiverId,
        senderId: user.id,
        message: `${senderUser.name}님이 회원님의 댓글에 답글을 남겼습니다.`,
        targetId: postId,
        targetType: "post",
        commentId: newAnswer.id,
      });
    }
    // 댓글 알림(게시글 작성자에게). 답글 알림을 이미 받은 사람이면 한 번만 보낸다.
    if (replyReceiverId !== post.userId && !(await blockedBy(post.userId))) {
      await createNotification({
        type: "COMMENT",
        userId: post.userId,
        senderId: user.id,
        // 질문 글은 '답변'으로 알려 질문자가 바로 열어 보게 한다.
        message:
          post.category === "질문"
            ? `${senderUser.name}님이 회원님의 질문에 답변을 남겼어요.`
            : `${senderUser.name}님이 회원님의 게시글에 댓글을 남겼습니다.`,
        targetId: postId,
        targetType: "post",
        commentId: newAnswer.id,
      });
    }
    await incrementUserMissionProgress(user.id, "comment_write");
  }

  res.json({
    success: true,
    answer: newAnswer,
  });
}

export default withAuth(
  withHandler({
    methods: ["POST"],
    handler,
    isPrivate: true,
  })
);
