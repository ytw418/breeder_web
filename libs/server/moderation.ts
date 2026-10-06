import type {
  ModerationActionType,
  ModerationTargetType,
  Prisma,
} from "@prisma/client";
import client from "@libs/server/client";
import { createNotification } from "@libs/server/notification";

/**
 * 운영자 조치(숨김·숨김 해제·삭제)를 적용하고 ModerationLog 에 남긴다.
 * 앱 ⋯ 메뉴(POST /api/admin/moderation)와 신고 처리(applyReportAction)가 함께 쓴다.
 *
 * 삭제 의미는 기존 관리자 삭제와 같다: 게시글·댓글·경매는 hard delete,
 * 상품은 Sale/Purchase 가 참조하고 relationMode=prisma 라 isDeleted 로 둔다.
 * 경매는 숨길 때 진행중이면 취소해 입찰이 더 붙지 않게 한다(숨김 해제 시 상태는 되돌리지 않음).
 */

export const MODERATION_TARGET_TYPES = ["POST", "COMMENT", "PRODUCT", "AUCTION"] as const;
export const MODERATION_ACTIONS = ["hide", "unhide", "delete"] as const;
export type ModerationAction = (typeof MODERATION_ACTIONS)[number];

export const isModerationTargetType = (value: unknown): value is ModerationTargetType =>
  typeof value === "string" &&
  (MODERATION_TARGET_TYPES as readonly string[]).includes(value);

export const isModerationAction = (value: unknown): value is ModerationAction =>
  typeof value === "string" && (MODERATION_ACTIONS as readonly string[]).includes(value);

export interface ModerationInput {
  actorId: number;
  targetType: ModerationTargetType;
  targetId: number;
  action: ModerationAction;
  reason?: string | null;
  reportId?: number | null;
}

export interface ModerationResult {
  targetType: ModerationTargetType;
  targetId: number;
  isHidden: boolean;
  deleted: boolean;
}

const TARGET_NOT_FOUND_CODE = "MODERATION_TARGET_NOT_FOUND";
export const MODERATION_TARGET_NOT_FOUND_MESSAGE = "조치할 대상을 찾을 수 없습니다.";

const targetNotFoundError = () =>
  Object.assign(new Error(MODERATION_TARGET_NOT_FOUND_MESSAGE), {
    code: TARGET_NOT_FOUND_CODE,
  });

/** 대상이 없거나 조치 도중 다른 요청이 먼저 지운 경우 */
export const isModerationTargetNotFound = (error: unknown) =>
  typeof error === "object" &&
  error !== null &&
  (error as { code?: unknown }).code === TARGET_NOT_FOUND_CODE;

const isRecordNotFound = (error: unknown) =>
  typeof error === "object" &&
  error !== null &&
  (error as { code?: unknown }).code === "P2025";

const EXCERPT_MAX = 200;
const toExcerpt = (text: string) =>
  text.length > EXCERPT_MAX ? `${text.slice(0, EXCERPT_MAX)}…` : text;

const LOG_ACTION: Record<ModerationAction, ModerationActionType> = {
  hide: "HIDE",
  unhide: "UNHIDE",
  delete: "DELETE",
};

interface TargetInfo {
  userId: number;
  title: string;
  excerpt: string;
  /** 경매만: 숨길 때 취소 여부 판단 */
  status?: string;
}

async function findTarget(
  type: ModerationTargetType,
  id: number
): Promise<TargetInfo | null> {
  switch (type) {
    case "POST": {
      const post = await client.post.findUnique({
        where: { id },
        select: { userId: true, title: true, description: true },
      });
      return post && { userId: post.userId, title: post.title, excerpt: post.description };
    }
    case "COMMENT": {
      const comment = await client.comment.findUnique({
        where: { id },
        select: { userId: true, comment: true, post: { select: { title: true } } },
      });
      return (
        comment && {
          userId: comment.userId,
          title: comment.post ? `게시글 「${comment.post.title}」의 댓글` : "댓글",
          excerpt: comment.comment,
        }
      );
    }
    case "PRODUCT": {
      const product = await client.product.findUnique({
        where: { id },
        select: { userId: true, name: true, description: true, isDeleted: true },
      });
      return product && !product.isDeleted
        ? { userId: product.userId, title: product.name, excerpt: product.description }
        : null;
    }
    case "AUCTION": {
      const auction = await client.auction.findUnique({
        where: { id },
        select: { userId: true, title: true, description: true, status: true },
      });
      return (
        auction && {
          userId: auction.userId,
          title: auction.title,
          excerpt: auction.description,
          status: auction.status,
        }
      );
    }
    default:
      return null;
  }
}

async function setHidden(type: ModerationTargetType, id: number, isHidden: boolean) {
  const data = { isHidden };
  if (type === "POST") await client.post.update({ where: { id }, data });
  else if (type === "COMMENT") await client.comment.update({ where: { id }, data });
  else if (type === "PRODUCT") await client.product.update({ where: { id }, data });
  else await client.auction.update({ where: { id }, data });
}

async function hideAuction(id: number, actorId: number, target: TargetInfo) {
  if (target.status !== "진행중") {
    await setHidden("AUCTION", id, true);
    return;
  }
  await client.auction.update({
    where: { id },
    data: { isHidden: true, status: "취소", winnerId: null },
  });
  await createNotification({
    type: "AUCTION_END",
    userId: target.userId,
    senderId: actorId,
    message: `"${target.title}" 경매가 운영 정책에 따라 비공개 처리되어 취소되었습니다.`,
    targetId: id,
    targetType: "auction",
    allowSelf: true,
    dedupe: true,
  });
}

async function deleteTarget(
  type: ModerationTargetType,
  id: number,
  actorId: number,
  target: TargetInfo
) {
  if (type === "POST") await client.post.delete({ where: { id } });
  else if (type === "COMMENT") await client.comment.delete({ where: { id } });
  else if (type === "PRODUCT") {
    await client.product.update({ where: { id }, data: { isDeleted: true } });
  } else {
    await client.auction.delete({ where: { id } });
    await createNotification({
      type: "AUCTION_END",
      userId: target.userId,
      senderId: actorId,
      message: `"${target.title}" 경매가 관리자에 의해 삭제되었습니다.`,
      targetId: id,
      targetType: "auction",
      allowSelf: true,
      dedupe: false,
    });
  }
}

export async function applyModeration(input: ModerationInput): Promise<ModerationResult> {
  const { actorId, targetType, targetId, action } = input;
  const target = await findTarget(targetType, targetId);
  if (!target) throw targetNotFoundError();

  try {
    if (action === "delete") {
      await deleteTarget(targetType, targetId, actorId, target);
    } else if (action === "hide" && targetType === "AUCTION") {
      await hideAuction(targetId, actorId, target);
    } else {
      await setHidden(targetType, targetId, action === "hide");
    }
  } catch (error) {
    // 조회와 변경 사이에 다른 요청이 먼저 지운 경우
    if (isRecordNotFound(error)) throw targetNotFoundError();
    throw error;
  }

  const snapshot: Prisma.InputJsonValue | undefined =
    action === "delete"
      ? { title: target.title, excerpt: toExcerpt(target.excerpt) }
      : undefined;

  await client.moderationLog.create({
    data: {
      actorId,
      targetType,
      targetId,
      targetUserId: target.userId,
      action: LOG_ACTION[action],
      reason: input.reason?.trim().slice(0, 500) || null,
      reportId: input.reportId ?? null,
      snapshot,
    },
  });

  return {
    targetType,
    targetId,
    isHidden: action === "hide",
    deleted: action === "delete",
  };
}
