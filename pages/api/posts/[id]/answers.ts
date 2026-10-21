import { NextApiRequest, NextApiResponse } from "next";
import withHandler, { ResponseType } from "@libs/server/withHandler";

import client from "@libs/server/client";
import { extractPostIdFromPath } from "@libs/post-route";
import { withAuth } from "@libs/server/auth";
import { isModeratorUser } from "@libs/server/adminAccess";
import { createNotification } from "@libs/server/notification";
import { captureServerEvent, resolveClientPlatform } from "@libs/server/analytics";
import { incrementUserMissionProgress } from "@libs/server/growth";
import { getBlockRelation } from "@libs/server/blocks";
import { sendCommentError } from "@libs/server/comments";
import { validateCommentBody } from "@libs/shared/comment";
import { parsePositiveIntId } from "@libs/shared/normalize";
import { DEBATE_CATEGORY } from "@libs/shared/debateFormat";
import { DEBATE_CLIENT_HEADER } from "@libs/shared/liveTalk";
import { BLOCKED_WORD_MESSAGE, hasBlockedWord } from "@libs/shared/contentFilter";

/** 같은 사람이 이 간격 안에 다시 쓰면 막는다(라이브 댓글 도배 방지, 앱 docs/prd/live-talk.md §4.4). */
const COMMENT_RATE_MS = 3000;
/** 글쓴이(답글이면 원댓글 작성자)가 차단한 사람의 댓글은 막는다. 차단 사실은 드러내지 않는다. */
const COMMENT_NOT_ALLOWED_MESSAGE = "이 게시글에는 댓글을 남길 수 없습니다.";
const blockedByOwner = async (ownerId: number, commenterId?: number) =>
  !!commenterId && ownerId !== commenterId && (await getBlockRelation(ownerId, commenterId)).blockedByMe;
/** 새 댓글 알림을 받는 구독자(이 글에 댓글을 단 사람) 최대 인원. 먼저 구독한 순. */
const SUBSCRIBER_NOTIFY_MAX = 50;
/** 구독자에겐 같은 글 새 댓글 알림을 이 간격에 한 번만 보낸다. */
const SUBSCRIBER_NOTIFY_WINDOW_MS = 60 * 60 * 1000;

/** 알림 문구용 한 줄 요약(줄바꿈·연속 공백을 한 칸으로, 넘으면 말줄임). */
const clip = (text: string | null | undefined, max: number) => {
  const flat = (text ?? "").replace(/\s+/g, " ").trim();
  return flat.length > max ? `${flat.slice(0, max)}…` : flat;
};

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseType>
) {
  const {
    query: { id = "" },
    user,
    body,
  } = req;

  const postId = extractPostIdFromPath(id);
  if (Number.isNaN(postId)) {
    return res.status(400).json({ success: false, error: "유효하지 않은 게시글 ID입니다." });
  }

  // 운영자가 숨긴 글에는 작성자·관리자만 댓글을 단다(다른 사람에겐 404 와 같다).
  const post = await client.post.findUnique({
    where: { id: postId },
    select: { userId: true, isHidden: true, category: true, title: true },
  });
  if (!post) {
    return res.status(404).json({ success: false, error: "게시글을 찾을 수 없습니다." });
  }
  if (post.isHidden && post.userId !== user?.id && !isModeratorUser(user)) {
    return res.status(404).json({
      success: false,
      error: "운영 정책에 따라 비공개된 게시글입니다.",
    });
  }
  if (await blockedByOwner(post.userId, user?.id)) {
    return sendCommentError(res, 403, "COMMENT_NOT_ALLOWED", COMMENT_NOT_ALLOWED_MESSAGE);
  }

  const validation = validateCommentBody(body?.comment);
  if (!validation.ok) {
    return sendCommentError(res, 400, validation.errorCode, validation.message);
  }
  if (hasBlockedWord(validation.comment)) {
    return sendCommentError(res, 400, "BLOCKED_WORD", BLOCKED_WORD_MESSAGE);
  }
  if (user?.id) {
    const last = await client.comment.findFirst({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });
    if (last && Date.now() - last.createdAt.getTime() < COMMENT_RATE_MS) {
      return sendCommentError(res, 429, "RATE_LIMIT", "조금 천천히 보내 주세요");
    }
  }

  // 찬반 토론 글: 끝났으면 막고, 쓴 순간의 쪽(stance)을 남긴다. 새 앱·웹(헤더 있음)은 작성자가 아니면 먼저 골라야 쓴다.
  // 헤더가 없는 옛 앱은 투표 화면이 없어 막으면 댓글을 못 쓰므로 stance 없이 받는다.
  let stance: "A" | "B" | null = null;
  if (post.category === DEBATE_CATEGORY && user?.id) {
    const debate = await client.debate.findUnique({ where: { postId }, select: { endsAt: true } });
    if (debate && Date.now() >= debate.endsAt.getTime()) {
      return sendCommentError(res, 409, "DEBATE_CLOSED", "끝난 토론은 읽기만 할 수 있어요");
    }
    const vote = await client.debateVote.findUnique({
      where: { postId_userId: { postId, userId: user.id } },
      select: { side: true },
    });
    stance = vote?.side ?? null;
    const debateClient = Boolean(req.headers[DEBATE_CLIENT_HEADER]);
    if (debate && !stance && debateClient && post.userId !== user.id) {
      return sendCommentError(res, 409, "DEBATE_PICK_FIRST", "먼저 한쪽을 골라 주세요");
    }
  }

  // 대댓글은 1단계다. 답글에 답글을 달면 그 루트에 붙인다.
  let parent: { id: number; notifyUserId: number | null } | null = null;
  let replyToUserId: number | null = null;
  if (body?.parentId != null) {
    const parentId = parsePositiveIntId(body.parentId);
    if (parentId === null) {
      return sendCommentError(res, 400, "COMMENT_INVALID_PARENT", "답글을 남길 댓글이 올바르지 않습니다.");
    }
    const target = await client.comment.findUnique({
      where: { id: parentId },
      select: { id: true, userId: true, postId: true, parentId: true, isHidden: true, deletedAt: true },
    });
    const root =
      target?.parentId != null
        ? await client.comment.findUnique({
            where: { id: target.parentId },
            select: { id: true, userId: true, postId: true, parentId: true, isHidden: true, deletedAt: true },
          })
        : target;
    // 숨긴 댓글은 작성자·관리자에게만 보이므로 다른 사람에겐 없는 댓글과 같다.
    const hiddenFromViewer =
      root?.isHidden && root.userId !== user?.id && !isModeratorUser(user);
    if (!root || root.postId !== postId || hiddenFromViewer) {
      return sendCommentError(res, 404, "COMMENT_PARENT_NOT_FOUND", "답글을 남길 댓글을 찾을 수 없습니다.");
    }
    if (await blockedByOwner(root.userId, user?.id)) {
      return sendCommentError(res, 403, "COMMENT_NOT_ALLOWED", COMMENT_NOT_ALLOWED_MESSAGE);
    }
    // 답글의 답글은 그 답글 작성자에게 알린다(입력창 대상 표시와 같은 사람). 지운 댓글 작성자에겐 알리지 않는다.
    const replyTo = target ?? root;
    parent = { id: root.id, notifyUserId: replyTo.deletedAt ? null : replyTo.userId };
    // 답글에 단 답글이면 그 답글 작성자를 남긴다(본문 맨 앞 '@닉네임' 표시). 루트에 바로 단 답글은 null.
    replyToUserId = target && target.parentId != null ? target.userId : null;
  }

  const newAnswer = await client.comment.create({
    data: {
      user: {
        connect: {
          id: user?.id,
        },
      },
      post: {
        connect: {
          id: postId,
        },
      },
      comment: validation.comment,
      parentId: parent?.id ?? null,
      replyToUserId,
      stance,
    },
  });

  const senderUser = await client.user.findUnique({
    where: { id: user?.id },
    select: { name: true },
  });

  if (user?.id && senderUser) {
    // 댓글을 단 사람은 이 글 새 댓글 알림을 구독한다. 이미 끈(muted) 사람은 그대로 둔다.
    await client.postSubscription.upsert({
      where: { userId_postId: { userId: user.id, postId } },
      create: { userId: user.id, postId, muted: false },
      update: {},
    });
    await notifyNewComment({
      postId,
      postTitle: post.title,
      postAuthorId: post.userId,
      senderId: user.id,
      senderName: senderUser.name,
      comment: validation.comment,
      commentId: newAnswer.id,
      replyReceiverId: parent?.notifyUserId ?? null,
    });
    await incrementUserMissionProgress(user.id, "comment_write");
    if (post.category === DEBATE_CATEGORY) {
      await captureServerEvent(user.id, "debate_commented", {
        post_id: postId,
        side: stance,
        is_author: post.userId === user.id,
        platform: resolveClientPlatform(req),
      });
    }
    await captureServerEvent(user.id, "post_answer_created", {
      post_id: postId,
      post_category: post.category ?? null,
      is_reply: Boolean(parent),
      platform: resolveClientPlatform(req),
    });
  }

  res.json({
    success: true,
    answer: newAnswer,
  });
}

/**
 * 새 댓글 알림(앱 docs/prd/post-upload.md 2026-10-21 '대화 이어 가기').
 * - 답글 대상: 그 댓글 작성자. 글쓴이: 이 글을 '알림 끄기' 하지 않았으면. 둘 다 '{이름}: {댓글 앞 40자}'.
 * - 구독자(이 글에 댓글을 단 사람, muted=false): 글쓴이·답글 대상·나·차단 관계(양쪽)를 빼고 먼저 구독한 순 50명,
 *   같은 글 새 댓글 알림을 1시간 안에 받았으면 건너뛴다. '"{제목 앞 30자}" 글에 새 댓글: {댓글 앞 40자}'.
 * 모두 COMMENT·commentId 이고 푸시 제목은 글 제목이다. 받는 사람이 나를 차단했으면 보내지 않는다(createNotification).
 */
async function notifyNewComment({
  postId,
  postTitle,
  postAuthorId,
  senderId,
  senderName,
  comment,
  commentId,
  replyReceiverId,
}: {
  postId: number;
  postTitle: string;
  postAuthorId: number;
  senderId: number;
  senderName: string;
  comment: string;
  commentId: number;
  replyReceiverId: number | null;
}) {
  const pushTitle = postTitle?.trim() || undefined;
  const personal = `${senderName}: ${clip(comment, 40)}`;
  // 받는 사람이 차단한 사람의 댓글 알림은 createNotification 이 건너뛴다(libs/server/notificationGate).
  const base = { type: "COMMENT" as const, senderId, targetId: postId, targetType: "post", commentId, pushTitle };

  if (replyReceiverId !== null) {
    await createNotification({ ...base, userId: replyReceiverId, message: personal });
  }
  // 글쓴이. 답글 알림을 이미 받은 사람이면 한 번만 보내고, 이 글 알림을 끈 글쓴이에겐 보내지 않는다.
  if (replyReceiverId !== postAuthorId && postAuthorId !== senderId) {
    const authorSubscription = await client.postSubscription.findUnique({
      where: { userId_postId: { userId: postAuthorId, postId } },
      select: { muted: true },
    });
    if (!authorSubscription?.muted) {
      await createNotification({ ...base, userId: postAuthorId, message: personal });
    }
  }

  const skipIds = [senderId, postAuthorId, ...(replyReceiverId !== null ? [replyReceiverId] : [])];
  const subscriptions = await client.postSubscription.findMany({
    where: { postId, muted: false, userId: { notIn: skipIds }, user: { status: "ACTIVE" } },
    orderBy: { createdAt: "asc" },
    take: SUBSCRIBER_NOTIFY_MAX,
    select: { userId: true },
  });
  const candidateIds = subscriptions.map((row) => row.userId);
  if (!candidateIds.length) return;

  const [blocks, recent] = await Promise.all([
    client.userBlock.findMany({
      where: {
        OR: [
          { blockerId: { in: candidateIds }, blockedId: senderId },
          { blockerId: senderId, blockedId: { in: candidateIds } },
        ],
      },
      select: { blockerId: true, blockedId: true },
    }),
    client.notification.findMany({
      where: {
        type: "COMMENT",
        targetType: "post",
        targetId: postId,
        userId: { in: candidateIds },
        createdAt: { gte: new Date(Date.now() - SUBSCRIBER_NOTIFY_WINDOW_MS) },
      },
      select: { userId: true },
    }),
  ]);
  const skip = new Set<number>([
    ...blocks.map((row) => (row.blockerId === senderId ? row.blockedId : row.blockerId)),
    ...recent.map((row) => row.userId),
  ]);
  const message = `"${clip(postTitle, 30)}" 글에 새 댓글: ${clip(comment, 40)}`;
  await Promise.all(
    candidateIds
      .filter((receiverId) => !skip.has(receiverId))
      .map((receiverId) => createNotification({ ...base, userId: receiverId, message }))
  );
}

export default withAuth(
  withHandler({
    methods: ["POST"],
    handler,
    isPrivate: true,
  })
);
