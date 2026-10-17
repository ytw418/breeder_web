import { NextApiRequest, NextApiResponse } from "next";
import withHandler from "@libs/server/withHandler";
import { notifyEndedDebates, sendDebateDigestPush } from "@libs/server/debate";

interface CronResponse {
  success: boolean;
  notified?: number;
  pushed?: number;
  error?: string;
}

/**
 * 하루 한 번(20:00 KST): 끝났는데 결과 알림을 안 만든 토론을 처리하고,
 * 최근 24시간 결과 알림을 받은 사람에게 묶음 푸시 한 통(앱 docs/prd/live-talk.md §4.4).
 */
async function handler(req: NextApiRequest, res: NextApiResponse<CronResponse>) {
  const token = process.env.CRON_SECRET;
  const incoming = req.headers.authorization?.replace("Bearer ", "") || req.query.token;
  if (!token || incoming !== token) {
    return res.status(401).json({ success: false, error: "Unauthorized" });
  }
  try {
    const notified = await notifyEndedDebates();
    const pushed = await sendDebateDigestPush();
    return res.json({ success: true, notified, pushed });
  } catch (error) {
    console.error("[cron][debate-digest]", error);
    return res.status(500).json({ success: false, error: "토론 결과 알림 처리에 실패했습니다." });
  }
}

export default withHandler({ methods: ["GET"], handler, isPrivate: false });
