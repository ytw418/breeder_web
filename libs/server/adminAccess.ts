import type { role } from "@prisma/client";
import client from "@libs/server/client";
import { ADMIN_EMAIL_ID_PREFIX, isAdminEmail } from "@libs/shared/adminEmail";

/** 운영자 이메일: 아이디(@ 앞)가 `ytw418` 로 시작하면 운영자다(2026-10-12 사용자 결정). 규칙은 libs/shared/adminEmail.ts. */
export function isWhitelistedAdminEmail(email?: string | null) {
  return isAdminEmail(email);
}

/**
 * 운영자 이메일 계정은 남의 게시글·댓글·분양글·경매도 본인 것처럼 수정·삭제할 수 있다(2026-10-12 사용자 결정, 앱·웹 같음).
 * role 만 ADMIN 인 계정은 숨기기·삭제(moderation)만 되고 여기에 들지 않는다.
 */
export function canEditAnyContent(
  user?: { email?: string | null } | null
) {
  return isWhitelistedAdminEmail(user?.email);
}

export function canRunSensitiveAdminAction(email?: string | null) {
  return isWhitelistedAdminEmail(email);
}

/**
 * withAuth 가 채운 req.user 로 관리자 여부를 DB 조회 없이 판별한다.
 * 상세·프로필 목록처럼 매 요청마다 부르는 읽기 API 에서 쓴다.
 */
export function isModeratorUser(
  user?: { role?: role | null; email?: string | null } | null
) {
  if (!user) return false;
  return (
    user.role === "ADMIN" ||
    user.role === "SUPER_USER" ||
    isWhitelistedAdminEmail(user.email)
  );
}

export async function hasAdminAccess(userId?: number) {
  if (!userId) return false;
  const dbUser = await client.user.findUnique({ where: { id: userId } });
  return isModeratorUser(dbUser);
}

/** 운영자 이메일 계정 id 목록. 운영자 기기로 보내는 푸시(오픈채팅 소식·신고 접수)의 받는 사람이다. */
export async function findAdminUserIds(): Promise<number[]> {
  const candidates = await client.user.findMany({
    where: { email: { startsWith: ADMIN_EMAIL_ID_PREFIX, mode: "insensitive" } },
    select: { id: true, email: true },
  });
  return candidates.filter((user) => isAdminEmail(user.email)).map((user) => user.id);
}
