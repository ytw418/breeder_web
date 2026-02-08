import { NextApiRequest, NextApiResponse } from "next";
import withHandler, { ResponseType } from "@libs/server/withHandler";

import client from "@libs/server/client";
import { withApiSession } from "@libs/server/withSession";
import { notifyFollowers } from "@libs/server/notification";
import { Post, User } from "@prisma/client";

/** 게시글 목록 응답 타입 */
export interface PostWithUser extends Post {
  user: Pick<User, "id" | "name" | "avatar">;
  _count: {
    comments: number;
    Likes: number;
  };
}

export interface PostsListResponse {
  success: boolean;
  posts: PostWithUser[];
  pages: number;
}

const handler = async (
  req: NextApiRequest,
  res: NextApiResponse<ResponseType>
) => {
  if (req.method === "GET") {
    const {
      query: { page = 1, category },
    } = req;

    // 카테고리 필터링 조건
    const where = category && category !== "전체" ? { category: String(category) } : {};

    const [posts, postCount] = await Promise.all([
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
        take: 10,
        skip: page ? (+page - 1) * 10 : 0,
      }),
      client.post.count({ where }),
    ]);

    res.json({
      success: true,
      posts,
      pages: Math.ceil(postCount / 10),
    });
  }

  if (req.method === "POST") {
    const {
      body: { description, title, image, category },
      session: { user },
    } = req;

    const post = await client.post.create({
      data: {
        title,
        image: image || "",
        description,
        category: category || null,
        user: {
          connect: {
            id: user?.id,
          },
        },
      },
    });

    // 팔로워들에게 새 게시글 등록 알림
    const author = user?.id
      ? await client.user.findUnique({
          where: { id: user.id },
          select: { name: true },
        })
      : null;

    if (author && user?.id) {
      notifyFollowers({
        senderId: user.id,
        type: "NEW_POST",
        message: `${author.name}님이 새 글을 작성했습니다: ${title}`,
        targetId: post.id,
        targetType: "post",
      });
    }

    return res.json({ success: true, post });
  }
};

export default withApiSession(
  withHandler({ methods: ["POST", "GET"], isPrivate: false, handler })
);
