import { NextApiRequest, NextApiResponse } from "next";
import withHandler, { ResponseType } from "@libs/server/withHandler";
import client from "@libs/server/client";
import { withAuth } from "@libs/server/auth";
import { isModeratorUser } from "@libs/server/adminAccess";
import { withPostImages } from "@libs/postImages";
import { photoPostWhere } from "@libs/server/profileSpecies";
import type { Prisma } from "@prisma/client";

export interface UserPostsQuery {
  id?: string | string[];
  page?: string | string[];
  size?: string | string[];
  order?: string | string[];
  /** "photo" 면 사진 있는 글만, 프로필 고정 글을 먼저 준다(앱 프로필 '사진' 탭). */
  media?: string | string[];
  /** 종(Post.type)으로 거른다(앱 종별 앨범). */
  species?: string | string[];
}

export interface UserPostListResponse {
  success: boolean;
  posts: {
    id: number;
    title: string;
    description: string;
    image: string;
    images: string[];
    category: string | null;
    type: string | null;
    createdAt: Date;
    profilePinnedAt: Date | null;
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
    query: { id = "", page = 1, size = 20, order = "desc", media, species },
  } = req as { query: UserPostsQuery };
  const viewer = req.user;

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

  // 운영자가 숨긴 글은 작성자 본인과 관리자에게만 보인다.
  const canSeeHidden = viewer?.id === userId || isModeratorUser(viewer);
  const photoOnly = media === "photo";
  const speciesFilter = typeof species === "string" ? species.trim() : "";
  const where: Prisma.PostWhereInput = {
    ...(photoOnly
      ? photoPostWhere(userId, canSeeHidden)
      : {
          userId,
          NOT: { category: "공지" },
          ...(canSeeHidden ? {} : { isHidden: false }),
        }),
    ...(speciesFilter ? { type: speciesFilter } : {}),
  };
  // 사진 탭은 고정 글(최대 3개)이 늘 첫 페이지 맨 앞에 온다. Postgres DESC 는 NULL 이 먼저라 nulls:last 가 필요하다.
  const orderBy: Prisma.PostOrderByWithRelationInput[] = photoOnly
    ? [
        { profilePinnedAt: { sort: "desc", nulls: "last" } },
        { createdAt: "desc" },
        { id: "desc" },
      ]
    : [{ createdAt: order as "asc" | "desc" }];

  const [posts, postCount] = await Promise.all([
    client.post.findMany({
      where,
      select: {
        id: true,
        title: true,
        description: true,
        image: true,
        images: true,
        category: true,
        type: true,
        createdAt: true,
        profilePinnedAt: true,
        isHidden: true,
        _count: {
          select: {
            comments: true,
            Likes: true,
          },
        },
      },
      orderBy,
      take: pageSize,
      skip: (pageNumber - 1) * pageSize,
    }),
    client.post.count({ where }),
  ]);

  return res.json({
    success: true,
    posts: posts.map(withPostImages),
    pages: Math.ceil(postCount / pageSize),
  });
}

export default withAuth(
  withHandler({
    methods: ["GET"],
    handler,
    isPrivate: false,
  })
);
