import { NextApiRequest, NextApiResponse } from "next";
import withHandler from "@libs/server/withHandler";
import { processRankingAlerts } from "@libs/server/growth-jobs";

interface CronResponse {
  success: boolean;
  error?: string;
}

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<CronResponse>
) {
  const token = process.env.CRON_SECRET;
  const incoming = req.headers.authorization?.replace("Bearer ", "") || req.query.token;

  if (!token || incoming !== token) {
    return res.status(401).json({ success: false, error: "Unauthorized" });
  }

  try {
    await processRankingAlerts();
    return res.json({ success: true });
  } catch (error) {
    console.error("[cron][ranking-alerts]", error);
    return res.status(500).json({ success: false, error: "랭킹 알림 처리에 실패했습니다." });
  }
}

export default withHandler({
  methods: ["GET"],
  handler,
  isPrivate: false,
});
