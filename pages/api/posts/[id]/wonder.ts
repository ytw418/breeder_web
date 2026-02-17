import { NextApiRequest, NextApiResponse } from "next";
import withHandler, { ResponseType } from "@libs/server/withHandler";

import client from "@libs/server/client";
import { extractPostIdFromPath } from "@libs/post-route";
import { withApiSession } from "@libs/server/withSession";
import { createNotification } from "@libs/server/notification";

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseType>
) {
  const {
    query: { id = "" },
    session: { user },
  } = req;
  const postId = extractPostIdFromPath(id);
  if (Number.isNaN(postId)) {
    return res.status(400).json({ success: false, error: "유효하지 않은 게시글 ID입니다." });
  }

  const alreadyExists = await client.like.findFirst({
    where: {
      userId: user?.id,
      postId,
    },
    select: {
      id: true,
    },
  });
  if (alreadyExists) {
    await client.like.delete({
      where: {
        id: alreadyExists.id,
      },
    });
  } else {
    await client.like.create({
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
      },
    });

    // 좋아요 알림 생성 (게시글 작성자에게)
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
        type: "LIKE",
        userId: post.userId,
        senderId: user.id,
        message: `${senderUser.name}님이 회원님의 게시글에 좋아요를 눌렀습니다.`,
        targetId: postId,
        targetType: "post",
      });
    }
  }

  try {
    await res.revalidate("/community");
    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ success: false, error });
  }
}

export default withApiSession(
  withHandler({
    methods: ["POST"],
    handler,
    isPrivate: true,
  })
);
