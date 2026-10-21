import { NextApiRequest, NextApiResponse } from "next";
import withHandler from "@libs/server/withHandler";
import { runWeeklyDigest } from "@libs/server/weeklyDigest";

interface CronResponse {
  success: boolean;
  audience?: number;
  sent?: number;
  error?: string;
}

/** 월요일 오전 10시(KST) 3~10일 안 온 회원에게 주간 요약 푸시 한 통(커뮤니티 감사 #22, libs/server/weeklyDigest). */
async function handler(req: NextApiRequest, res: NextApiResponse<CronResponse>) {
  const token = process.env.CRON_SECRET;
  const incoming = req.headers.authorization?.replace("Bearer ", "") || req.query.token;

  if (!token || incoming !== token) {
    return res.status(401).json({ success: false, error: "Unauthorized" });
  }

  try {
    const result = await runWeeklyDigest();
    return res.json({ success: true, ...result });
  } catch (error) {
    console.error("[cron][weekly-digest]", error);
    return res.status(500).json({ success: false, error: "주간 요약 발송에 실패했습니다." });
  }
}

export default withHandler({
  methods: ["GET"],
  handler,
  isPrivate: false,
});
