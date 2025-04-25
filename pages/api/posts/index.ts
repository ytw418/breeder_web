import { NextApiRequest, NextApiResponse } from "next";
import withHandler, { ResponseType } from "@libs/server/withHandler";
import client from "@libs/server/client";
import { withApiSession } from "@libs/server/withSession";

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseType>
) {
  if (req.method === "GET") {
    const {
      query: { cursor, limit = 10, category, author, search },
    } = req;

    const posts = await client.post.findMany({
      take: Number(limit) + 1,
      ...(cursor && {
        cursor: {
          id: Number(cursor),
        },
        skip: 1,
      }),
      where: {
        ...(category && category !== "all" ? {
          category: {
            name: category as string
          }
        } : {}),
        ...(author ? {
          authorId: Number(author)
        } : {}),
        ...(search ? {
          OR: [
            { title: { contains: search as string, mode: "insensitive" } },
            { content: { contains: search as string, mode: "insensitive" } },
          ],
        } : {}),
      },
      orderBy: {
        createdAt: "desc",
      },
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
    });

    const hasMore = posts.length > Number(limit);
    const nextCursor = hasMore ? posts[posts.length - 1].id : null;
    const filteredPosts = hasMore ? posts.slice(0, -1) : posts;

    return res.json({
      success: true,
      posts: filteredPosts,
      nextCursor,
    });
  }

  if (req.method === "POST") {
    const {
      body: { title, content, category = "all" },
      session: { user },
    } = req;

    if (!user) {
      return res.status(401).json({
        success: false,
        error: "인증되지 않은 요청입니다.",
      });
    }

    if (!title || !content) {
      return res.status(400).json({
        success: false,
        error: "제목과 내용은 필수입니다.",
      });
    }

    const post = await client.post.create({
      data: {
        title,
        content,
        author: {
          connect: {
            id: user.id,
          },
        },
        category: {
          connect: {
            name: category,
          },
        },
      },
    });

    return res.json({
      success: true,
      post: {
        id: post.id,
      },
    });
  }
}

export default withApiSession(
  withHandler({
    methods: ["GET", "POST"],
    isPrivate: false,
    handler,
  })
);

