import { NextApiRequest, NextApiResponse } from "next";
import withHandler, { ResponseType } from "@libs/server/withHandler";

import client from "@libs/server/client";
import { withApiSession } from "@libs/server/withSession";
import { createNotification } from "@libs/server/notification";

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseType>
) {
  const {
    query: { id = "" },
    session: { user },
    body: { comment },
  } = req;

  const postId = +id.toString();

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
  const post = await client.post.findUnique({
    where: { id: postId },
    select: { userId: true },
  });
  const senderUser = await client.user.findUnique({
    where: { id: user?.id },
    select: { name: true },
  });

  if (post && user?.id && senderUser) {
    await createNotification({
      type: "COMMENT",
      userId: post.userId,
      senderId: user.id,
      message: `${senderUser.name}님이 회원님의 게시글에 댓글을 남겼습니다.`,
      targetId: postId,
      targetType: "post",
    });
  }

  res.json({
    success: true,
    answer: newAnswer,
  });
}

export default withApiSession(
  withHandler({
    methods: ["POST"],
    handler,
    isPrivate: true,
  })
);
