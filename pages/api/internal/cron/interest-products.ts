import { NextApiRequest, NextApiResponse } from "next";
import withHandler from "@libs/server/withHandler";
import { runInterestProductsDigest } from "@libs/server/reengagement";

/**
 * 재방문 알림(앱 docs/prd/reengagement-push.md, libs/server/reengagement.ts).
 * 매일 19시(KST): 관심 분야를 고정한 회원에게 24시간 안 새 분양글 수를 한 통으로 알린다. 하루 1통이라 다시 불러도 된다.
 * 21시~8시(KST)에는 아무것도 보내지 않는다.
 */
async function handler(req: NextApiRequest, res: NextApiResponse) {
  const token = process.env.CRON_SECRET;
  const incoming = req.headers.authorization?.replace("Bearer ", "") || req.query.token;
  if (!token || incoming !== token) {
    return res.status(401).json({ success: false, error: "Unauthorized" });
  }
  try {
    const result = await runInterestProductsDigest();
    return res.json({ success: true, ...result });
  } catch (error) {
    console.error("[cron][interest-products]", error);
    return res.status(500).json({ success: false, error: "관심 분야 새 분양 알림 처리에 실패했습니다." });
  }
}

export default withHandler({ methods: ["GET"], handler, isPrivate: false });
