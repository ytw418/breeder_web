import { NextApiRequest, NextApiResponse } from "next";
import withHandler, { ResponseType } from "@libs/server/withHandler";

import client from "@libs/server/client";
import { withApiSession } from "@libs/server/withSession";
import { notifyFollowers } from "@libs/server/notification";
import { Post, User } from "@prisma/client";
import { getCategoryFilterValues } from "@libs/categoryTaxonomy";

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
      query: { page = 1, category, sort, species },
    } = req;
    const selectedSort =
      typeof sort === "string" && ["latest", "popular", "comments"].includes(sort)
        ? sort
        : "latest";

    // 기본 피드에서는 공지 카테고리 제외
    const where: any = { NOT: { category: "공지" } };
    if (category && category !== "전체") {
      where.category = String(category);
      if (String(category) === "공지") {
        delete where.NOT;
      }
    }

    if (species && species !== "전체") {
      where.type = { in: getCategoryFilterValues(String(species)) };
    }

    const pageNumber = Number(page);
    const normalizedPage = Number.isInteger(pageNumber) && pageNumber > 0 ? pageNumber : 1;
    const skip = (normalizedPage - 1) * 10;

    const basePostQuery = {
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
      orderBy: { createdAt: "desc" as const },
    };

    const [allPosts, postCount] = await Promise.all([
      client.post.findMany(basePostQuery),
      client.post.count({ where }),
    ]);

    const sortedPosts =
      selectedSort === "latest"
        ? allPosts
        : allPosts.sort((a, b) => {
            if (selectedSort === "popular") {
              const likeDiff = b._count.Likes - a._count.Likes;
              if (likeDiff !== 0) return likeDiff;
            }
            if (selectedSort === "comments") {
              const commentDiff = b._count.comments - a._count.comments;
              if (commentDiff !== 0) return commentDiff;
            }
            return b.createdAt.getTime() - a.createdAt.getTime();
          });

    const posts = sortedPosts.slice(skip, skip + 10);

    res.json({
      success: true,
      posts,
      pages: Math.ceil(postCount / 10),
    });
  }

  if (req.method === "POST") {
    const {
      body: { description, title, image, category, species },
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
        type: species || null,
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
