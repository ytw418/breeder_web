import { NextApiRequest, NextApiResponse } from "next";
import withHandler, { ResponseType } from "@libs/server/withHandler";

import client from "@libs/server/client";
import { extractPostIdFromPath } from "@libs/post-route";
import { withAuth } from "@libs/server/auth";
import { createNotification } from "@libs/server/notification";

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseType>
) {
  const {
    query: { id = "" },
    user,
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
    // 알림은 부가 작업이므로 실패해도 좋아요 성공 응답에 영향을 주지 않는다.
    try {
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
    } catch (error) {
      console.error("posts.wonder.notification.error", error);
    }
  }

  // 게시글 목록(/posts)은 클라이언트에서 SWR로 불러오므로 정적 재검증이 필요 없다.
  // (이전 코드는 존재하지 않는 /community 경로를 재검증하다 실패해 500을 반환했다.)
  return res.json({ success: true, isLiked: !alreadyExists });
}

export default withAuth(
  withHandler({
    methods: ["POST"],
    handler,
    isPrivate: true,
  })
);
