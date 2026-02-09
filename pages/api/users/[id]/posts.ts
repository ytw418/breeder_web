import { NextApiRequest, NextApiResponse } from "next";
import withHandler, { ResponseType } from "@libs/server/withHandler";
import client from "@libs/server/client";
import { withApiSession } from "@libs/server/withSession";

export interface UserPostsQuery {
  id?: string | string[];
  page?: string | string[];
  size?: string | string[];
  order?: string | string[];
}

export interface UserPostListResponse {
  success: boolean;
  posts: {
    id: number;
    title: string;
    description: string;
    image: string;
    category: string | null;
    createdAt: Date;
    _count: {
      comments: number;
      Likes: number;
    };
  }[];
  pages: number;
}

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseType | UserPostListResponse>
) {
  if (req.method !== "GET") return;

  const {
    query: { id = "", page = 1, size = 20, order = "desc" },
  } = req as { query: UserPostsQuery };

  if (!id) {
    return res.status(400).json({
      success: false,
      message: "사용자 ID가 필요합니다.",
    });
  }

  if (order !== "asc" && order !== "desc") {
    return res.status(400).json({
      success: false,
      message: "정렬 순서는 'asc' 또는 'desc'만 가능합니다.",
    });
  }

  const pageSize = Math.min(Math.max(1, +size), 50);
  const userId = +id.toString();
  const pageNumber = Math.max(1, +page);

  const where = {
    userId,
    NOT: { category: "공지" as const },
  };

  const [posts, postCount] = await Promise.all([
    client.post.findMany({
      where,
      select: {
        id: true,
        title: true,
        description: true,
        image: true,
        category: true,
        createdAt: true,
        _count: {
          select: {
            comments: true,
            Likes: true,
          },
        },
      },
      orderBy: {
        createdAt: order as "asc" | "desc",
      },
      take: pageSize,
      skip: (pageNumber - 1) * pageSize,
    }),
    client.post.count({ where }),
  ]);

  return res.json({
    success: true,
    posts,
    pages: Math.ceil(postCount / pageSize),
  });
}

export default withApiSession(
  withHandler({
    methods: ["GET"],
    handler,
    isPrivate: false,
  })
);
