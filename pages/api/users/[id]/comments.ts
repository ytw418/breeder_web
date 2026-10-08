import { NextApiRequest, NextApiResponse } from "next";
import withHandler, { ResponseType } from "@libs/server/withHandler";
import client from "@libs/server/client";
import { withAuth } from "@libs/server/auth";
import { isModeratorUser } from "@libs/server/adminAccess";
import { displayUserName } from "@libs/shared/deletedUser";

export interface UserCommentsQuery {
  id?: string | string[];
  page?: string | string[];
  size?: string | string[];
  order?: string | string[];
}

export interface UserCommentListResponse {
  success: boolean;
  comments: {
    id: number;
    comment: string;
    createdAt: Date;
    /** 운영자 숨김. 본인·관리자에게만 내려온다. */
    isHidden: boolean;
    /** 답글이면 루트 댓글 id */
    parentId: number | null;
    /** 답글이면 답글을 단 댓글의 작성자('OO님에게 답글'). 그 댓글이 없어졌으면 null */
    replyTo: { name: string } | null;
    post: {
      id: number;
      title: string;
      image: string;
      category: string | null;
    };
  }[];
  pages: number;
}

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseType | UserCommentListResponse>
) {
  if (req.method !== "GET") return;

  const {
    query: { id = "", page = 1, size = 20, order = "desc" },
  } = req as { query: UserCommentsQuery };

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

  // 숨긴 댓글·숨긴 글의 댓글은 작성자 본인과 관리자에게만 보인다.
  const canSeeHidden = req.user?.id === userId || isModeratorUser(req.user);
  // '삭제된 댓글' 자리(답글이 남은 루트)는 프로필 목록에서 뺀다.
  const where = canSeeHidden
    ? { userId, deletedAt: null }
    : { userId, deletedAt: null, isHidden: false, post: { isHidden: false } };

  const [comments, commentCount] = await Promise.all([
    client.comment.findMany({
      where,
      select: {
        id: true,
        comment: true,
        createdAt: true,
        isHidden: true,
        parentId: true,
        post: {
          select: {
            id: true,
            title: true,
            image: true,
            category: true,
          },
        },
      },
      orderBy: {
        createdAt: order as "asc" | "desc",
      },
      take: pageSize,
      skip: (pageNumber - 1) * pageSize,
    }),
    client.comment.count({ where }),
  ]);

  // 답글이면 루트 댓글 작성자 이름을 붙인다(한 번에 조회).
  // Set 펼치기(...)는 이 저장소의 컴파일 대상(es5)에서 빈 배열이 되므로 Array.from 을 쓴다.
  const parentIds = Array.from(
    new Set(comments.flatMap((comment) => (comment.parentId != null ? [comment.parentId] : [])))
  );
  const parents = parentIds.length
    ? await client.comment.findMany({
        where: { id: { in: parentIds } },
        select: { id: true, user: { select: { name: true } } },
      })
    : [];
  const parentNameById = new Map(
    parents.map((parent) => [parent.id, displayUserName(parent.user?.name)])
  );

  return res.json({
    success: true,
    comments: comments.map((comment) => ({
      ...comment,
      replyTo:
        comment.parentId != null && parentNameById.has(comment.parentId)
          ? { name: parentNameById.get(comment.parentId) as string }
          : null,
    })),
    pages: Math.ceil(commentCount / pageSize),
  });
}

export default withAuth(
  withHandler({
    methods: ["GET"],
    handler,
    isPrivate: false,
  })
);
