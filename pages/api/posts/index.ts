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

    // 기본 피드에서는 공지 카테고리 제외
    const where: any = { NOT: { category: "공지" } };
    if (category && category !== "전체") {
      where.category = String(category);
      if (String(category) === "공지") {
        delete where.NOT;
      }
    }

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

    if (String(category) === "공지") {
      const dbUser = user?.id
        ? await client.user.findUnique({
            where: { id: user.id },
            select: { role: true },
          })
        : null;

      if (!dbUser || !["ADMIN", "SUPER_USER"].includes(dbUser.role)) {
        return res
          .status(403)
          .json({ success: false, error: "공지 작성 권한이 없습니다." });
      }
    }

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
