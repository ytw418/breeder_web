import { NextApiRequest, NextApiResponse } from "next";
import withHandler from "@libs/server/withHandler";
import { runFirstPostWatch } from "@libs/server/firstPostWatch";

interface CronResponse {
  success: boolean;
  posts?: number;
  admins?: number;
  error?: string;
}

/**
 * 새 회원 첫 글이 2시간 넘게 댓글 0개면 운영자에게 알린다(커뮤니티 감사 #20, libs/server/firstPostWatch).
 * 매시 GitHub Actions(.github/workflows/first-post-watch.yml)가 부르고, 하루 한 번 Vercel 크론이 빠진 것을 줍는다.
 * 같은 글은 한 번만 알리므로 여러 번 불러도 된다.
 */
async function handler(req: NextApiRequest, res: NextApiResponse<CronResponse>) {
  const token = process.env.CRON_SECRET;
  const incoming = req.headers.authorization?.replace("Bearer ", "") || req.query.token;

  if (!token || incoming !== token) {
    return res.status(401).json({ success: false, error: "Unauthorized" });
  }

  try {
    const result = await runFirstPostWatch();
    return res.json({ success: true, ...result });
  } catch (error) {
    console.error("[cron][first-post-watch]", error);
    return res.status(500).json({ success: false, error: "새 회원 첫 글 확인에 실패했습니다." });
  }
}

export default withHandler({
  methods: ["GET"],
  handler,
  isPrivate: false,
});
