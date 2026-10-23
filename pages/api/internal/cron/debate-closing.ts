import { NextApiRequest, NextApiResponse } from "next";
import withHandler from "@libs/server/withHandler";
import { runDebateClosingAlerts } from "@libs/server/reengagement";

/**
 * 재방문 알림(앱 docs/prd/reengagement-push.md, libs/server/reengagement.ts).
 * 매시(GitHub Actions .github/workflows/reengagement-hourly.yml): 1시간 안에 끝나는 HOT 토론을 아직 안 고른 관심 분야 회원에게 알린다. 토론마다 한 번이라 여러 번 불러도 된다.
 * 21시~8시(KST)에는 아무것도 보내지 않는다.
 */
async function handler(req: NextApiRequest, res: NextApiResponse) {
  const token = process.env.CRON_SECRET;
  const incoming = req.headers.authorization?.replace("Bearer ", "") || req.query.token;
  if (!token || incoming !== token) {
    return res.status(401).json({ success: false, error: "Unauthorized" });
  }
  try {
    const result = await runDebateClosingAlerts();
    return res.json({ success: true, ...result });
  } catch (error) {
    console.error("[cron][debate-closing]", error);
    return res.status(500).json({ success: false, error: "토론 마감 알림 처리에 실패했습니다." });
  }
}

export default withHandler({ methods: ["GET"], handler, isPrivate: false });
