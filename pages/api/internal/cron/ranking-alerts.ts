import { NextApiRequest, NextApiResponse } from "next";
import withHandler from "@libs/server/withHandler";
import { processRankingAlerts } from "@libs/server/growth-jobs";
import { refreshTitleKeys } from "@libs/server/breederTitles";

interface CronResponse {
  success: boolean;
  error?: string;
  /** 대표 칭호 갱신 결과(실패하면 null). */
  titles?: { checked: number; updated: number } | null;
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
    // 하루 한 번 대표 칭호(User.titleKey)를 다시 고른다. 실패해도 알림 처리 결과는 그대로 둔다.
    const titles = await refreshTitleKeys().catch((error) => {
      console.error("[cron][ranking-alerts][titles]", error);
      return null;
    });
    return res.json({ success: true, titles });
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
