import type { ModerationActionType, Report, ReportAction, ReportStatus, ReportTargetType } from "@prisma/client";
import client from "@libs/server/client";
import { applyModeration, isModerationTargetNotFound } from "@libs/server/moderation";
import { createNotification } from "@libs/server/notification";
import { isSanctionError, issueSanction, type SanctionTarget } from "@libs/server/sanctions";
import {
  defaultSanctionReason,
  reporterActionMessage,
  validateSanctionDraft,
} from "@libs/shared/sanction";
import { toPostPath } from "@libs/post-route";
import { getProductPath } from "@libs/product-route";
import { displayUserName } from "@libs/shared/deletedUser";
import { REPORT_TARGET_LABEL, isRemovableReportTarget } from "@libs/shared/report";

/** 관리자 화면 채팅 신고 스냅샷에 보여줄 최근 메시지 수 */
export const REPORT_CHAT_SNAPSHOT_SIZE = 20;
/** 채팅방 스냅샷 메시지를 동시에 조회하는 방 수(서버리스 DB 커넥션 풀 보호) */
export const REPORT_CHAT_SNAPSHOT_CONCURRENCY = 5;
const EXCERPT_MAX = 120;

export type ResolveReportTargetResult =
  | { ok: true; reportedUserId: number }
  | {
      ok: false;
      status: 403 | 404;
      error: string;
      errorCode: "REPORT_TARGET_NOT_FOUND" | "REPORT_TARGET_FORBIDDEN";
    };

const TARGET_NOT_FOUND = {
  ok: false,
  status: 404,
  error: "신고 대상을 찾을 수 없습니다.",
  errorCode: "REPORT_TARGET_NOT_FOUND",
} as const;

const found = (reportedUserId: number) => ({ ok: true, reportedUserId }) as const;

/**
 * 신고 대상을 확인하고 피신고자(콘텐츠 작성자·채팅 상대·대상 사용자)를 찾는다.
 * 채팅방은 신고자가 멤버인 방만 신고할 수 있고, 피신고자는 상대 멤버다.
 * 혈통은 ACTIVE 인 카드만 신고할 수 있고, 피신고자는 만든 사람(creatorId)이다.
 */
export async function resolveReportTarget(
  type: ReportTargetType,
  targetId: number,
  reporterId: number
): Promise<ResolveReportTargetResult> {
  switch (type) {
    case "POST": {
      const post = await client.post.findUnique({
        where: { id: targetId },
        select: { userId: true },
      });
      return post ? found(post.userId) : TARGET_NOT_FOUND;
    }
    case "COMMENT": {
      const comment = await client.comment.findUnique({
        where: { id: targetId },
        select: { userId: true },
      });
      return comment ? found(comment.userId) : TARGET_NOT_FOUND;
    }
    case "PRODUCT": {
      const product = await client.product.findUnique({
        where: { id: targetId },
        select: { userId: true, isDeleted: true },
      });
      return product && !product.isDeleted ? found(product.userId) : TARGET_NOT_FOUND;
    }
    case "CHAT_ROOM": {
      const members = await client.chatRoomMember.findMany({
        where: { chatRoomId: targetId },
        select: { userId: true },
      });
      if (members.length === 0) return TARGET_NOT_FOUND;
      if (!members.some((member) => member.userId === reporterId)) {
        return {
          ok: false,
          status: 403,
          error: "참여 중인 채팅방만 신고할 수 있습니다.",
          errorCode: "REPORT_TARGET_FORBIDDEN",
        };
      }
      const partner = members.find((member) => member.userId !== reporterId);
      return partner ? found(partner.userId) : TARGET_NOT_FOUND;
    }
    case "USER": {
      const user = await client.user.findUnique({
        where: { id: targetId },
        select: { id: true },
      });
      return user ? found(user.id) : TARGET_NOT_FOUND;
    }
    case "BLOODLINE_CARD": {
      const card = await client.bloodlineCard.findUnique({
        where: { id: targetId },
        select: { creatorId: true, status: true },
      });
      return card && card.status === "ACTIVE" ? found(card.creatorId) : TARGET_NOT_FOUND;
    }
    default:
      return TARGET_NOT_FOUND;
  }
}

export interface ReportTargetMessage {
  id: number;
  userId: number;
  message: string;
  createdAt: Date;
}

export interface ReportTargetSnapshot {
  exists: boolean;
  title: string;
  excerpt: string;
  href: string | null;
  /** CHAT_ROOM 만: 최근 메시지(오래된 → 최신 순) */
  messages?: ReportTargetMessage[];
}

type SnapshotSource = Pick<Report, "targetType" | "targetId">;

const toExcerpt = (text: string) =>
  text.length > EXCERPT_MAX ? `${text.slice(0, EXCERPT_MAX)}…` : text;

/** 혈통 상세 경로(뿌리·출처 카드 공통). 앱 딥링크도 같은 경로를 쓴다. */
const bloodlineCardPath = (id: number) => `/bloodline-management/card/${id}`;

const missingSnapshot = (type: ReportTargetType): ReportTargetSnapshot => ({
  exists: false,
  title: `삭제된 ${REPORT_TARGET_LABEL[type]}`,
  excerpt: "",
  href: null,
  ...(type === "CHAT_ROOM" ? { messages: [] } : {}),
});

/** 방마다 최근 메시지를 REPORT_CHAT_SNAPSHOT_CONCURRENCY 개씩 나눠 조회한다(오래된 → 최신 순). */
async function fetchRoomSnapshotMessages(roomIds: number[]) {
  const entries: (readonly [number, ReportTargetMessage[]])[] = [];
  for (let i = 0; i < roomIds.length; i += REPORT_CHAT_SNAPSHOT_CONCURRENCY) {
    const chunk = roomIds.slice(i, i + REPORT_CHAT_SNAPSHOT_CONCURRENCY);
    const chunkEntries = await Promise.all(
      chunk.map(async (roomId) => {
        const latest = await client.message.findMany({
          where: { chatRoomId: roomId },
          orderBy: { createdAt: "desc" },
          take: REPORT_CHAT_SNAPSHOT_SIZE,
          select: { id: true, userId: true, message: true, createdAt: true },
        });
        return [roomId, latest.reverse()] as const;
      })
    );
    entries.push(...chunkEntries);
  }
  return new Map(entries);
}

const uniqueTargetIds = (reports: SnapshotSource[], type: ReportTargetType) =>
  Array.from(
    new Set(reports.filter((report) => report.targetType === type).map((r) => r.targetId))
  );

/**
 * 관리자 화면용 대상 스냅샷을 대상 유형별로 묶어 조회한다(신고 수만큼 쿼리하지 않도록).
 * 결과는 입력 순서와 같다.
 */
export async function buildTargetSnapshots(
  reports: SnapshotSource[]
): Promise<ReportTargetSnapshot[]> {
  const postIds = uniqueTargetIds(reports, "POST");
  const commentIds = uniqueTargetIds(reports, "COMMENT");
  const productIds = uniqueTargetIds(reports, "PRODUCT");
  const userIds = uniqueTargetIds(reports, "USER");
  const roomIds = uniqueTargetIds(reports, "CHAT_ROOM");
  const bloodlineIds = uniqueTargetIds(reports, "BLOODLINE_CARD");

  const [posts, comments, products, users, rooms, bloodlineCards] = await Promise.all([
    postIds.length
      ? client.post.findMany({
          where: { id: { in: postIds } },
          select: { id: true, title: true, description: true, isHidden: true },
        })
      : [],
    commentIds.length
      ? client.comment.findMany({
          where: { id: { in: commentIds } },
          select: {
            id: true,
            comment: true,
            postId: true,
            isHidden: true,
            post: { select: { title: true } },
          },
        })
      : [],
    productIds.length
      ? client.product.findMany({
          where: { id: { in: productIds } },
          select: { id: true, name: true, description: true, isHidden: true, isDeleted: true },
        })
      : [],
    userIds.length
      ? client.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, name: true, status: true },
        })
      : [],
    roomIds.length
      ? client.chatRoom.findMany({ where: { id: { in: roomIds } }, select: { id: true } })
      : [],
    bloodlineIds.length
      ? client.bloodlineCard.findMany({
          where: { id: { in: bloodlineIds } },
          select: {
            id: true,
            cardType: true,
            status: true,
            name: true,
            description: true,
            speciesType: true,
          },
        })
      : [],
  ]);

  const roomMessages = await fetchRoomSnapshotMessages(rooms.map((room) => room.id));

  const snapshots = new Map<string, ReportTargetSnapshot>();
  const key = (type: ReportTargetType, id: number) => `${type}:${id}`;

  for (const post of posts) {
    snapshots.set(key("POST", post.id), {
      exists: true,
      title: `${post.isHidden ? "[숨김] " : ""}${post.title}`,
      excerpt: toExcerpt(post.description),
      href: toPostPath(post.id, post.title),
    });
  }
  for (const comment of comments) {
    const postTitle = comment.post?.title ?? "";
    snapshots.set(key("COMMENT", comment.id), {
      exists: true,
      title: `${comment.isHidden ? "[숨김] " : ""}${
        postTitle ? `게시글 「${postTitle}」의 댓글` : "댓글"
      }`,
      excerpt: toExcerpt(comment.comment),
      href: toPostPath(comment.postId, postTitle || null),
    });
  }
  for (const product of products) {
    const state = product.isDeleted ? "[삭제] " : product.isHidden ? "[숨김] " : "";
    snapshots.set(key("PRODUCT", product.id), {
      exists: true,
      title: `${state}${product.name}`,
      excerpt: toExcerpt(product.description),
      // 숨김·삭제 상품은 웹 상세(SSR, 비로그인 조회)가 404 라 링크를 주지 않는다.
      href: state ? null : getProductPath(product.id, product.name),
    });
  }
  for (const user of users) {
    snapshots.set(key("USER", user.id), {
      exists: true,
      title: displayUserName(user.name),
      excerpt: `계정 상태: ${user.status}`,
      href: `/profiles/${user.id}`,
    });
  }
  for (const card of bloodlineCards) {
    const state =
      card.status === "REVOKED" ? "[회수] " : card.status === "INACTIVE" ? "[숨김] " : "";
    snapshots.set(key("BLOODLINE_CARD", card.id), {
      exists: true,
      title: `${state}${card.name}${card.cardType === "LINE" ? " (출처 카드)" : ""}`,
      excerpt: toExcerpt(card.description || card.speciesType || ""),
      // 숨김·회수된 혈통은 상세가 404(BLOODLINE_REVOKED)라 링크를 주지 않는다.
      href: state ? null : bloodlineCardPath(card.id),
    });
  }
  for (const [roomId, messages] of Array.from(roomMessages.entries())) {
    const last = messages[messages.length - 1];
    snapshots.set(key("CHAT_ROOM", roomId), {
      exists: true,
      title: `채팅방 #${roomId}`,
      excerpt: last ? toExcerpt(last.message) : "",
      href: null,
      messages,
    });
  }

  return reports.map(
    (report) =>
      snapshots.get(key(report.targetType, report.targetId)) ??
      missingSnapshot(report.targetType)
  );
}

export async function buildTargetSnapshot(report: SnapshotSource): Promise<ReportTargetSnapshot> {
  const [snapshot] = await buildTargetSnapshots([report]);
  return snapshot;
}

// ------------------------------------------------------------
// 신고 처리 — 콘텐츠 조치(없음·숨김·삭제)와 사용자 조치(없음·경고·기간 정지·영구 정지)를 따로 골라 한 번에 적용한다.
// 기획: 앱 docs/prd/admin-moderation.md F-4
// ------------------------------------------------------------

export const REPORT_CONTENT_ACTIONS = ["NONE", "HIDE", "DELETE"] as const;
export type ReportContentAction = (typeof REPORT_CONTENT_ACTIONS)[number];

export const isReportContentAction = (value: unknown): value is ReportContentAction =>
  typeof value === "string" && (REPORT_CONTENT_ACTIONS as readonly string[]).includes(value);

export const REPORT_USER_ACTION_TYPES = ["WARNING", "SUSPENSION", "BAN"] as const;
export type ReportUserActionType = (typeof REPORT_USER_ACTION_TYPES)[number];

export const isReportUserActionType = (value: unknown): value is ReportUserActionType =>
  typeof value === "string" && (REPORT_USER_ACTION_TYPES as readonly string[]).includes(value);

export interface ReportUserAction {
  type: ReportUserActionType;
  days?: number | null;
  /** 없으면 신고 사유에서 고른 기본값 */
  reasonCode?: string | null;
  messageToUser?: string | null;
  internalNote?: string | null;
}

export interface ResolveReportInput {
  reportId: number;
  actorId: number;
  decision: Exclude<ReportStatus, "OPEN">;
  contentAction: ReportContentAction;
  userAction: ReportUserAction | null;
  /** 같은 대상의 다른 열린 신고도 같은 결과로 닫는다 */
  closeSameTarget: boolean;
  note: string | null;
}

export interface ResolveReportResult {
  /** 닫은 신고 id(처리한 신고가 맨 앞) */
  reportIds: number[];
  /** 실제로 적용한 콘텐츠 조치. 콘텐츠가 이미 없었으면 null */
  contentAction: ModerationActionType | null;
  contentSkipped: boolean;
  /** 제재는 적용됐지만 콘텐츠 조치가 오류로 실패했다(신고는 처리됨, 운영자가 다시 시도해야 함) */
  contentFailed: boolean;
  sanctionId: number | null;
}

export class ReportResolutionError extends Error {
  constructor(
    readonly status: 400 | 404 | 409,
    message: string,
    readonly code: string
  ) {
    super(message);
    this.name = "ReportResolutionError";
    Object.setPrototypeOf(this, ReportResolutionError.prototype);
  }
}

export const isReportResolutionError = (error: unknown): error is ReportResolutionError =>
  error instanceof ReportResolutionError;

/** 구 처리 방식(resolutionAction) 값. 새 처리도 읽기 호환을 위해 가장 가까운 값을 남긴다. */
export function legacyResolutionAction(
  contentApplied: boolean,
  userActionType: ReportUserActionType | null
): ReportAction {
  const banned = userActionType === "BAN";
  if (contentApplied && banned) return "REMOVE_CONTENT_AND_BAN";
  if (contentApplied) return "REMOVE_CONTENT";
  if (banned) return "BAN_USER";
  return "NONE";
}

/** 구 처리 방식 action 을 새 조치로 옮긴다. 콘텐츠 삭제는 숨김으로 바꿨다(증거 보존, PRD AC-5). */
export function fromLegacyAction(action: ReportAction): {
  contentAction: ReportContentAction;
  userAction: ReportUserAction | null;
} {
  const content = action === "REMOVE_CONTENT" || action === "REMOVE_CONTENT_AND_BAN";
  const ban = action === "BAN_USER" || action === "REMOVE_CONTENT_AND_BAN";
  return { contentAction: content ? "HIDE" : "NONE", userAction: ban ? { type: "BAN" } : null };
}

/** 사유가 '기타'로 떨어졌는데 메시지가 없을 때 쓰는 대상자 메시지 */
const DEFAULT_OTHER_MESSAGE = "운영정책 위반이 확인되었어요.";

/**
 * 신고 대상 콘텐츠에 숨김·삭제를 적용한다. 이미 없는 콘텐츠면 건너뛴다.
 * 상품 삭제는 isDeleted(소프트), 혈통 삭제는 회수(REVOKED, 하위 출처 카드 포함)다(libs/server/moderation).
 * @returns 적용했으면 true, 콘텐츠가 이미 없어 건너뛰었으면 false
 */
export async function applyReportContentAction(
  report: Pick<Report, "id" | "targetType" | "targetId">,
  contentAction: Exclude<ReportContentAction, "NONE">,
  actorId: number,
  reasonCode: string | null
): Promise<boolean> {
  const { targetType } = report;
  if (
    targetType !== "POST" &&
    targetType !== "COMMENT" &&
    targetType !== "PRODUCT" &&
    targetType !== "BLOODLINE_CARD"
  ) {
    throw new Error(`콘텐츠 조치를 적용할 수 없는 신고 대상입니다: ${targetType}`);
  }
  try {
    await applyModeration({
      actorId,
      targetType,
      targetId: report.targetId,
      action: contentAction === "HIDE" ? "hide" : "delete",
      reasonCode,
      reportId: report.id,
    });
    return true;
  } catch (error) {
    // 이미 지워진 콘텐츠면 조치는 건너뛰고 신고 처리만 이어간다(E-5).
    if (isModerationTargetNotFound(error)) return false;
    throw error;
  }
}

async function sanctionTargetOf(report: Pick<Report, "targetType" | "targetId">): Promise<SanctionTarget | null> {
  const type = report.targetType;
  if (type !== "POST" && type !== "COMMENT" && type !== "PRODUCT" && type !== "BLOODLINE_CARD") return null;
  const snapshot = await buildTargetSnapshot(report);
  // 관리자용 스냅샷 제목의 상태 접두어([숨김]·[삭제]·[회수])는 대상자 화면에 보이지 않게 뺀다.
  const title = snapshot.exists ? snapshot.title.replace(/^\[(숨김|삭제|회수)\]\s*/, "") : null;
  return {
    type,
    id: report.targetId,
    title,
    excerpt: snapshot.exists ? snapshot.excerpt.slice(0, 100) : null,
  };
}

export async function resolveReport(input: ResolveReportInput): Promise<ResolveReportResult> {
  const { reportId, actorId, decision, contentAction, userAction } = input;
  if (decision === "REJECTED" && (contentAction !== "NONE" || userAction)) {
    throw new ReportResolutionError(400, "신고 기각에는 조치를 함께 적용할 수 없어요.", "REJECT_WITH_ACTION");
  }

  const report = await client.report.findUnique({
    where: { id: reportId },
    select: { id: true, status: true, targetType: true, targetId: true, reportedUserId: true, reporterId: true, reason: true },
  });
  if (!report) throw new ReportResolutionError(404, "신고를 찾을 수 없어요.", "REPORT_NOT_FOUND");
  if (report.status !== "OPEN") {
    throw new ReportResolutionError(409, "이미 처리된 신고예요.", "REPORT_ALREADY_RESOLVED");
  }
  if (contentAction !== "NONE" && !isRemovableReportTarget(report.targetType)) {
    throw new ReportResolutionError(400, "채팅·사용자 신고에는 콘텐츠 조치를 적용할 수 없어요.", "CONTENT_ACTION_NOT_ALLOWED");
  }

  const reasonCode = userAction?.reasonCode || defaultSanctionReason(report.reason);
  const sanctionDraft = userAction
    ? {
        ...userAction,
        reasonCode,
        messageToUser:
          userAction.messageToUser?.trim() || (reasonCode === "OTHER" ? DEFAULT_OTHER_MESSAGE : null),
      }
    : null;
  if (sanctionDraft) {
    const invalid = validateSanctionDraft(sanctionDraft);
    if (invalid) throw new ReportResolutionError(400, invalid, "INVALID_SANCTION");
  }

  const now = new Date();
  // 먼저 이 신고를 차지한다. 동시에 같은 신고를 처리하면 하나만 이어가고 나머지는 409(AC-18).
  const claimed = await client.report.updateMany({
    where: { id: reportId, status: "OPEN" },
    data: { status: decision, resolvedBy: actorId, resolvedAt: now, resolutionNote: input.note },
  });
  if (claimed.count === 0) {
    throw new ReportResolutionError(409, "이미 처리된 신고예요.", "REPORT_ALREADY_RESOLVED");
  }

  let sanctionId: number | null = null;
  let contentApplied = false;
  let contentFailed = false;
  try {
    // 사용자 조치를 먼저 한다(409 로 거절될 수 있어, 콘텐츠만 바뀌고 끝나는 일을 줄인다).
    if (sanctionDraft) {
      const { sanction } = await issueSanction({
        actorId,
        userId: report.reportedUserId,
        ...sanctionDraft,
        reportId,
        target: await sanctionTargetOf(report),
      });
      sanctionId = sanction.id;
      // 제재는 되돌릴 수 없으니 바로 신고에 남긴다(뒤 단계가 실패해도 어떤 제재였는지 남도록).
      await client.report.update({
        where: { id: reportId },
        data: { sanctionId, resolutionAction: legacyResolutionAction(false, sanctionDraft.type) },
      });
    }
  } catch (error) {
    // 제재가 거절·실패하면 아무 조치도 없었으니 신고를 다시 연다.
    if (sanctionId == null) {
      await client.report.updateMany({
        where: { id: reportId, status: decision, resolvedBy: actorId },
        data: { status: "OPEN", resolvedBy: null, resolvedAt: null, resolutionNote: null },
      });
    }
    if (isSanctionError(error)) throw new ReportResolutionError(error.status, error.message, error.code);
    throw error;
  }

  if (contentAction !== "NONE") {
    try {
      contentApplied = await applyReportContentAction(report, contentAction, actorId, reasonCode);
    } catch (error) {
      if (sanctionId == null) {
        // 아무 조치도 적용되지 않았으니 신고를 다시 열고 오류를 그대로 올린다.
        await client.report.updateMany({
          where: { id: reportId, status: decision, resolvedBy: actorId },
          data: { status: "OPEN", resolvedBy: null, resolvedAt: null, resolutionNote: null },
        });
        throw error;
      }
      // 제재는 이미 적용됐다. 신고는 처리된 것으로 두고 콘텐츠 조치만 실패했다고 알린다(운영자가 목록에서 다시 숨긴다).
      console.error("Report content action failed after sanction:", error);
      contentFailed = true;
    }
  }

  const appliedContentAction: ModerationActionType | null = contentApplied
    ? contentAction === "HIDE"
      ? "HIDE"
      : "DELETE"
    : null;
  const resultData = {
    resolutionAction: legacyResolutionAction(contentApplied, userAction?.type ?? null),
    contentAction: appliedContentAction,
    sanctionId,
  };
  await client.report.update({ where: { id: reportId }, data: resultData });

  const others = input.closeSameTarget
    ? await client.report.findMany({
        where: { targetType: report.targetType, targetId: report.targetId, status: "OPEN", id: { not: reportId } },
        select: { id: true, reporterId: true },
      })
    : [];
  if (others.length > 0) {
    await client.report.updateMany({
      where: { id: { in: others.map((row) => row.id) }, status: "OPEN" },
      data: {
        status: decision,
        resolvedBy: actorId,
        resolvedAt: now,
        resolutionNote: input.note,
        ...resultData,
      },
    });
  }

  // 신고자 알림은 조치가 하나 이상 적용됐을 때만(기각·조치 없음은 보내지 않는다, 2026-10-09 결정).
  if (decision === "RESOLVED" && (contentApplied || sanctionId != null)) {
    const reporterIds = Array.from(new Set([report.reporterId, ...others.map((row) => row.reporterId)]));
    for (const reporterId of reporterIds) {
      await createNotification({
        type: "MODERATION",
        userId: reporterId,
        senderId: actorId,
        message: reporterActionMessage(report.targetType),
      });
    }
  }

  return {
    reportIds: [reportId, ...others.map((row) => row.id)],
    contentAction: appliedContentAction,
    contentSkipped: contentAction !== "NONE" && !contentApplied && !contentFailed,
    contentFailed,
    sanctionId,
  };
}
