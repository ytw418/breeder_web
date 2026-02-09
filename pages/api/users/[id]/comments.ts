import { NextApiRequest, NextApiResponse } from "next";
import withHandler, { ResponseType } from "@libs/server/withHandler";
import client from "@libs/server/client";
import { withApiSession } from "@libs/server/withSession";

export interface UserCommentsQuery {
  id?: string | string[];
  page?: string | string[];
  size?: string | string[];
  order?: string | string[];
}

export interface UserCommentListResponse {
  success: boolean;
  comments: {
    id: number;
    comment: string;
    createdAt: Date;
    post: {
      id: number;
      title: string;
      image: string;
      category: string | null;
    };
  }[];
  pages: number;
}

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseType | UserCommentListResponse>
) {
  if (req.method !== "GET") return;

  const {
    query: { id = "", page = 1, size = 20, order = "desc" },
  } = req as { query: UserCommentsQuery };

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

  const where = { userId };

  const [comments, commentCount] = await Promise.all([
    client.comment.findMany({
      where,
      select: {
        id: true,
        comment: true,
        createdAt: true,
        post: {
          select: {
            id: true,
            title: true,
            image: true,
            category: true,
          },
        },
      },
      orderBy: {
        createdAt: order as "asc" | "desc",
      },
      take: pageSize,
      skip: (pageNumber - 1) * pageSize,
    }),
    client.comment.count({ where }),
  ]);

  return res.json({
    success: true,
    comments,
    pages: Math.ceil(commentCount / pageSize),
  });
}

export default withApiSession(
  withHandler({
    methods: ["GET"],
    handler,
    isPrivate: false,
  })
);
