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
import { validatePostDescription } from "@libs/shared/post-body";
import { canWriteNoticePost, isNoticePostInput } from "@libs/server/postNotice";
import { commentVisibilityWhere } from "@libs/server/comments";
import { canEditAnyContent, isModeratorUser } from "@libs/server/adminAccess";
import { Prisma, type Post } from "@prisma/client";
import { resolveCategoryIdByName } from "@libs/server/categories";
import { DELETED_COMMENT_TEXT } from "@libs/shared/comment";
import { getDebateSummaries, notifyDebateResult } from "@libs/server/debate";
import {
  DEBATE_CATEGORY,
  validateDebateInput,
  type DebateSide,
  type DebateSummary,
} from "@libs/shared/debateFormat";
import { BLOCKED_WORD_MESSAGE, hasBlockedWord } from "@libs/shared/contentFilter";

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
    /** 운영자 숨김. 작성자·관리자에게만 내려온다. */
    isHidden: boolean;
    /** 대댓글이면 루트 댓글 id. 목록은 작성순 flat 이고 클라이언트가 groupCommentThreads 로 묶는다. */
    parentId: number | null;
    /** 작성자가 고친 시각('수정됨' 표시) */
    editedAt: Date | null;
    /** 답글이 남아 '삭제된 댓글' 자리로 남은 루트. comment 는 DELETED_COMMENT_TEXT 로 내려간다. */
    deletedAt: Date | null;
    /** 댓글 좋아요 수 */
    likeCount: number;
    /** viewer 가 좋아요했는지(비로그인 false) */
    isLiked: boolean;
    /** 토론 댓글이면 쓴 순간의 쪽(앱 docs/prd/live-talk.md) */
    stance: DebateSide | null;
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
  /** 관심 생물군(작성 화면 species). 수정 화면 초기값에 쓴다. */
  type: string | null;
  image: string;
  /** 게시글 사진 id 목록. 구 데이터는 [image] 로 채운다. */
  images: string[];
  /** 운영자 숨김. 작성자·관리자만 숨긴 글을 받는다. */
  isHidden: boolean;
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
/** Post.id 는 Int(32bit). 범위를 넘거나 정수가 아니면 Prisma 가 500 을 낸다. */
const MAX_POST_ID = 2_147_483_647;
const NOT_FOUND_MESSAGE = "게시글을 찾을 수 없습니다.";

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
  if (!Number.isInteger(postId) || postId <= 0 || postId > MAX_POST_ID) {
    return sendPostError(res, 400, "POST_INVALID_ID", INVALID_POST_ID_MESSAGE);
  }

  const post = await client.post.findUnique({
    where: { id: postId },
    select: {
      id: true,
      userId: true,
      image: true,
      images: true,
      category: true,
      title: true,
      debate: { select: { optionA: true, optionB: true, endsAt: true, firstOtherVoteAt: true } },
    },
  });
  if (!post) {
    return sendPostError(res, 404, "POST_NOT_FOUND", NOT_FOUND_MESSAGE);
  }
  const { action } = req.body ?? {};

  // 관리자는 남의 글을 고칠 수만 있다. 삭제는 사유를 남기는 관리자 숨김·삭제(/api/admin/moderation)로 한다.
  // 운영자 이메일(ytw418…) 계정은 남의 글도 본인 글처럼 수정·삭제한다(canEditAnyContent).
  const canEditAsAdmin = action === "update" && isModeratorUser(user);
  if (post.userId !== user.id && !canEditAnyContent(user) && !canEditAsAdmin) {
    return sendPostError(
      res,
      403,
      "POST_FORBIDDEN",
      "본인 게시글만 수정·삭제할 수 있습니다."
    );
  }

  if (action === "delete") {
    // Comment/Like 는 onDelete: Cascade. 알림은 정리하지 않는다(상품 삭제와 동일).
    try {
      await client.post.delete({ where: { id: postId } });
    } catch (error) {
      // 동시에 들어온 다른 삭제 요청이 먼저 지운 경우
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2025"
      ) {
        return sendPostError(res, 404, "POST_NOT_FOUND", NOT_FOUND_MESSAGE);
      }
      throw error;
    }
    return res.json({ success: true });
  }

  if (action !== "update") {
    return sendPostError(res, 400, "POST_INVALID_ACTION", "지원하지 않는 요청입니다.");
  }

  // 찬반 토론 수정(앱 docs/prd/live-talk.md §3.7): 남이 처음 투표하기 전엔 질문·선택지·설명, 그 뒤엔 설명만. 기간·카테고리는 그대로.
  if (post.category === DEBATE_CATEGORY && post.debate) {
    const locked = post.debate.firstOtherVoteAt != null;
    const nextTitle = locked ? post.title : trimmedText(req.body.title) || post.title;
    const nextA = locked ? post.debate.optionA : trimmedText(req.body.debate?.optionA) || post.debate.optionA;
    const nextB = locked ? post.debate.optionB : trimmedText(req.body.debate?.optionB) || post.debate.optionB;
    const nextDescription = typeof req.body.description === "string" ? req.body.description.trim() : "";
    const checked = validateDebateInput({
      title: nextTitle,
      optionA: nextA,
      optionB: nextB,
      durationHours: 72,
      description: nextDescription,
    });
    if (!checked.ok) return sendPostError(res, 400, checked.errorCode, checked.message);
    if ([nextTitle, nextA, nextB, nextDescription].some((text) => hasBlockedWord(text))) {
      return sendPostError(res, 400, "BLOCKED_WORD", BLOCKED_WORD_MESSAGE);
    }
    const updatedDebatePost = await client.post.update({
      where: { id: postId },
      data: {
        title: nextTitle,
        description: nextDescription,
        ...(locked ? {} : { debate: { update: { optionA: nextA, optionB: nextB } } }),
      },
    });
    return res.json({ success: true, post: withPostImages(updatedDebatePost), locked });
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

  // 사진 필드를 아예 보내지 않으면 기존 사진을 그대로 둔다(글만 고치는 요청이 사진을 지우지 않게).
  const keepImages = image === undefined && images === undefined;
  const resolvedImages = keepImages
    ? null
    : resolvePostImagesInput({ image, images });
  if (resolvedImages && !resolvedImages.ok) {
    return sendPostError(
      res,
      400,
      resolvedImages.errorCode,
      resolvedImages.message
    );
  }

  // 본문 검사는 작성과 같다. 사진을 그대로 두는 요청은 저장된 사진 수로 자리 표시 번호를 본다.
  const imageCount = resolvedImages
    ? resolvedImages.images.length
    : (post.images ?? []).length || (post.image ? 1 : 0);
  const bodyCheck = validatePostDescription(description, imageCount);
  if (!bodyCheck.ok) {
    return sendPostError(res, 400, bodyCheck.errorCode, bodyCheck.message);
  }

  if (
    isNoticePostInput({ category, title }) &&
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
      categoryId: await resolveCategoryIdByName(species),
      ...(resolvedImages
        ? { image: resolvedImages.image, images: resolvedImages.images }
        : {}),
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

  // viewer 가 차단한 사람의 댓글과 그 수를 빼고, 숨긴 댓글은 작성자 본인과 관리자에게만 보인다.
  const isModerator = isModeratorUser(user);
  const commentWhere = await commentVisibilityWhere(user);
  // 댓글 수에서는 '삭제된 댓글' 자리를 뺀다(목록에는 답글을 묶으려고 내려 준다).
  const commentCountWhere: Prisma.CommentWhereInput = {
    AND: [...(commentWhere ? [commentWhere] : []), { deletedAt: null }],
  };

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
        ...(commentWhere ? { where: commentWhere } : {}),
        select: {
          comment: true,
          id: true,
          createdAt: true,
          isHidden: true,
          parentId: true,
          editedAt: true,
          deletedAt: true,
          stance: true,
          _count: { select: { likes: true } },
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
          comments: { where: commentCountWhere },
          Likes: true,
        },
      },
    },
  });

  if (!post) {
    return res.status(404).json({ success: false, error: "게시글을 찾을 수 없습니다." });
  }
  // 운영자가 숨긴 글은 작성자와 관리자만 본다(상품 PRODUCT_HIDDEN 과 같은 방식).
  if (post.isHidden && post.userId !== user?.id && !isModerator) {
    return sendPostError(res, 404, "POST_HIDDEN", "운영 정책에 따라 비공개된 게시글입니다.");
  }

  const isNoticePost =
    post.category === "공지" || String(post.title || "").startsWith("[공지]");

  const noticeWhere = {
    isHidden: false,
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

  // viewer 가 좋아요한 댓글(비로그인·댓글 없음이면 조회하지 않는다)
  const commentIds = post.comments.map((comment) => comment.id);
  const likedCommentIds = new Set(
    user?.id && commentIds.length
      ? (
          await client.commentLike.findMany({
            where: { userId: user.id, commentId: { in: commentIds } },
            select: { commentId: true },
          })
        ).map((like) => like.commentId)
      : []
  );

  const serializedPost: PostDetail = {
    ...withPostImages(post),
    user: {
      ...post.user,
      breederPrograms: getSortedActiveBreederProgramSummaries(
        post.user.breederPrograms
      ),
    },
    comments: post.comments.map(({ _count, ...comment }) => ({
      ...comment,
      // 구버전 앱은 deletedAt 을 모르고 본문을 그대로 그리므로 자리 문구를 본문으로 내려 준다.
      comment: comment.deletedAt ? DELETED_COMMENT_TEXT : comment.comment,
      likeCount: _count?.likes ?? 0,
      isLiked: likedCommentIds.has(comment.id),
      user: {
        ...comment.user,
        breederPrograms: getSortedActiveBreederProgramSummaries(
          comment.user.breederPrograms
        ),
      },
    })),
  };

  // 찬반 토론이면 요약(막대·참여 수·내 선택). 끝난 토론은 결과 알림을 한 번 만든다.
  let debate: DebateSummary | null = null;
  if (post.category === DEBATE_CATEGORY) {
    debate = (await getDebateSummaries([post], user?.id)).get(post.id) ?? null;
    if (debate && debate.state !== "open") void notifyDebateResult(post.id).catch(() => undefined);
  }

  res.json({
    success: true,
    post: serializedPost,
    isLiked,
    prevNotice,
    nextNotice,
    debate,
  });
}

export default withAuth(
  withHandler({
    methods: ["GET", "POST"],
    handler,
    isPrivate: false,
  })
);
