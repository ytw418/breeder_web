import type { NextApiResponse } from "next";
import client from "@libs/server/client";

/**
 * 사용자 차단(UserBlock) 서버 헬퍼.
 * - 콘텐츠 숨김은 단방향: viewer 가 차단한 사람의 글·댓글·상품·경매를 viewer 에게서만 뺀다.
 * - 채팅은 양방향 금지: 어느 쪽이 차단했든 방 생성·메시지 전송을 막는다.
 */

/** 한 사용자가 차단할 수 있는 최대 인원. 목록 쿼리의 `notIn` 배열 크기 상한이기도 하다. */
export const BLOCK_LIMIT = 500;
/** POST /api/blocks/sync 한 번에 받는 최대 인원(앱 로컬 차단 목록 이관용) */
export const BLOCK_SYNC_MAX = 200;

export const CHAT_BLOCKED_MESSAGE = "이 사용자에게는 메시지를 보낼 수 없습니다.";
export const CHAT_PARTNER_DELETED_MESSAGE = "탈퇴한 사용자에게는 메시지를 보낼 수 없습니다.";
/** 어느 쪽이 차단했든 같은 문구로 새 팔로우를 막는다(피차단자에게 차단 사실을 드러내지 않는다). */
export const FOLLOW_BLOCKED_MESSAGE = "이 사용자를 팔로우할 수 없습니다.";

/** viewer 가 차단한 사용자 id 목록(최근 차단 순). */
export async function getBlockedUserIds(viewerId: number): Promise<number[]> {
  const rows = await client.userBlock.findMany({
    where: { blockerId: viewerId },
    select: { blockedId: true },
    orderBy: { createdAt: "desc" },
    take: BLOCK_LIMIT,
  });
  return rows.map((row) => row.blockedId);
}

/** 목록 쿼리에서 `userId: { notIn }` 으로 뺄 작성자 id. 비로그인이면 빈 배열. */
export async function excludedAuthorIds(viewerId?: number): Promise<number[]> {
  if (!viewerId) return [];
  return getBlockedUserIds(viewerId);
}

/** a 와 b 사이의 차단 관계를 한 번의 쿼리로 확인한다. */
export async function getBlockRelation(
  a: number,
  b: number
): Promise<{ blockedByMe: boolean; blockedMe: boolean }> {
  const rows = await client.userBlock.findMany({
    where: {
      OR: [
        { blockerId: a, blockedId: b },
        { blockerId: b, blockedId: a },
      ],
    },
    select: { blockerId: true },
  });
  return {
    blockedByMe: rows.some((row) => row.blockerId === a),
    blockedMe: rows.some((row) => row.blockerId === b),
  };
}

export type CanChatResult =
  | { ok: true }
  | {
      ok: false;
      status: 403;
      error: string;
      errorCode: "CHAT_BLOCKED" | "CHAT_PARTNER_DELETED";
    };

/**
 * userId 가 otherId 와 채팅(방 생성·전송)할 수 있는지.
 * 차단은 방향과 무관하게 같은 문구를 돌려줘 피차단자에게 차단 사실을 드러내지 않는다.
 */
export async function assertCanChat(userId: number, otherId: number): Promise<CanChatResult> {
  const [relation, other] = await Promise.all([
    getBlockRelation(userId, otherId),
    client.user.findUnique({ where: { id: otherId }, select: { status: true } }),
  ]);

  if (relation.blockedByMe || relation.blockedMe) {
    return { ok: false, status: 403, error: CHAT_BLOCKED_MESSAGE, errorCode: "CHAT_BLOCKED" };
  }

  if (!other || other.status === "DELETED") {
    return {
      ok: false,
      status: 403,
      error: CHAT_PARTNER_DELETED_MESSAGE,
      errorCode: "CHAT_PARTNER_DELETED",
    };
  }

  return { ok: true };
}

/**
 * viewer 기준으로 걸러진 응답은 CDN·공유 캐시에 남기지 않는다.
 * 비로그인이면 기존(public) 캐시 헤더를 그대로 둔다.
 *
 * 항상 `Vary: Authorization` 을 단다. CDN 캐시 키에 Authorization 이 들어가
 * 비로그인 요청끼리는 캐시를 공유하고, 토큰이 있는 요청에는 비로그인용(차단 필터 없는)
 * 캐시 항목이 쓰이지 않는다. Vercel CDN 이 Authorization 요청의 캐시 조회를
 * 건너뛰는지에 기대지 않기 위한 장치다.
 */
export function setViewerCacheHeader(
  res: Pick<NextApiResponse, "setHeader">,
  viewerId?: number
) {
  res.setHeader("Vary", "Authorization");
  if (!viewerId) return;
  res.setHeader("Cache-Control", "private, no-store, max-age=0");
}
