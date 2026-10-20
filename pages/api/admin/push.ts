import { NextApiRequest, NextApiResponse } from "next";
import withHandler, { ResponseType } from "@libs/server/withHandler";
import { withAuth } from "@libs/server/auth";
import { hasAdminAccess } from "@libs/server/adminAccess";
import {
  countBroadcastAudience,
  parseBroadcastInput,
  recentBroadcastAt,
  sendAdminBroadcast,
} from "@libs/server/adminBroadcast";

/**
 * 운영자 푸시 발송(/admin/push, 커뮤니티 감사 #22, libs/server/adminBroadcast).
 * POST { audience: "all" | "inactive", inactiveDays?, title, body, url, dryRun }
 * - dryRun: 보낼 대상 수(total)와 기기가 있는 수(withDevice), 오늘 이미 보냈는지(lastSentAt)만 돌려준다.
 * - 보내기: 24시간 안에 보낸 적이 있으면 429. 아니면 알림 목록 + 푸시.
 */
async function handler(req: NextApiRequest, res: NextApiResponse<ResponseType>) {
  const { user } = req;
  if (!(await hasAdminAccess(user?.id))) {
    return res.status(403).json({ success: false, error: "접근 권한이 없습니다." });
  }

  const parsed = parseBroadcastInput((req.body ?? {}) as Record<string, unknown>);
  if (!parsed.ok) {
    return res.status(400).json({ success: false, error: parsed.message });
  }

  const now = new Date();
  const lastSentAt = await recentBroadcastAt(now);
  if (req.body?.dryRun) {
    const counts = await countBroadcastAudience(parsed.value, now);
    return res.json({ success: true, ...counts, lastSentAt });
  }
  if (lastSentAt) {
    return res.status(429).json({
      success: false,
      error: "운영자 푸시는 하루 한 번만 보낼 수 있어요. 24시간 뒤에 다시 보내 주세요.",
      lastSentAt,
    });
  }

  const result = await sendAdminBroadcast({ senderId: user!.id, input: parsed.value, now });
  return res.json({ success: true, ...result });
}

export default withAuth(
  withHandler({
    methods: ["POST"],
    isPrivate: false,
    handler,
  })
);
