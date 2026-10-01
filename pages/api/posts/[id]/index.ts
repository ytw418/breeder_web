import { NextApiRequest, NextApiResponse } from "next";
import withHandler, { ResponseType } from "@libs/server/withHandler";

import client from "@libs/server/client";
import { extractPostIdFromPath } from "@libs/post-route";
import { withAuth } from "@libs/server/auth";
import {
  breederProgramSummarySelect,
  getSortedActiveBreederProgramSummaries,
} from "@libs/server/breeder-programs";
import type { BreederProgramSummary } from "@libs/shared/breeder-program";
import { resolvePostImagesInput, withPostImages } from "@libs/postImages";
import {
  NOTICE_POST_CATEGORY,
  canWriteNoticePost,
} from "@libs/server/postNotice";
import type { Post } from "@prisma/client";

interface PostDetail {
  user: {
    id: number;
    name: string;
    avatar: string | null;
    breederPrograms: BreederProgramSummary[];
  };
  comments: {
    id: number;
    user: {
      id: number;
      name: string;
      avatar: string | null;
      breederPrograms: BreederProgramSummary[];
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
  /** 게시글 사진 id 목록. 구 데이터는 [image] 로 채운다. */
  images: string[];
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

/** 게시글 수정(action=update) 성공 응답. 실패는 { success:false, error, message, errorCode }. */
export interface PostUpdateResponse {
  success: true;
  post: Post & { images: string[] };
}

const INVALID_POST_ID_MESSAGE = "유효하지 않은 게시글 ID입니다.";

function sendPostError(
  res: NextApiResponse<ResponseType>,
  status: number,
  errorCode: string,
  message: string
) {
  return res.status(status).json({
    success: false,
    error: message,
    message,
    errorCode,
  });
}

const trimmedText = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";

/** POST /api/posts/:id — 작성자 본인의 게시글 수정(update)·삭제(delete) */
async function mutatePost(
  req: NextApiRequest,
  res: NextApiResponse<ResponseType>
) {
  const {
    query: { id = "" },
    user,
  } = req;

  if (!user?.id) {
    return sendPostError(res, 401, "POST_AUTH_REQUIRED", "로그인이 필요합니다.");
  }

  const postId = extractPostIdFromPath(id);
  if (Number.isNaN(postId)) {
    return sendPostError(res, 400, "POST_INVALID_ID", INVALID_POST_ID_MESSAGE);
  }

  const post = await client.post.findUnique({
    where: { id: postId },
    select: { id: true, userId: true },
  });
  if (!post) {
    return sendPostError(res, 404, "POST_NOT_FOUND", "게시글을 찾을 수 없습니다.");
  }
  if (post.userId !== user.id) {
    return sendPostError(
      res,
      403,
      "POST_FORBIDDEN",
      "본인 게시글만 수정·삭제할 수 있습니다."
    );
  }

  const { action } = req.body ?? {};

  if (action === "delete") {
    // Comment/Like 는 onDelete: Cascade. 알림은 정리하지 않는다(상품 삭제와 동일).
    await client.post.delete({ where: { id: postId } });
    return res.json({ success: true });
  }

  if (action !== "update") {
    return sendPostError(res, 400, "POST_INVALID_ACTION", "지원하지 않는 요청입니다.");
  }

  const { image, images, category, species } = req.body;
  const title = trimmedText(req.body.title);
  const description = trimmedText(req.body.description);
  if (!title) {
    return sendPostError(res, 400, "POST_TITLE_REQUIRED", "제목을 입력해주세요.");
  }
  if (!description) {
    return sendPostError(
      res,
      400,
      "POST_DESCRIPTION_REQUIRED",
      "내용을 입력해주세요."
    );
  }

  const resolvedImages = resolvePostImagesInput({ image, images });
  if (!resolvedImages.ok) {
    return sendPostError(
      res,
      400,
      resolvedImages.errorCode,
      resolvedImages.message
    );
  }

  if (
    String(category) === NOTICE_POST_CATEGORY &&
    !(await canWriteNoticePost(user.id))
  ) {
    return sendPostError(
      res,
      403,
      "POST_NOTICE_FORBIDDEN",
      "공지 작성 권한이 없습니다."
    );
  }

  // 저장 규칙은 작성(POST /api/posts)과 동일하다.
  const updatedPost = await client.post.update({
    where: { id: postId },
    data: {
      title,
      description,
      category: category || null,
      type: species || null,
      image: resolvedImages.image,
      images: resolvedImages.images,
    },
  });

  return res.json({ success: true, post: withPostImages(updatedPost) });
}

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseType>
) {
  if (req.method === "POST") {
    return mutatePost(req, res);
  }
  return getPostDetail(req, res);
}

async function getPostDetail(
  req: NextApiRequest,
  res: NextApiResponse<ResponseType>
) {
  const {
    query: { id = "" },
    user,
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
          breederPrograms: {
            where: { status: "ACTIVE" as const },
            select: breederProgramSummarySelect,
          },
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
              breederPrograms: {
                where: { status: "ACTIVE" as const },
                select: breederProgramSummarySelect,
              },
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

  // 비로그인이면 조회하지 않는다. userId: undefined 는 Prisma 가 조건을 무시해
  // 다른 사람의 좋아요가 잡힌다(#139).
  const isLiked = user?.id
    ? Boolean(
        await client.like.findFirst({
          where: {
            postId,
            userId: user.id,
          },
          select: {
            id: true,
          },
        })
      )
    : false;

  const serializedPost: PostDetail = {
    ...withPostImages(post),
    user: {
      ...post.user,
      breederPrograms: getSortedActiveBreederProgramSummaries(
        post.user.breederPrograms
      ),
    },
    comments: post.comments.map((comment) => ({
      ...comment,
      user: {
        ...comment.user,
        breederPrograms: getSortedActiveBreederProgramSummaries(
          comment.user.breederPrograms
        ),
      },
    })),
  };

  res.json({
    success: true,
    post: serializedPost,
    isLiked,
    prevNotice,
    nextNotice,
  });
}

export default withAuth(
  withHandler({
    methods: ["GET", "POST"],
    handler,
    isPrivate: false,
  })
);
