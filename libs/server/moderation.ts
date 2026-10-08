import { Prisma } from "@prisma/client";
import type {
  BloodlineCardType,
  ModerationActionType,
  ModerationTargetType,
} from "@prisma/client";
import client from "@libs/server/client";
import { createNotification } from "@libs/server/notification";
import {
  contentDeletedMessage,
  contentHiddenMessage,
  contentUnhiddenMessage,
} from "@libs/shared/sanction";
import { toPostPlainText } from "@libs/shared/post-body";
import { deleteCommentWithReplies } from "@libs/server/comments";

/**
 * 운영자 조치(숨김·숨김 해제·삭제)를 적용하고 ModerationLog 에 남긴다.
 * 앱 ⋯ 메뉴(POST /api/admin/moderation), 관리자 게시글·상품 삭제, 신고 처리(resolveReport)가 함께 쓴다.
 *
 * 삭제 의미는 기존 관리자 삭제와 같다: 게시글·댓글·경매는 hard delete,
 * 상품은 Sale/Purchase 가 참조하고 relationMode=prisma 라 isDeleted 로 둔다.
 * 경매는 숨길 때 진행중이면 취소해 입찰이 더 붙지 않게 한다(숨김 해제 시 상태는 되돌리지 않음).
 *
 * 숨김·숨김 해제·삭제마다 작성자에게 MODERATION 알림(사유 문구 포함)을 1건 보낸다(앱 docs/prd/admin-moderation.md AC-3·AC-6).
 * 관리자 화면은 사유 코드를 필수로 받고, 구버전 앱 ⋯ 메뉴는 사유 없이 올 수 있어 그때는 사유 부분을 뺀다.
 *
 * 혈통(BLOODLINE_CARD)은 status 로 다룬다: 숨김 = INACTIVE, 숨김 해제 = ACTIVE,
 * 삭제 = 회수(REVOKED, 되돌리지 않음). 뿌리 혈통을 회수하면 같은 뿌리의 출처 카드(LINE)도
 * 함께 회수하고 카드마다 CARD_REVOKED 이력을 남긴다. 이미 회수된 카드는 대상이 없는 것으로 본다.
 * 상품·경매의 bloodlineRootId 는 그대로 두며, 요약 조회가 ACTIVE 를 요구하므로 혈통 행만 사라진다.
 */

export const MODERATION_TARGET_TYPES = [
  "POST",
  "COMMENT",
  "PRODUCT",
  "AUCTION",
  "BLOODLINE_CARD",
] as const satisfies readonly ModerationTargetType[];
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
  /** 운영자 메모(자유 입력) */
  reason?: string | null;
  /** 제재 사유 코드(호출부에서 isSanctionReasonCode 로 검증) */
  reasonCode?: string | null;
  reportId?: number | null;
  /** 작성자 알림을 보낼지(기본 true) */
  notifyAuthor?: boolean;
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
  /** 작성자 알림에 넣을 이름(댓글은 댓글 내용, 그 외는 제목) */
  noticeTitle: string;
  /** 숨김·해제 알림을 누르면 갈 곳(댓글은 게시글) */
  link: { targetType: string; targetId: number } | null;
  /** 경매만: 숨길 때 취소 여부 판단 */
  status?: string;
  /** 혈통만: 회수 연쇄 여부(뿌리만 출처 카드까지)와 이력의 이전 보유자 */
  bloodline?: { cardType: BloodlineCardType; currentOwnerId: number };
}

/** 혈통 회수 이력 메모(CARD_REVOKED.note). 운영자 사유는 이력에 싣지 않고 ModerationLog 에만 남긴다. */
export const BLOODLINE_REVOKE_NOTE = "운영 정책으로 회수";
export const BLOODLINE_CASCADE_REVOKE_NOTE = "혈통 회수에 따라 함께 회수";

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
      return (
        post && {
          userId: post.userId,
          title: post.title,
          excerpt: toPostPlainText(post.description),
          noticeTitle: post.title,
          link: { targetType: "post", targetId: id },
        }
      );
    }
    case "COMMENT": {
      const comment = await client.comment.findUnique({
        where: { id },
        select: { userId: true, comment: true, postId: true, post: { select: { title: true } } },
      });
      return (
        comment && {
          userId: comment.userId,
          title: comment.post ? `게시글 「${comment.post.title}」의 댓글` : "댓글",
          excerpt: comment.comment,
          noticeTitle: comment.comment,
          link: comment.postId ? { targetType: "post", targetId: comment.postId } : null,
        }
      );
    }
    case "PRODUCT": {
      const product = await client.product.findUnique({
        where: { id },
        select: { userId: true, name: true, description: true, isDeleted: true },
      });
      return product && !product.isDeleted
        ? {
            userId: product.userId,
            title: product.name,
            excerpt: product.description,
            noticeTitle: product.name,
            link: { targetType: "product", targetId: id },
          }
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
          noticeTitle: auction.title,
          link: { targetType: "auction", targetId: id },
          status: auction.status,
        }
      );
    }
    case "BLOODLINE_CARD": {
      const card = await client.bloodlineCard.findUnique({
        where: { id },
        select: {
          cardType: true,
          status: true,
          creatorId: true,
          currentOwnerId: true,
          name: true,
          description: true,
          speciesType: true,
        },
      });
      // 회수는 되돌리지 않는 삭제라 상품 isDeleted 처럼 대상이 없는 것으로 본다.
      return card && card.status !== "REVOKED"
        ? {
            userId: card.creatorId,
            title: card.name,
            excerpt: card.description || card.speciesType || "",
            noticeTitle: card.name,
            link: { targetType: "bloodline", targetId: id },
            bloodline: { cardType: card.cardType, currentOwnerId: card.currentOwnerId },
          }
        : null;
    }
    default:
      return null;
  }
}

/** 혈통 숨김(INACTIVE)·숨김 해제(ACTIVE). 그 사이 회수됐으면 되살리지 않고 대상 없음으로 본다. */
async function setBloodlineVisible(id: number, isHidden: boolean) {
  const { count } = await client.bloodlineCard.updateMany({
    where: { id, status: { not: "REVOKED" } },
    data: { status: isHidden ? "INACTIVE" : "ACTIVE" },
  });
  if (count === 0) throw targetNotFoundError();
}

async function setHidden(type: ModerationTargetType, id: number, isHidden: boolean) {
  const data = { isHidden };
  if (type === "POST") await client.post.update({ where: { id }, data });
  else if (type === "COMMENT") await client.comment.update({ where: { id }, data });
  else if (type === "PRODUCT") await client.product.update({ where: { id }, data });
  else if (type === "BLOODLINE_CARD") await setBloodlineVisible(id, isHidden);
  else await client.auction.update({ where: { id }, data });
}

/**
 * 혈통 회수. 뿌리 혈통이면 같은 뿌리의 출처 카드(ACTIVE·INACTIVE)도 REVOKED 로 바꾸고
 * 카드마다 CARD_REVOKED 이력을 남긴다. 회수 도중 새 출처 카드가 발급돼 살아남지 않게
 * 출처 카드 발급(issue-line)과 같은 Serializable 트랜잭션으로 묶는다.
 */
async function revokeBloodlineCard(id: number, target: TargetInfo) {
  const bloodline = target.bloodline;
  if (!bloodline) throw targetNotFoundError();

  await client.$transaction(
    async (tx) => {
      const revoked = await tx.bloodlineCard.updateMany({
        where: { id, status: { not: "REVOKED" } },
        data: { status: "REVOKED" },
      });
      // 조회 뒤 다른 요청이 먼저 회수했다.
      if (revoked.count === 0) throw targetNotFoundError();

      const lines =
        bloodline.cardType === "BLOODLINE"
          ? await tx.bloodlineCard.findMany({
              where: {
                cardType: "LINE",
                bloodlineReferenceId: id,
                status: { in: ["ACTIVE", "INACTIVE"] },
              },
              select: { id: true, currentOwnerId: true },
            })
          : [];

      if (lines.length > 0) {
        await tx.bloodlineCard.updateMany({
          where: { id: { in: lines.map((line) => line.id) }, status: { not: "REVOKED" } },
          data: { status: "REVOKED" },
        });
      }

      // 운영자는 이력에 드러내지 않는다(actorUserId null). 누가 조치했는지는 ModerationLog 에 남는다.
      await tx.bloodlineCardEvent.createMany({
        data: [
          {
            cardId: id,
            action: "CARD_REVOKED",
            actorUserId: null,
            fromUserId: bloodline.currentOwnerId,
            toUserId: null,
            note: BLOODLINE_REVOKE_NOTE,
          },
          ...lines.map((line) => ({
            cardId: line.id,
            action: "CARD_REVOKED" as const,
            actorUserId: null,
            fromUserId: line.currentOwnerId,
            toUserId: null,
            relatedCardId: id,
            note: BLOODLINE_CASCADE_REVOKE_NOTE,
          })),
        ],
      });
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
  );
}

/** 진행 중이던 경매를 숨기면 취소한다. 취소 사실은 작성자 운영 알림 문구에 덧붙인다. */
async function hideAuction(id: number, target: TargetInfo): Promise<boolean> {
  if (target.status !== "진행중") {
    await setHidden("AUCTION", id, true);
    return false;
  }
  await client.auction.update({
    where: { id },
    data: { isHidden: true, status: "취소", winnerId: null },
  });
  return true;
}

const AUCTION_CANCELED_SUFFIX = " 진행 중이던 경매는 취소되었어요.";

function authorNoticeMessage(
  input: ModerationInput,
  target: TargetInfo,
  auctionCanceled: boolean
): string {
  const { targetType, action, reasonCode } = input;
  if (action === "unhide") return contentUnhiddenMessage(targetType, target.noticeTitle);
  if (action === "delete") return contentDeletedMessage(targetType, target.noticeTitle, reasonCode);
  return contentHiddenMessage(targetType, target.noticeTitle, reasonCode) + (auctionCanceled ? AUCTION_CANCELED_SUFFIX : "");
}

async function deleteTarget(type: ModerationTargetType, id: number, target: TargetInfo) {
  if (type === "POST") await client.post.delete({ where: { id } });
  // 루트 댓글이면 답글까지 지운다.
  else if (type === "COMMENT") await deleteCommentWithReplies(id);
  else if (type === "PRODUCT") {
    await client.product.update({ where: { id }, data: { isDeleted: true } });
  } else if (type === "BLOODLINE_CARD") {
    await revokeBloodlineCard(id, target);
  } else {
    await client.auction.delete({ where: { id } });
  }
}

export async function applyModeration(input: ModerationInput): Promise<ModerationResult> {
  const { actorId, targetType, targetId, action } = input;
  const target = await findTarget(targetType, targetId);
  if (!target) throw targetNotFoundError();

  let auctionCanceled = false;
  try {
    if (action === "delete") {
      await deleteTarget(targetType, targetId, target);
    } else if (action === "hide" && targetType === "AUCTION") {
      auctionCanceled = await hideAuction(targetId, target);
    } else {
      await setHidden(targetType, targetId, action === "hide");
    }
  } catch (error) {
    // 조회와 변경 사이에 다른 요청이 먼저 지운 경우
    if (isRecordNotFound(error)) throw targetNotFoundError();
    throw error;
  }

  // 숨김도 원문을 남겨 둔다(작성자가 나중에 고쳐도 무엇을 숨겼는지 남도록).
  const snapshot: Prisma.InputJsonValue | undefined =
    action === "unhide" ? undefined : { title: target.title, excerpt: toExcerpt(target.excerpt) };

  await client.moderationLog.create({
    data: {
      actorId,
      targetType,
      targetId,
      targetUserId: target.userId,
      action: LOG_ACTION[action],
      reason: input.reason?.trim().slice(0, 500) || null,
      reasonCode: input.reasonCode ?? null,
      reportId: input.reportId ?? null,
      snapshot,
    },
  });

  if (input.notifyAuthor !== false) {
    // 삭제된 콘텐츠는 열 곳이 없어 이동 대상을 두지 않는다. 운영자 자신의 콘텐츠면 createNotification 이 건너뛴다.
    const link = action === "delete" ? null : target.link;
    await createNotification({
      type: "MODERATION",
      userId: target.userId,
      senderId: actorId,
      message: authorNoticeMessage(input, target, auctionCanceled),
      targetType: link?.targetType,
      targetId: link?.targetId,
    });
  }

  return {
    targetType,
    targetId,
    isHidden: action === "hide",
    deleted: action === "delete",
  };
}
