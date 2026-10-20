import { NextApiRequest, NextApiResponse } from "next";
import withHandler, { ResponseType } from "@libs/server/withHandler";
import { withAuth } from "@libs/server/auth";
import client from "@libs/server/client";
import { withPostImages } from "@libs/postImages";
import { Post, User } from "@prisma/client";
import { NOTICE_BAND_WINDOW_MS } from "@libs/shared/noticeBand";

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

  // 홈 공지 띠(?band=1): 14일 안에 올린 공지만(libs/shared/noticeBand.ts). 오래된 베타 공지가 첫 줄에 남지 않게.
  const band = req.query.band === "1";
  const where = {
    isHidden: false,
    OR: [{ category: "공지" }, { title: { startsWith: "[공지]" } }],
    ...(band ? { createdAt: { gte: new Date(Date.now() - NOTICE_BAND_WINDOW_MS) } } : {}),
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
    posts: posts.map(withPostImages),
    pages: Math.ceil(totalNoticeCount / pageSize),
  });
};

export default withAuth(
  withHandler({
    methods: ["GET"],
    isPrivate: false,
    handler,
  })
);
