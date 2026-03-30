import { NextApiRequest, NextApiResponse } from "next";

import withHandler, { ResponseType } from "@libs/server/withHandler";
import { getFoundingBreederCount } from "@libs/server/breeder-programs";
import { FOUNDING_BREEDER_LIMIT } from "@libs/shared/breeder-program";

export interface FoundingCountResponseType {
  success: boolean;
  count: number;
  limit: number;
  remaining: number;
}

async function handler(
  _req: NextApiRequest,
  res: NextApiResponse<ResponseType>
) {
  try {
    const count = await getFoundingBreederCount();
    const remaining = Math.max(0, FOUNDING_BREEDER_LIMIT - count);

    return res.json({
      success: true,
      count,
      limit: FOUNDING_BREEDER_LIMIT,
      remaining,
    });
  } catch {
    return res.status(500).json({
      success: false,
      error: "창립 브리더 현황 조회 중 오류가 발생했습니다.",
    });
  }
}

export default withHandler({
  methods: ["GET"],
  handler,
  isPrivate: false,
});
