import { NextApiRequest, NextApiResponse } from "next";
import withHandler from "@libs/server/withHandler";
import { purgeDeletedAccounts } from "@libs/server/accountDeletion";

interface CronResponse {
  success: boolean;
  purged?: number;
  failed?: number;
  error?: string;
}

/** 탈퇴 후 30일 보관 기한이 지난 개인정보 원문을 파기한다. */
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
    const { purged, failed } = await purgeDeletedAccounts();
    return res.json({ success: true, purged, failed });
  } catch (error) {
    console.error("[cron][purge-deleted-users]", error);
    return res.status(500).json({ success: false, error: "탈퇴 개인정보 파기에 실패했습니다." });
  }
}

export default withHandler({
  methods: ["GET"],
  handler,
  isPrivate: false,
});
