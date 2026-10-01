import { NextApiHandler, NextApiRequest, NextApiResponse } from "next";

import client from "./client";
import {
  AccessTokenPayload,
  AuthUser,
  extractBearerToken,
  verifyAccessToken,
} from "./jwt";

/**
 * 서명이 유효한 access 토큰의 유저가 지금도 쓸 수 있는 계정인지 DB 로 확인한다.
 * - status 가 ACTIVE 가 아니거나(정지·차단·탈퇴) tokenVersion 이 토큰의 tv 와 다르면 null.
 * - tv 가 없는 기존 토큰은 tv=0 으로 본다(배포 시 강제 로그아웃 없음).
 * - DB 오류는 fail-closed(null) — 만료 토큰과 같게 취급해 앱은 refresh → 실패 시 로그아웃한다.
 */
export async function resolveAuthUser(
  payload: AccessTokenPayload
): Promise<AuthUser | null> {
  try {
    const current = await client.user.findUnique({
      where: { id: payload.user.id },
      select: { status: true, tokenVersion: true },
    });
    if (!current || current.status !== "ACTIVE") return null;
    if (current.tokenVersion !== (payload.tv ?? 0)) return null;
    return payload.user;
  } catch (error) {
    console.error("[auth] 계정 상태 확인 실패", error);
    return null;
  }
}

/**
 * Authorization 헤더의 Bearer access 토큰을 검증해 req.user 를 채우는 래퍼.
 *
 * 기존 iron-session 기반 `withApiSession` 을 대체한다. 토큰이 없거나 유효하지
 * 않거나, 계정이 정지·차단·탈퇴됐거나 토큰이 무효화됐으면 req.user 는 undefined 로
 * 둔다(인증 여부 판단은 withHandler 의 isPrivate 가 담당). 토큰이 없는 요청은 DB 를
 * 조회하지 않는다.
 */
export function withAuth(handler: NextApiHandler): NextApiHandler {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    const token = extractBearerToken(req.headers.authorization);
    if (token) {
      const payload = await verifyAccessToken(token);
      if (payload?.user) {
        const user = await resolveAuthUser(payload);
        if (user) {
          req.user = user;
        }
      }
    }
    return handler(req, res);
  };
}

// NextApiRequest 에 user 필드를 추가한다.
declare module "next" {
  interface NextApiRequest {
    user?: AuthUser;
  }
}

export type { AuthUser };
