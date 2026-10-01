import { NextApiRequest, NextApiResponse } from "next";
import withHandler, { ResponseType } from "@libs/server/withHandler";

import client from "@libs/server/client";
import { createUserWithAutomaticBreederPrograms } from "@libs/server/breeder-programs";
import { withAuth } from "@libs/server/auth";
import { issueTokens, toAuthUser, AuthUser } from "@libs/server/jwt";
import { UniqueName } from "@libs/server/UniqueName";
import { findPendingDeletion } from "@libs/server/accountDeletion";
import {
  formatKstDate,
  getLoginBlock,
  liftExpiredSuspension,
  type LoginBlock,
} from "@libs/server/accountStatus";
import type { User } from "@prisma/client";
import { SocialAuthError, verifySocialLogin } from "@libs/server/socialAuth";

export interface LoginReqBody {
  /**
   * 서버가 검증하는 소셜 토큰. kakao=access token, google=Firebase ID 토큰,
   * apple=identityToken. snsId·email 은 이 토큰을 검증한 결과에서만 얻는다.
   */
  token: string;
  /** 보낸 경우 검증된 계정과 같아야 한다(다르면 401). */
  snsId?: string;
  name: string;
  provider: "kakao" | "google" | "apple";
  email?: string | null;
  avatar?: string;
}

export interface LoginResponseType {
  success: boolean;
  error?: string;
  user: AuthUser;
  /** Bearer access 토큰 (Authorization 헤더에 사용) */
  accessToken: string;
  /** access 토큰 만료 시 재발급에 사용하는 refresh 토큰 */
  refreshToken: string;
  /** access 토큰 만료까지 남은 초 */
  expiresIn: number;
}

/**
 * 정지 해제가 경합으로 실패한 뒤 다시 읽은 계정의 차단 응답. ACTIVE 면 null.
 * 그 사이 계정이 없어졌거나 다시 만료 상태로 읽히면 토큰을 내주지 않도록 보수적으로 막는다.
 */
function blockAfterLiftRace(fresh: User | null): LoginBlock | null {
  const block = getLoginBlock(fresh ?? { status: "DELETED", suspendedUntil: null });
  if (block && "lift" in block) {
    return getLoginBlock({ status: fresh!.status, suspendedUntil: null }) as LoginBlock;
  }
  return block;
}

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseType>
) {
  const { token, snsId: claimedSnsId, provider, name } = req.body;
  const validProviders = ["kakao", "google", "apple"] as const;

  if (typeof token !== "string" || !token.trim())
    return res.status(401).json({
      success: false,
      errorCode: "SOCIAL_TOKEN_REQUIRED",
      message: "앱을 최신 버전으로 업데이트한 뒤 다시 로그인해 주세요.",
    });
  if (!name)
    return res
      .status(400)
      .json({ success: false, message: "name is required for login." });
  if (
    typeof provider !== "string" ||
    !validProviders.includes(provider as (typeof validProviders)[number])
  )
    return res
      .status(400)
      .json({ success: false, message: "provider is required for login." });

  let verified;
  try {
    verified = await verifySocialLogin(provider as LoginReqBody["provider"], token);
  } catch (error) {
    if (error instanceof SocialAuthError) {
      return res.status(error.status).json({ success: false, message: error.message });
    }
    console.error("auth.login.verify.fail", error);
    return res
      .status(500)
      .json({ success: false, message: "로그인 확인 중 오류가 발생했습니다." });
  }

  if (claimedSnsId && claimedSnsId !== verified.snsId) {
    return res
      .status(401)
      .json({ success: false, message: "로그인 정보가 일치하지 않습니다." });
  }

  const snsId = verified.snsId;
  const normalizedEmail = verified.email;
  const normalizedAvatar = verified.avatar;

  try {
    // Prisma를 사용하여 해당 snsId로 사용자 찾기
    let user = await client.user.findUnique({
      where: { snsId },
    });

    if (!user) {
      // 탈퇴 후 보관 기간(30일) 중인 소셜 계정은 재가입을 막는다.
      const pending = await findPendingDeletion(snsId);
      if (pending) {
        const message = `탈퇴 처리 중인 계정입니다. ${formatKstDate(pending.purgeAt)} 이후 다시 가입할 수 있어요.`;
        return res.status(403).json({
          success: false,
          errorCode: "ACCOUNT_PENDING_DELETION",
          purgeAt: pending.purgeAt.toISOString(),
          error: message,
          message,
        });
      }

      // 해당 이메일의 사용자가 존재하지 않는 경우 새로운 사용자 생성
      const uniqueName = await UniqueName();
      user = await createUserWithAutomaticBreederPrograms({
        snsId,
        email: normalizedEmail,
        name: uniqueName,
        provider,
        avatar: normalizedAvatar,
      });
    } else {
      // 정지·차단·탈퇴 계정은 토큰을 발급하지 않는다. 기간 정지가 끝났으면 여기서 해제한다.
      const loginBlock = getLoginBlock(user);
      let block: LoginBlock | null = null;
      if (loginBlock && "lift" in loginBlock) {
        if (await liftExpiredSuspension(client, user)) {
          user = { ...user, status: "ACTIVE", suspendedUntil: null };
        } else {
          // 읽은 뒤 상태가 바뀌었다(차단·탈퇴·재정지, 또는 다른 요청이 먼저 해제). 다시 읽어 판정한다.
          const fresh = await client.user.findUnique({ where: { id: user.id } });
          block = blockAfterLiftRace(fresh);
          if (fresh && !block) user = fresh;
        }
      } else {
        block = loginBlock;
      }
      if (block) {
        const { status, ...body } = block;
        return res.status(status).json({ success: false, ...body });
      }

      const updateData: {
        email?: string | null;
        avatar?: string | null;
        provider?: string;
      } = {};

      // Keep social profile data fresh on subsequent logins.
      if (normalizedEmail && user.email !== normalizedEmail) {
        updateData.email = normalizedEmail;
      }
      if (normalizedAvatar && user.avatar !== normalizedAvatar) {
        updateData.avatar = normalizedAvatar;
      }
      if (user.provider !== provider) {
        updateData.provider = provider;
      }

      if (Object.keys(updateData).length > 0) {
        user = await client.user.update({
          where: { id: user.id },
          data: updateData,
        });
      }
    }

    const authUser = toAuthUser(user);
    const { accessToken, refreshToken, expiresIn } = await issueTokens(
      authUser,
      user.tokenVersion
    );

    res.status(200).json({
      success: true,
      user: authUser,
      accessToken,
      refreshToken,
      expiresIn,
    });
  } catch (error) {
    console.error("로그인 중 오류 발생:", error);
    res
      .status(500)
      .json({ success: false, error: "로그인 중 오류가 발생했습니다." });
  }
}
export default withAuth(
  withHandler({ methods: ["POST"], handler, isPrivate: false })
);
