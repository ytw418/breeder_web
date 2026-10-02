import { NextApiRequest, NextApiResponse } from "next";

import withHandler from "@libs/server/withHandler";
import { withAuth } from "@libs/server/auth";
import { checkNickname, type NicknameCheckResult } from "@libs/server/nickname";
import type { NicknameRejectCode } from "@libs/shared/nickname";

export interface CheckNameResponse {
  success: boolean;
  available: boolean;
  /** available=false 일 때 화면에 보여줄 사유 */
  reason?: string;
  code?: NicknameRejectCode;
  /** 확인 자체가 실패했을 때(500)의 안내 문구 */
  message?: string;
}

/**
 * GET /api/users/check-name?name=
 * 프로필 수정 화면의 닉네임 실시간 확인. 본인의 현재 닉네임은 사용 가능으로 본다.
 * 입력 오류(빈 값·길이·예약어)도 200 + available=false 로 돌려준다. 저장 시 POST /api/users/me 가 다시 판정한다.
 */
async function handler(req: NextApiRequest, res: NextApiResponse<CheckNameResponse>) {
  res.setHeader("Cache-Control", "private, no-store");

  const raw = Array.isArray(req.query.name) ? req.query.name[0] : req.query.name;
  let result: NicknameCheckResult;
  try {
    result = await checkNickname(raw, req.user!.id);
  } catch (error) {
    // DB 오류 원문(접속 정보 등)을 응답에 싣지 않는다. 앱은 실패를 '확인 안 됨'으로 보고 저장 때 다시 판정한다.
    console.error("[check-name] 닉네임 확인 실패", error);
    return res.status(500).json({
      success: false,
      available: false,
      message: "닉네임 확인에 실패했습니다.",
    });
  }

  if (result.available) {
    return res.status(200).json({ success: true, available: true });
  }
  return res.status(200).json({
    success: true,
    available: false,
    code: result.code,
    reason: result.reason,
  });
}

export default withAuth(
  withHandler({
    methods: ["GET"],
    handler,
    isPrivate: true,
  })
);
