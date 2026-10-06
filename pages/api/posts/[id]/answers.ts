import { NextApiRequest, NextApiResponse } from "next";
import withHandler, { ResponseType } from "@libs/server/withHandler";

import client from "@libs/server/client";
import { extractPostIdFromPath } from "@libs/post-route";
import { withAuth } from "@libs/server/auth";
import { isModeratorUser } from "@libs/server/adminAccess";
import { createNotification } from "@libs/server/notification";
import { incrementUserMissionProgress } from "@libs/server/growth";
import { getBlockRelation } from "@libs/server/blocks";

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseType>
) {
  const {
    query: { id = "" },
    user,
    body: { comment },
  } = req;

  const postId = extractPostIdFromPath(id);
  if (Number.isNaN(postId)) {
    return res.status(400).json({ success: false, error: "유효하지 않은 게시글 ID입니다." });
  }

  // 운영자가 숨긴 글에는 작성자·관리자만 댓글을 단다(다른 사람에겐 404 와 같다).
  const post = await client.post.findUnique({
    where: { id: postId },
    select: { userId: true, isHidden: true },
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
      comment: comment,
    },
  });

  // 댓글 알림 생성 (게시글 작성자에게)
  const senderUser = await client.user.findUnique({
    where: { id: user?.id },
    select: { name: true },
  });

  if (user?.id && senderUser) {
    // 게시글 작성자가 차단한 사람의 댓글은 작성자에게 숨겨지므로 알림·푸시도 보내지 않는다.
    const { blockedByMe: authorBlockedCommenter } =
      post.userId === user.id
        ? { blockedByMe: false }
        : await getBlockRelation(post.userId, user.id);
    if (!authorBlockedCommenter) {
      await createNotification({
        type: "COMMENT",
        userId: post.userId,
        senderId: user.id,
        message: `${senderUser.name}님이 회원님의 게시글에 댓글을 남겼습니다.`,
        targetId: postId,
        targetType: "post",
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
