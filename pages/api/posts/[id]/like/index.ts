import { NextApiRequest, NextApiResponse } from "next";
import withHandler, { ResponseType } from "@libs/server/withHandler";
import client from "@libs/server/client";
import { withApiSession } from "@libs/server/withSession";

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseType>
) {
  const {
    query: { id },
    session: { user },
  } = req;

  if (!user) {
    return res.status(401).json({
      success: false,
      error: "로그인이 필요합니다.",
    });
  }

  const post = await client.post.findUnique({
    where: {
      id: Number(id),
    },
  });

  if (!post) {
    return res.status(404).json({
      success: false,
      error: "게시물을 찾을 수 없습니다.",
    });
  }

  const like = await client.like.findFirst({
    where: {
      postId: post.id,
      userId: user.id,
    },
  });

  if (like) {
    await client.like.delete({
      where: {
        id: like.id,
      },
    });
    return res.json({
      success: true,
      message: "좋아요가 취소되었습니다.",
    });
  } else {
    await client.like.create({
      data: {
        post: {
          connect: {
            id: post.id,
          },
        },
        user: {
          connect: {
            id: user.id,
          },
        },
      },
    });
    return res.json({
      success: true,
      message: "좋아요가 추가되었습니다.",
    });
  }
}

export default withApiSession(
  withHandler({
    methods: ["POST"],
    isPrivate: true,
    handler,
  })
); 