import { NextApiRequest, NextApiResponse } from "next";

import withHandler, { ResponseType } from "@libs/server/withHandler";
import { withAuth } from "@libs/server/auth";
import client from "@libs/server/client";
import {
  AuthUser,
  issueTokens,
  toAuthUser,
  verifyRefreshToken,
} from "@libs/server/jwt";
import { getLoginBlock, isSuspendedStatus } from "@libs/server/accountStatus";
import { withRestrictionNotice } from "@libs/server/sanctions";

export interface RefreshReqBody {
  refreshToken: string;
}

export interface RefreshResponseType {
  success: boolean;
  error?: string;
  accessToken?: string;
  refreshToken?: string;
  expiresIn?: number;
  user?: AuthUser;
}

/**
 * refresh 토큰을 검증하고 새 access/refresh 토큰을 발급한다.
 * stateless 방식이므로 서버에 토큰을 저장하지 않으며, 매 호출마다 DB 에서
 * 최신 유저 정보를 읽어 access 토큰에 담는다(sliding 갱신).
 * 정지·차단·탈퇴로 tokenVersion 이 올라갔으면 refresh 토큰의 tv 와 달라 401 이 된다.
 * 단 지금 정지·영구 정지 중이면 401 대신 로그인과 같은 403 차단 응답(errorCode·사유·해제일)을 준다.
 * 쓰는 중에 정지된 앱·웹이 말없이 로그아웃하지 않고 이용 제한 안내를 보여 주게 하려는 것이다(PRD F-6).
 * 구버전 앱은 refresh 의 4xx 를 모두 로그아웃으로 처리하므로 그대로 로그아웃된다.
 */
async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseType>
) {
  const { refreshToken } = (req.body || {}) as RefreshReqBody;

  if (!refreshToken || typeof refreshToken !== "string") {
    return res
      .status(400)
      .json({ success: false, message: "refreshToken 이 필요합니다." });
  }

  const payload = await verifyRefreshToken(refreshToken);
  if (!payload?.sub) {
    return res
      .status(401)
      .json({ success: false, message: "유효하지 않은 refresh 토큰입니다." });
  }

  const userId = Number(payload.sub);
  const user = await client.user.findUnique({ where: { id: userId } });

  if (user && (user.status === "BANNED" || isSuspendedStatus(user.status))) {
    const block = getLoginBlock(user);
    // 정지 기간이 끝났으면 다시 로그인해야 한다(로그인이 정지를 풀고 새 토큰을 준다).
    if (block && !("lift" in block)) {
      const { status, ...body } = await withRestrictionNotice(block, user.id);
      return res.status(status).json({ success: false, ...body });
    }
  }

  if (
    !user ||
    user.status !== "ACTIVE" ||
    user.tokenVersion !== (payload.tv ?? 0)
  ) {
    return res
      .status(401)
      .json({ success: false, message: "유효하지 않은 사용자입니다." });
  }

  const authUser = toAuthUser(user);
  const tokens = await issueTokens(authUser, user.tokenVersion);

  return res.status(200).json({
    success: true,
    user: authUser,
    ...tokens,
  });
}

export default withAuth(
  withHandler({ methods: ["POST"], handler, isPrivate: false })
);
