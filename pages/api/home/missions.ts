import { NextApiRequest, NextApiResponse } from "next";
import withHandler from "@libs/server/withHandler";
import { withAuth } from "@libs/server/auth";
import { getUserMissionSummary } from "@libs/server/growth";
import type { MissionProgressItem } from "@libs/shared/ranking";

/**
 * GET /api/home/missions — 로그인 홈 '이번 주 미션'(2026-10-21 감사 #29).
 * 홈 피드는 공개 캐시(scope=public)라 미션 요약을 싣지 않아 따로 부른다. 진행도는 서버가 글·댓글·입찰 때 쌓는 그대로다.
 */
export interface HomeMissionsResponse {
  success: boolean;
  missions: MissionProgressItem[];
  error?: string;
}

async function handler(req: NextApiRequest, res: NextApiResponse<HomeMissionsResponse>) {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ success: false, missions: [], error: "로그인이 필요합니다." });
  }
  try {
    const missions = await getUserMissionSummary(userId);
    res.setHeader("Cache-Control", "private, no-store");
    return res.json({ success: true, missions });
  } catch (error) {
    console.error("[home][missions]", error);
    return res.status(500).json({ success: false, missions: [], error: "이번 주 미션을 불러오지 못했습니다." });
  }
}

export default withAuth(
  withHandler({
    methods: ["GET"],
    handler,
    isPrivate: true,
  })
);
