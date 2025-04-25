import { NextApiRequest, NextApiResponse } from "next";
import withHandler, { ResponseType } from "@libs/server/withHandler";
import client from "@libs/server/client";
import { withApiSession } from "@libs/server/withSession";
import { uploadImage } from "@libs/server/utils";

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
    query: { id },
    session: { user },
  } = req;

  if (req.method === "GET") {
    const post = await client.post.findUnique({
      where: {
        id: Number(id),
      },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            avatar: true,
          },
        },
        category: {
          select: {
            id: true,
            name: true,
          },
        },
        comments: {
          include: {
            author: {
              select: {
                id: true,
                name: true,
                avatar: true,
              },
            },
          },
          orderBy: {
            createdAt: "desc",
          },
        },
        _count: {
          select: {
            comments: true,
            likes: true,
          },
        },
      },
    });

    if (!post) {
      return res.status(404).json({
        success: false,
        error: "게시글이 존재하지 않습니다.",
      });
    }

    const isLiked = user?.id
      ? Boolean(
          await client.postLike.findFirst({
            where: {
              postId: post.id,
              userId: user.id,
            },
          })
        )
      : false;

    return res.json({
      success: true,
      post: {
        ...post,
        isLiked,
      },
    });
  }

  if (req.method === "PUT") {
    if (!user) {
      return res.status(401).json({
        success: false,
        error: "인증되지 않은 요청입니다.",
      });
    }

    const post = await client.post.findUnique({
      where: {
        id: Number(id),
      },
    });

    if (!post) {
      return res.status(404).json({
        success: false,
        error: "게시글이 존재하지 않습니다.",
      });
    }

    if (post.authorId !== user.id) {
      return res.status(403).json({
        success: false,
        error: "권한이 없습니다.",
      });
    }

    const {
      body: { title, content },
    } = req;

    if (!title || !content) {
      return res.status(400).json({
        success: false,
        error: "제목과 내용은 필수입니다.",
      });
    }

    const updatedPost = await client.post.update({
      where: {
        id: Number(id),
      },
      data: {
        title,
        content,
      },
    });

    return res.json({
      success: true,
      post: updatedPost,
    });
  }

  if (req.method === "DELETE") {
    if (!user) {
      return res.status(401).json({
        success: false,
        error: "인증되지 않은 요청입니다.",
      });
    }

    const post = await client.post.findUnique({
      where: {
        id: Number(id),
      },
    });

    if (!post) {
      return res.status(404).json({
        success: false,
        error: "게시글이 존재하지 않습니다.",
      });
    }

    if (post.authorId !== user.id) {
      return res.status(403).json({
        success: false,
        error: "권한이 없습니다.",
      });
    }

    await client.post.delete({
      where: {
        id: Number(id),
      },
    });

    return res.json({
      success: true,
    });
  }
}

export default withApiSession(
  withHandler({
    methods: ["GET", "PUT", "DELETE"],
    isPrivate: false,
    handler,
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
