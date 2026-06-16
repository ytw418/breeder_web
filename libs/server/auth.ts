import { NextApiHandler, NextApiRequest, NextApiResponse } from "next";

import { AuthUser, extractBearerToken, verifyAccessToken } from "./jwt";

/**
 * Authorization 헤더의 Bearer access 토큰을 검증해 req.user 를 채우는 래퍼.
 *
 * 기존 iron-session 기반 `withApiSession` 을 대체한다. 토큰이 없거나 유효하지
 * 않으면 req.user 는 undefined 로 둔다(인증 여부 판단은 withHandler 의
 * isPrivate 가 담당).
 */
export function withAuth(handler: NextApiHandler): NextApiHandler {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    const token = extractBearerToken(req.headers.authorization);
    if (token) {
      const payload = await verifyAccessToken(token);
      if (payload?.user) {
        req.user = payload.user;
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
