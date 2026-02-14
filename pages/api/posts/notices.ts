import { NextApiRequest, NextApiResponse } from "next";
import withHandler, { ResponseType } from "@libs/server/withHandler";
import { withApiSession } from "@libs/server/withSession";
import client from "@libs/server/client";
import { Post, User } from "@prisma/client";

export interface NoticePost extends Post {
  user: Pick<User, "id" | "name" | "avatar">;
  _count: {
    comments: number;
    Likes: number;
  };
}

export interface NoticePostsResponse {
  success: boolean;
  posts: NoticePost[];
  pages: number;
}

const handler = async (
  req: NextApiRequest,
  res: NextApiResponse<ResponseType>
) => {
  const {
    query: { page = 1, take = 10 },
  } = req;

  const parsedPage = Number(page);
  const parsedTake = Number(take);
  const currentPage = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;
  const pageSize =
    Number.isFinite(parsedTake) && parsedTake > 0
      ? Math.min(parsedTake, 50)
      : 10;

  const where = {
    OR: [{ category: "공지" }, { title: { startsWith: "[공지]" } }],
  };

  const [posts, totalNoticeCount] = await Promise.all([
    client.post.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            avatar: true,
          },
        },
        _count: {
          select: {
            comments: true,
            Likes: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: pageSize,
      skip: (currentPage - 1) * pageSize,
    }),
    client.post.count({ where }),
  ]);

  return res.json({
    success: true,
    posts,
    pages: Math.ceil(totalNoticeCount / pageSize),
  });
};

export default withApiSession(
  withHandler({
    methods: ["GET"],
    isPrivate: false,
    handler,
  })
);
