import type { ModerationTargetType, Prisma, SanctionType, UserSanction, UserStatus } from "@prisma/client";
import client from "@libs/server/client";
import { isSuspendedStatus, setUserStatus, type LoginBlock } from "@libs/server/accountStatus";
import { createNotification } from "@libs/server/notification";
import {
  LIFT_NOTICE_MESSAGE,
  SANCTION_COUNT_WINDOW_DAYS,
  SANCTION_NOTIFICATION_TARGET,
  banNoticeMessage,
  extendSuspensionUntil,
  recommendSanction,
  sanctionReasonLabel,
  suspensionNoticeMessage,
  validateSanctionDraft,
  warningNoticeMessage,
  type SanctionRecommendation,
} from "@libs/shared/sanction";

/**
 * 사용자 제재(경고·기간 정지·영구 정지·해제)를 적용하고 UserSanction 에 남긴다.
 * 관리자 제재 API·유저 관리·신고 처리(일반·경매)가 모두 이 함수를 거친다.
 *
 * - 제재 행 + 계정 상태 + tokenVersion 은 한 트랜잭션에서 바꾼다.
 * - 기간 정지는 정지 중이면 남은 기간에 더한다. 영구 정지 계정에는 줄 수 없다(먼저 해제).
 * - 대상자 알림(MODERATION)·푸시는 커밋 뒤에 보내고 실패해도 제재를 되돌리지 않는다.
 * 기획: 앱 docs/prd/admin-moderation.md
 */

type Db = Prisma.TransactionClient;

export type SanctionErrorStatus = 400 | 404 | 409;

export class SanctionError extends Error {
  constructor(
    readonly status: SanctionErrorStatus,
    message: string,
    readonly code: string
  ) {
    super(message);
    this.name = "SanctionError";
    // ES5 대상으로 컴파일돼도 instanceof 가 맞게 동작하도록 프로토타입을 고정한다.
    Object.setPrototypeOf(this, SanctionError.prototype);
  }
}

export const isSanctionError = (error: unknown): error is SanctionError => error instanceof SanctionError;

export interface SanctionTarget {
  type: ModerationTargetType;
  id: number;
  title?: string | null;
  excerpt?: string | null;
}

export interface IssueSanctionInput {
  actorId: number;
  userId: number;
  type: SanctionType;
  days?: number | null;
  reasonCode: string;
  messageToUser?: string | null;
  internalNote?: string | null;
  reportId?: number | null;
  auctionReportId?: number | null;
  target?: SanctionTarget | null;
  /** 대상자 알림·푸시를 보낼지(기본 true) */
  notify?: boolean;
  now?: Date;
}

export interface IssueSanctionResult {
  sanction: UserSanction;
  user: { status: UserStatus; suspendedUntil: Date | null };
}

const trimOrNull = (value: string | null | undefined) => {
  const text = value?.trim();
  return text ? text : null;
};

const snapshotOf = (target: SanctionTarget | null | undefined): Prisma.InputJsonValue | undefined => {
  if (!target) return undefined;
  return { title: target.title ?? null, excerpt: target.excerpt ?? null };
};

async function applyStatusChange(
  tx: Db,
  input: IssueSanctionInput,
  user: { status: UserStatus; suspendedUntil: Date | null },
  now: Date
): Promise<{ status: UserStatus; suspendedUntil: Date | null; extended: boolean }> {
  const { userId, type } = input;

  if (type === "WARNING") return { ...user, extended: false };

  if (type === "SUSPENSION") {
    if (user.status === "BANNED") {
      throw new SanctionError(409, "영구 정지된 계정이에요. 먼저 정지를 해제해 주세요.", "USER_BANNED");
    }
    const current = isSuspendedStatus(user.status) ? user.suspendedUntil : null;
    const until = extendSuspensionUntil(now, current, input.days as number);
    // 읽은 상태 그대로일 때만 바꾼다(동시에 다른 운영자가 바꿨으면 409).
    const { count } = await tx.user.updateMany({
      where: { id: userId, status: user.status, suspendedUntil: user.suspendedUntil },
      data: { status: "SUSPENDED", suspendedUntil: until, tokenVersion: { increment: 1 } },
    });
    if (count === 0) {
      throw new SanctionError(409, "다른 운영자가 방금 계정 상태를 바꿨어요. 새로고침 후 다시 시도해 주세요.", "STATUS_CHANGED");
    }
    const extended = Boolean(current && current.getTime() > now.getTime());
    return { status: "SUSPENDED", suspendedUntil: until, extended };
  }

  if (type === "BAN") {
    if (user.status === "BANNED") {
      throw new SanctionError(409, "이미 영구 정지된 계정이에요.", "ALREADY_BANNED");
    }
    await setUserStatus(tx, userId, "BANNED", now);
    return { status: "BANNED", suspendedUntil: null, extended: false };
  }

  // LIFT
  if (user.status !== "BANNED" && !isSuspendedStatus(user.status)) {
    throw new SanctionError(409, "정지 중인 계정이 아니에요.", "NOT_RESTRICTED");
  }
  await setUserStatus(tx, userId, "ACTIVE", now);
  return { status: "ACTIVE", suspendedUntil: null, extended: false };
}

function noticeMessage(
  input: IssueSanctionInput,
  sanction: UserSanction,
  extended: boolean
): string {
  switch (input.type) {
    case "WARNING":
      return warningNoticeMessage(input.reasonCode);
    case "SUSPENSION":
      return suspensionNoticeMessage({
        days: input.days as number,
        until: sanction.endsAt as Date,
        extended,
        reasonCode: input.reasonCode,
      });
    case "BAN":
      return banNoticeMessage(input.reasonCode);
    case "LIFT":
      return LIFT_NOTICE_MESSAGE;
  }
}

export async function issueSanction(input: IssueSanctionInput): Promise<IssueSanctionResult> {
  const now = input.now ?? new Date();
  const invalid = validateSanctionDraft(input);
  if (invalid) throw new SanctionError(400, invalid, "INVALID_SANCTION");
  if (input.actorId === input.userId) {
    throw new SanctionError(400, "자기 계정은 제재할 수 없어요.", "SELF_SANCTION");
  }

  const result = await client.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: input.userId },
      select: { status: true, suspendedUntil: true },
    });
    if (!user) throw new SanctionError(404, "사용자를 찾을 수 없어요.", "USER_NOT_FOUND");
    if (user.status === "DELETED") {
      throw new SanctionError(409, "탈퇴한 계정은 제재할 수 없어요.", "USER_DELETED");
    }

    const next = await applyStatusChange(tx, input, user, now);

    const sanction = await tx.userSanction.create({
      data: {
        userId: input.userId,
        actorId: input.actorId,
        type: input.type,
        reasonCode: input.reasonCode,
        messageToUser: trimOrNull(input.messageToUser),
        internalNote: trimOrNull(input.internalNote),
        days: input.type === "SUSPENSION" ? (input.days as number) : null,
        startsAt: now,
        endsAt: input.type === "SUSPENSION" ? next.suspendedUntil : null,
        reportId: input.reportId ?? null,
        auctionReportId: input.auctionReportId ?? null,
        targetType: input.target?.type ?? null,
        targetId: input.target?.id ?? null,
        snapshot: snapshotOf(input.target),
      },
    });

    return { sanction, next };
  });

  if (input.notify !== false) {
    // createNotification 은 실패를 삼키고 로그만 남긴다(제재는 이미 커밋됨).
    await createNotification({
      type: "MODERATION",
      userId: input.userId,
      senderId: input.actorId,
      message: noticeMessage(input, result.sanction, result.next.extended),
      targetType: SANCTION_NOTIFICATION_TARGET,
      targetId: result.sanction.id,
    });
  }

  return {
    sanction: result.sanction,
    user: { status: result.next.status, suspendedUntil: result.next.suspendedUntil },
  };
}

// ------------------------------------------------------------
// 누적·권장 조치
// ------------------------------------------------------------

const windowStart = (now: Date) => new Date(now.getTime() - SANCTION_COUNT_WINDOW_DAYS * 24 * 60 * 60 * 1000);

export interface SanctionSummary {
  recentWarningCount: number;
  recentSuspensionCount: number;
  recommendation: SanctionRecommendation;
}

/** 관리자 화면 요약 줄: 최근 180일 경고 n · 정지 n · 권장 조치 */
export async function getSanctionSummary(userId: number, now: Date = new Date()): Promise<SanctionSummary> {
  const rows = await client.userSanction.groupBy({
    by: ["type"],
    where: { userId, type: { in: ["WARNING", "SUSPENSION"] }, createdAt: { gte: windowStart(now) } },
    _count: { _all: true },
  });
  const countOf = (type: SanctionType) => rows.find((row) => row.type === type)?._count._all ?? 0;
  const recentWarningCount = countOf("WARNING");
  const recentSuspensionCount = countOf("SUSPENSION");
  return {
    recentWarningCount,
    recentSuspensionCount,
    recommendation: recommendSanction(recentWarningCount + recentSuspensionCount),
  };
}

// ------------------------------------------------------------
// 대상자에게 보이는 형태 — 신고자 정보·내부 메모·운영자 정보는 넣지 않는다(AC-15).
// ------------------------------------------------------------

export interface UserSanctionView {
  id: number;
  type: SanctionType;
  reasonCode: string;
  reasonLabel: string;
  messageToUser: string | null;
  days: number | null;
  startsAt: string;
  endsAt: string | null;
  target: { type: ModerationTargetType; id: number; title: string | null; excerpt: string | null } | null;
  acknowledgedAt: string | null;
  createdAt: string;
}

const readSnapshot = (snapshot: Prisma.JsonValue | null) => {
  if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) return { title: null, excerpt: null };
  const value = snapshot as Record<string, unknown>;
  return {
    title: typeof value.title === "string" ? value.title : null,
    excerpt: typeof value.excerpt === "string" ? value.excerpt : null,
  };
};

export function toUserSanctionView(row: UserSanction): UserSanctionView {
  return {
    id: row.id,
    type: row.type,
    reasonCode: row.reasonCode,
    reasonLabel: sanctionReasonLabel(row.reasonCode),
    messageToUser: row.messageToUser,
    days: row.days,
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt ? row.endsAt.toISOString() : null,
    target:
      row.targetType && row.targetId
        ? { type: row.targetType, id: row.targetId, ...readSnapshot(row.snapshot) }
        : null,
    acknowledgedAt: row.acknowledgedAt ? row.acknowledgedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
  };
}

/**
 * 로그인·refresh 차단 응답에 가장 최근 정지·영구 정지 사유를 붙인다.
 * 이력이 없는 옛 정지는 그대로 둔다(사유 줄 없이 기간만, E-13).
 */
export async function withRestrictionNotice(block: LoginBlock, userId: number): Promise<LoginBlock> {
  const type: SanctionType | null =
    block.errorCode === "ACCOUNT_SUSPENDED" ? "SUSPENSION" : block.errorCode === "ACCOUNT_BANNED" ? "BAN" : null;
  if (!type) return block;
  try {
    const latest = await client.userSanction.findFirst({
      where: { userId, type },
      orderBy: { createdAt: "desc" },
      select: { reasonCode: true, messageToUser: true },
    });
    if (!latest) return block;
    const reasonLabel = sanctionReasonLabel(latest.reasonCode);
    const text = `${block.message} 사유: ${reasonLabel}`;
    return {
      ...block,
      error: text,
      message: text,
      reasonLabel,
      ...(latest.messageToUser ? { messageToUser: latest.messageToUser } : {}),
    };
  } catch (error) {
    // 사유 조회 실패로 로그인 차단 자체가 깨지지 않게 한다.
    console.error("Failed to load restriction notice:", error);
    return block;
  }
}
