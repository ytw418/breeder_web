import { NextApiRequest, NextApiResponse } from "next";
import withHandler from "@libs/server/withHandler";
import { runQuestionHelpAlerts } from "@libs/server/reengagement";

/**
 * 재방문 알림(앱 docs/prd/reengagement-push.md, libs/server/reengagement.ts).
 * 매일 12시 반(KST): 6시간~3일 된 답 없는 질문을 그 분야 글을 써 본 회원에게 알린다. 질문마다 한 번이라 다시 불러도 된다.
 * 21시~8시(KST)에는 아무것도 보내지 않는다.
 */
async function handler(req: NextApiRequest, res: NextApiResponse) {
  const token = process.env.CRON_SECRET;
  const incoming = req.headers.authorization?.replace("Bearer ", "") || req.query.token;
  if (!token || incoming !== token) {
    return res.status(401).json({ success: false, error: "Unauthorized" });
  }
  try {
    const result = await runQuestionHelpAlerts();
    return res.json({ success: true, ...result });
  } catch (error) {
    console.error("[cron][question-help]", error);
    return res.status(500).json({ success: false, error: "답 없는 질문 알림 처리에 실패했습니다." });
  }
}

export default withHandler({ methods: ["GET"], handler, isPrivate: false });
