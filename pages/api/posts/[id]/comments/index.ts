import { NextApiRequest, NextApiResponse } from "next";
import type { Prisma } from "@prisma/client";
import withHandler, { ResponseType } from "@libs/server/withHandler";
import { withAuth } from "@libs/server/auth";
import client from "@libs/server/client";
import { extractPostIdFromPath } from "@libs/post-route";
import { isModeratorUser } from "@libs/server/adminAccess";
import { commentVisibilityWhere } from "@libs/server/comments";
import { excludedAuthorIds } from "@libs/server/blocks";
import { getDebateSummaries } from "@libs/server/debate";
import { DELETED_COMMENT_TEXT } from "@libs/shared/comment";
import { DEBATE_CATEGORY, type DebateSide } from "@libs/shared/debateFormat";
import type { LiveComment, LiveCommentsResult, LiveSwitch } from "@libs/shared/liveTalk";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

const liveSelect = {
  id: true,
  comment: true,
  createdAt: true,
  parentId: true,
  deletedAt: true,
  stance: true,
  userId: true,
  user: { select: { id: true, name: true, avatar: true } },
  _count: { select: { likes: true } },
} satisfies Prisma.CommentSelect;

type LiveRow = Prisma.CommentGetPayload<{ select: typeof liveSelect }>;

const parseCursor = (value: unknown) => {
  const n = Number(value);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
};

/**
 * GET /api/posts/:id/comments?after=<id>|before=<id>&limit=50 — 라이브 댓글(앱 docs/prd/live-talk.md §4.2·§4.3).
 * 오래된 → 최신 순. 커서가 없으면 최신 50. 화면이 열려 있는 동안 3초마다 after 로 새 댓글만 받는다.
 * 토론 글이면 요약(debate)·마음 바꾼 줄(switches)·끝난 토론의 각 쪽 베스트(best)를 같이 준다.
 */
async function handler(req: NextApiRequest, res: NextApiResponse<ResponseType>) {
  res.setHeader("Cache-Control", "private, no-store, max-age=0");
  const postId = extractPostIdFromPath(String(req.query.id ?? ""));
  if (!Number.isInteger(postId) || postId <= 0) {
    return res.status(400).json({ success: false, error: "유효하지 않은 게시글 ID입니다." });
  }
  const viewer = req.user;
  const post = await client.post.findUnique({
    where: { id: postId },
    select: { id: true, userId: true, isHidden: true, category: true },
  });
  if (!post || (post.isHidden && post.userId !== viewer?.id && !isModeratorUser(viewer))) {
    return res.status(404).json({ success: false, error: "볼 수 없는 글이에요", errorCode: "POST_NOT_FOUND" });
  }

  const after = parseCursor(req.query.after);
  const before = parseCursor(req.query.before);
  const limitRaw = Number(req.query.limit);
  const limit = Number.isInteger(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, MAX_LIMIT) : DEFAULT_LIMIT;
  const visibility = await commentVisibilityWhere(viewer);
  const base: Prisma.CommentWhereInput = { postId, ...(visibility ? { AND: [visibility] } : {}) };

  let rows: LiveRow[];
  if (after) {
    rows = await client.comment.findMany({
      where: { ...base, id: { gt: after } },
      select: liveSelect,
      orderBy: { id: "asc" },
      take: limit,
    });
  } else {
    rows = (
      await client.comment.findMany({
        where: { ...base, ...(before ? { id: { lt: before } } : {}) },
        select: liveSelect,
        orderBy: { id: "desc" },
        take: limit,
      })
    ).reverse();
  }
  const hasMoreBefore =
    !after && rows.length > 0
      ? (await client.comment.count({ where: { ...base, id: { lt: rows[0].id } } })) > 0
      : false;

  const ids = rows.map((row) => row.id);
  const parentIds = Array.from(new Set(rows.map((row) => row.parentId).filter((id): id is number => id != null)));
  const [liked, parents] = await Promise.all([
    viewer?.id && ids.length
      ? client.commentLike.findMany({ where: { userId: viewer.id, commentId: { in: ids } }, select: { commentId: true } })
      : Promise.resolve([] as { commentId: number }[]),
    parentIds.length
      ? client.comment.findMany({
          where: { id: { in: parentIds } },
          select: { id: true, comment: true, deletedAt: true, user: { select: { name: true } } },
        })
      : Promise.resolve([] as { id: number; comment: string; deletedAt: Date | null; user: { name: string } }[]),
  ]);
  const likedIds = new Set(liked.map((row) => row.commentId));
  const parentById = new Map(parents.map((parent) => [parent.id, parent]));
  const toLive = (row: LiveRow): LiveComment => {
    const parent = row.parentId != null ? parentById.get(row.parentId) : undefined;
    return {
      id: row.id,
      comment: row.deletedAt ? DELETED_COMMENT_TEXT : row.comment,
      createdAt: row.createdAt.toISOString(),
      parentId: row.parentId,
      parent: parent
        ? {
            id: parent.id,
            userName: parent.user.name,
            comment: parent.deletedAt ? DELETED_COMMENT_TEXT : parent.comment.slice(0, 60),
          }
        : null,
      stance: (row.stance as DebateSide | null) ?? null,
      isAuthor: row.userId === post.userId,
      likeCount: row._count.likes,
      isLiked: likedIds.has(row.id),
      deleted: row.deletedAt != null,
      user: row.user,
    };
  };

  let switches: LiveSwitch[] = [];
  let debate: LiveCommentsResult["debate"] = null;
  let best: LiveCommentsResult["best"] = null;
  if (post.category === DEBATE_CATEGORY) {
    debate = (await getDebateSummaries([post], viewer?.id)).get(postId) ?? null;
    // 받은 댓글 시간 범위의 마음 바꾸기. 증분이면 기준 댓글 뒤 바꾼 것만(같은 사람은 클라이언트가 최신 하나로 합친다).
    const excluded = await excludedAuthorIds(viewer?.id);
    let from: Date | null = null;
    if (after) {
      from = (await client.comment.findUnique({ where: { id: after }, select: { createdAt: true } }))?.createdAt ?? null;
    } else if (hasMoreBefore && rows.length) {
      from = rows[0].createdAt;
    }
    const to = before && rows.length ? rows[rows.length - 1].createdAt : null;
    const votes = await client.debateVote.findMany({
      where: {
        postId,
        switchedAt: { not: null, ...(from ? { gt: from } : {}), ...(to ? { lte: to } : {}) },
        ...(excluded.length ? { userId: { notIn: excluded } } : {}),
      },
      select: { userId: true, side: true, switchedAt: true, user: { select: { name: true } } },
      orderBy: { switchedAt: "asc" },
      take: 100,
    });
    switches = votes.map((vote) => ({
      userId: vote.userId,
      userName: vote.user.name,
      to: vote.side as DebateSide,
      at: (vote.switchedAt as Date).toISOString(),
    }));
    if (debate?.state === "decided") {
      const bestOf = async (side: DebateSide) => {
        const row = await client.comment.findFirst({
          where: { ...base, stance: side, deletedAt: null, likes: { some: {} } },
          select: liveSelect,
          orderBy: [{ likes: { _count: "desc" } }, { id: "asc" }],
        });
        return row ? toLive(row) : null;
      };
      best = { A: await bestOf("A"), B: await bestOf("B") };
    }
  }

  const result: LiveCommentsResult = {
    success: true,
    comments: rows.map(toLive),
    switches,
    debate,
    best,
    hasMoreBefore,
  };
  return res.json(result);
}

export default withAuth(withHandler({ methods: ["GET"], handler, isPrivate: false }));
