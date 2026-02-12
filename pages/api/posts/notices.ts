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
}

const handler = async (
  req: NextApiRequest,
  res: NextApiResponse<ResponseType>
) => {
  const posts = await client.post.findMany({
    where: {
      OR: [{ category: "공지" }, { title: { startsWith: "[공지]" } }],
    },
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
    take: 5,
  });

  return res.json({
    success: true,
    posts,
  });
};

export default withApiSession(
  withHandler({
    methods: ["GET"],
    isPrivate: false,
    handler,
  })
);
