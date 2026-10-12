import { NextApiRequest, NextApiResponse } from "next";

import withHandler, { ResponseType } from "@libs/server/withHandler";
import {
  APPLE_STATE_TTL_SECONDS,
  buildAppleAuthorizeUrl,
  createAppleNonce,
  getAppleOAuthConfig,
  hashAppleNonce,
  sanitizeAppleNextPath,
  signAppleState,
} from "@libs/server/appleOAuth";

export interface AppleStartResponseType {
  success: boolean;
  /** 브라우저(웹)·Custom Tab(앱)으로 열 Apple 로그인 주소 */
  authorizeUrl: string;
  /** 원래 nonce. 로그인 API 에 그대로 보낸다(주소에는 해시만 실린다). */
  nonce: string;
}

/**
 * GET /api/auth/apple/start?target=web|app&next=/경로
 * Apple 웹 로그인(Android 앱·웹)을 시작한다. 흐름은 libs/server/appleOAuth.ts 참고.
 */
async function handler(req: NextApiRequest, res: NextApiResponse<ResponseType>) {
  res.setHeader("Cache-Control", "no-store");

  const { target, next } = req.query;
  if (target !== "web" && target !== "app") {
    return res.status(400).json({ success: false, message: "target 은 web 또는 app 이어야 합니다." });
  }

  const config = getAppleOAuthConfig();
  if (!config) {
    console.error("auth.apple.start.config_missing");
    return res.status(500).json({
      success: false,
      errorCode: "APPLE_CONFIG",
      message: "Apple 로그인 설정이 없습니다.",
    });
  }

  const nonce = createAppleNonce();
  const nonceHash = hashAppleNonce(nonce);
  const state = signAppleState({
    t: target,
    n: sanitizeAppleNextPath(next),
    h: nonceHash,
    exp: Math.floor(Date.now() / 1000) + APPLE_STATE_TTL_SECONDS,
  });

  return res.status(200).json({
    success: true,
    authorizeUrl: buildAppleAuthorizeUrl({ ...config, state, nonceHash }),
    nonce,
  });
}

export default withHandler({ methods: ["GET"], handler, isPrivate: false });
