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
  } = req;

  if (req.method === "GET") {
    const likes = await client.postLike.findMany({
      where: {
        userId: Number(id),
      },
      include: {
        post: {
          include: {
            author: {
              select: {
                id: true,
                name: true,
                avatar: true,
              },
            },
            category: {
              select: {
                id: true,
                name: true,
              },
            },
            _count: {
              select: {
                comments: true,
                likes: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return res.json({
      success: true,
      posts: likes.map((like) => like.post),
    });
  }
}

export default withApiSession(
  withHandler({
    methods: ["GET"],
    isPrivate: false,
    handler,
  })
); 