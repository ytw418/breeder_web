import { NextApiRequest, NextApiResponse } from "next";
import withHandler, { ResponseType } from "@libs/server/withHandler";
import { withApiSession } from "@libs/server/withSession";

/** 기존 기록 등록 응답 타입 (하위호환 유지) */
export interface CreateRecordResponse {
  success: boolean;
  error?: string;
  isNewRecord?: boolean;
}

async function handler(req: NextApiRequest, res: NextApiResponse<ResponseType>) {
  if (req.method === "POST") {
    return res.status(400).json({
      success: false,
      error:
        "기네스북은 심사 기반으로 변경되었습니다. /guinness 페이지에서 신청해주세요.",
    });
  }
}

export default withApiSession(
  withHandler({ methods: ["POST"], handler, isPrivate: true })
);

