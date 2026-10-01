import type { Prisma, PrismaClient, User, UserStatus } from "@prisma/client";

/**
 * 계정 상태(정지·차단) 전환과 로그인 차단 판정.
 * - 정지·차단은 tokenVersion 을 올려 이미 발급된 access/refresh 토큰을 즉시 무효화한다.
 * - 기간 정지(SUSPENDED_*)는 suspendedUntil 에 만료 시각을 두고, 로그인 때 지났으면 ACTIVE 로 되돌린다(cron 불필요).
 * - 탈퇴(DELETED)는 개인정보 분리 보관이 필요해 accountDeletion.deleteAccount 가 담당한다.
 */

type Db = PrismaClient | Prisma.TransactionClient;
type SuspendedStatus = "SUSPENDED_7D" | "SUSPENDED_30D";

const DAY_MS = 24 * 60 * 60 * 1000;
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

export const SUSPENSION_DAYS: Record<SuspendedStatus, number> = {
  SUSPENDED_7D: 7,
  SUSPENDED_30D: 30,
};

const isSuspendedStatus = (status: UserStatus): status is SuspendedStatus =>
  status === "SUSPENDED_7D" || status === "SUSPENDED_30D";

/** 기간 정지의 만료 시각. 기간 정지가 아니면 null */
export function suspensionEndsAt(status: UserStatus, now: Date = new Date()): Date | null {
  if (!isSuspendedStatus(status)) return null;
  return new Date(now.getTime() + SUSPENSION_DAYS[status] * DAY_MS);
}

/**
 * 관리자·신고 처리에서 계정 상태를 바꾼다.
 * ACTIVE 가 아니면 tokenVersion 을 올려 모든 기기의 토큰을 끊는다.
 * 탈퇴(DELETED) 계정은 개인정보를 분리한 행이라 건드리지 않는다(신고 BAN 이 탈퇴 계정을 되살리지 않게).
 * @returns 상태를 바꿨으면 true, 대상이 없거나 탈퇴 계정이면 false
 */
export async function setUserStatus(
  db: Db,
  userId: number,
  status: Exclude<UserStatus, "DELETED">,
  now: Date = new Date()
): Promise<boolean> {
  const data =
    status === "ACTIVE"
      ? { status, suspendedUntil: null }
      : {
          status,
          suspendedUntil: suspensionEndsAt(status, now),
          tokenVersion: { increment: 1 },
        };

  const { count } = await db.user.updateMany({
    where: { id: userId, status: { not: "DELETED" } },
    data,
  });
  return count > 0;
}

/**
 * 로그인 때 만료된 기간 정지를 푼다.
 * 읽은 뒤 관리자가 차단·탈퇴·재정지했으면 덮어쓰지 않도록, 읽은 상태 그대로이고 만료 시각이 지났을 때만 바꾼다.
 * @returns 해제했으면 true, 그 사이 상태가 바뀌어 해제하지 않았으면 false
 */
export async function liftExpiredSuspension(
  db: Db,
  user: Pick<User, "id" | "status">,
  now: Date = new Date()
): Promise<boolean> {
  const { count } = await db.user.updateMany({
    where: { id: user.id, status: user.status, suspendedUntil: { lte: now } },
    data: { status: "ACTIVE", suspendedUntil: null },
  });
  return count > 0;
}

/** KST 기준 'YYYY.MM.DD' */
export function formatKstDate(date: Date): string {
  return new Date(date.getTime() + KST_OFFSET_MS)
    .toISOString()
    .slice(0, 10)
    .replace(/-/g, ".");
}

export type LoginBlock = {
  status: 403;
  errorCode: "ACCOUNT_BANNED" | "ACCOUNT_SUSPENDED" | "ACCOUNT_DELETED";
  /** 웹 LoginClient 는 error, 앱 ApiError 는 error||message 를 읽어 둘 다 같은 문구를 담는다. */
  error: string;
  message: string;
  suspendedUntil?: string;
};

const block = (
  errorCode: LoginBlock["errorCode"],
  text: string,
  extra: Pick<LoginBlock, "suspendedUntil"> = {}
): LoginBlock => ({ status: 403, errorCode, error: text, message: text, ...extra });

/**
 * 로그인 가능 여부.
 * - ACTIVE → null(통과)
 * - 기간 정지가 끝났으면 → { lift: true } (호출부가 ACTIVE 로 되돌린 뒤 진행)
 * - 그 외 → 403 응답에 쓸 LoginBlock
 */
export function getLoginBlock(
  user: Pick<User, "status" | "suspendedUntil">,
  now: Date = new Date()
): LoginBlock | { lift: true } | null {
  switch (user.status) {
    case "ACTIVE":
      return null;
    case "BANNED":
      return block("ACCOUNT_BANNED", "이용이 영구 정지된 계정이에요.");
    case "DELETED":
      return block("ACCOUNT_DELETED", "탈퇴 처리된 계정이에요.");
    case "SUSPENDED_7D":
    case "SUSPENDED_30D": {
      const until = user.suspendedUntil;
      if (!until) return block("ACCOUNT_SUSPENDED", "이용이 정지된 계정이에요.");
      if (until.getTime() <= now.getTime()) return { lift: true };
      return block(
        "ACCOUNT_SUSPENDED",
        `이용이 정지된 계정이에요. ${formatKstDate(until)} 이후 다시 로그인할 수 있어요.`,
        { suspendedUntil: until.toISOString() }
      );
    }
    default:
      return block("ACCOUNT_BANNED", "이용이 영구 정지된 계정이에요.");
  }
}
