import { NextApiRequest, NextApiResponse } from "next";
import withHandler, { ResponseType } from "@libs/server/withHandler";

import client from "@libs/server/client";
import { extractPostIdFromPath } from "@libs/post-route";
import { withApiSession } from "@libs/server/withSession";

interface PostDetail {
  user: {
    id: number;
    name: string;
    avatar: string | null;
  };
  comments: {
    id: number;
    user: {
      id: number;
      name: string;
      avatar: string | null;
    };
    comment: string;
    createdAt: Date;
  }[];
  _count: {
    comments: number;
    Likes: number;
  };
  id: number;
  createdAt: Date;
  updatedAt: Date;
  userId: number;
  title: string;
  description: string;
  category: string | null;
  image: string;
}

interface AdjacentNotice {
  id: number;
  title: string;
  createdAt: Date;
}

export interface PostDetailResponse {
  success: boolean;
  error?: string;
  post?: PostDetail;
  isLiked?: boolean;
  prevNotice?: AdjacentNotice | null;
  nextNotice?: AdjacentNotice | null;
}

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseType>
) {
  const {
    query: { id = "" },
    session: { user },
  } = req;
  const postId = extractPostIdFromPath(id);
  if (Number.isNaN(postId)) {
    return res.status(400).json({ success: false, error: "유효하지 않은 게시글 ID입니다." });
  }

  const post = await client.post.findUnique({
    where: {
      id: postId,
    },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          avatar: true,
        },
      },
      comments: {
        select: {
          comment: true,
          id: true,
          createdAt: true,
          user: {
            select: {
              id: true,
              name: true,
              avatar: true,
            },
          },
        },
        orderBy: { createdAt: "asc" },
      },
      _count: {
        select: {
          comments: true,
          Likes: true,
        },
      },
    },
  });

  if (!post) {
    return res.status(404).json({ success: false, error: "게시글을 찾을 수 없습니다." });
  }

  const isNoticePost =
    post.category === "공지" || String(post.title || "").startsWith("[공지]");

  const noticeWhere = {
    OR: [{ category: "공지" }, { title: { startsWith: "[공지]" } }],
  };

  const [prevNotice, nextNotice] = isNoticePost
    ? await Promise.all([
        client.post.findFirst({
          where: {
            AND: [
              noticeWhere,
              {
                OR: [
                  { createdAt: { gt: post.createdAt } },
                  {
                    AND: [
                      { createdAt: post.createdAt },
                      { id: { gt: post.id } },
                    ],
                  },
                ],
              },
            ],
          },
          select: {
            id: true,
            title: true,
            createdAt: true,
          },
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        }),
        client.post.findFirst({
          where: {
            AND: [
              noticeWhere,
              {
                OR: [
                  { createdAt: { lt: post.createdAt } },
                  {
                    AND: [
                      { createdAt: post.createdAt },
                      { id: { lt: post.id } },
                    ],
                  },
                ],
              },
            ],
          },
          select: {
            id: true,
            title: true,
            createdAt: true,
          },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        }),
      ])
    : [null, null];

  const isLiked = Boolean(
    await client.like.findFirst({
      where: {
        postId,
        userId: user?.id,
      },
      select: {
        id: true,
      },
    })
  );

  res.json({
    success: true,
    post,
    isLiked,
    prevNotice,
    nextNotice,
  });
}

export default withApiSession(
  withHandler({
    methods: ["GET"],
    handler,
    isPrivate: false,
  })
);
