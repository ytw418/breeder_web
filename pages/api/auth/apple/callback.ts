import { NextApiRequest, NextApiResponse } from "next";

import withHandler from "@libs/server/withHandler";
import {
  buildAppleAppReturnUrl,
  buildAppleWebErrorUrl,
  peekAppleStateTarget,
  renderAppleWebReturnPage,
  verifyAppleState,
  type AppleLoginTarget,
  type AppleReturnError,
} from "@libs/server/appleOAuth";
import { storeAppleRefreshToken } from "@libs/server/appleTokens";
import { verifySocialLogin } from "@libs/server/socialAuth";

/**
 * POST /api/auth/apple/callback — Apple 이 form_post 로 code·id_token·state 를 보낸다.
 * state·id_token(서명·aud·nonce)을 검증한 뒤 앱(intent 주소)·웹(복귀 페이지)으로 토큰을 넘긴다.
 * 로그인(계정 찾기·정지 안내·토큰 발급)은 클라이언트가 /api/auth/login 으로 한다.
 * code 는 탈퇴 시 철회용 refresh token 으로 바꿔 둔다(code 는 5분 안에 이 서버만 바꿀 수 있다).
 * user(첫 로그인 이름)는 쓰지 않는다 — 이름은 서버가 정한다.
 */
async function handler(req: NextApiRequest, res: NextApiResponse): Promise<void> {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Referrer-Policy", "no-referrer");

  const body = (req.body ?? {}) as Record<string, unknown>;

  const fail = (target: AppleLoginTarget | null, error: AppleReturnError) => {
    res.redirect(
      303,
      target === "app" ? buildAppleAppReturnUrl({ error }) : buildAppleWebErrorUrl(error)
    );
  };

  const state = verifyAppleState(body.state);
  if (!state) {
    fail(peekAppleStateTarget(body.state), "apple_state");
    return;
  }

  if (body.error) {
    fail(state.t, body.error === "user_cancelled_authorize" ? "apple_cancelled" : "apple_token");
    return;
  }

  const idToken = typeof body.id_token === "string" ? body.id_token : "";
  if (!idToken) {
    fail(state.t, "apple_token");
    return;
  }

  let verified;
  try {
    verified = await verifySocialLogin("apple", idToken, { nonceHash: state.h });
  } catch (error) {
    console.error("auth.apple.callback.verify.fail", error);
    fail(state.t, "apple_token");
    return;
  }

  // 실패해도 로그인은 계속한다(키 미설정·Apple 오류). 탈퇴 때 철회할 토큰이 없을 뿐이다.
  if (typeof body.code === "string" && body.code && verified.appleClientId) {
    await storeAppleRefreshToken({
      snsId: verified.snsId,
      code: body.code,
      clientId: verified.appleClientId,
    });
  }

  if (state.t === "app") {
    res.redirect(303, buildAppleAppReturnUrl({ idToken }));
    return;
  }

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.status(200).send(renderAppleWebReturnPage({ idToken, next: state.n }));
}

export default withHandler({ methods: ["POST"], handler, isPrivate: false });
