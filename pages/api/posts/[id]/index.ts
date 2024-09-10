import { NextApiRequest, NextApiResponse } from "next";
import withHandler, { ResponseType } from "@libs/server/withHandler";

import client from "@libs/server/client";
import { withApiSession } from "@libs/server/withSession";
import { Comment, Post, User, Prisma } from "@prisma/client";

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
  type: string | null;
  latitude: number | null;
  longitude: number | null;
  image: string;
}

export interface PostDetailResponse {
  success: boolean;
  error?: string;
  post?: PostDetail;
  isLiked?: boolean;
}

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseType>
) {
  const {
    query: { id = "" },
    session: { user },
  } = req;
  const post = await client.post.findUnique({
    where: {
      id: +id.toString(),
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
        take: 10,
        skip: 20,
      },

      _count: {
        select: {
          comments: true,
          Likes: true,
        },
      },
    },
  });

  post;

  const isLike = Boolean(
    await client.like.findFirst({
      where: {
        postId: +id.toString(),
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
    isLike,
  });
}

export default withApiSession(
  withHandler({
    methods: ["GET"],
    handler,
    isPrivate: false,
  })
);

type post = null | {
  user: unknown;
  comments: unknown;
  _count: unknown;
  id: number;
  createdAt: Date;
  updatedAt: Date;
  userId: number;
  title: string;
  description: string;
  type: null | string;
  latitude: null | number;
  longitude: null | number;
  image: string;
};
