import { NextApiRequest, NextApiResponse } from "next";
import withHandler, { ResponseType } from "@libs/server/withHandler";
import { withAuth } from "@libs/server/auth";
import client from "@libs/server/client";
import { getSanctionSummary, toUserSanctionView, type UserSanctionView } from "@libs/server/sanctions";

export interface MySanctionsResponse {
  success: boolean;
  sanctions: UserSanctionView[];
  recentWarningCount: number;
  recentSuspensionCount: number;
  error?: string;
}

/**
 * 내 제재 내역·확인 처리.
 * - GET → 내 경고·정지·영구 정지·해제 이력(최신순, 최대 50건)
 * - GET ?unacknowledged=1 → 확인 모달에 띄울 미확인 경고·정지(오래된 순). 정지 중에는 이 API 를 부를 수 없으므로
 *   여기 오는 미확인 정지는 끝났거나 해제된 정지다.
 * - PATCH { id } → 확인 처리(acknowledgedAt). 이미 확인했으면 그대로 성공.
 * 응답에는 사유 범주·운영자 메시지만 담고 신고자·내부 메모·운영자 정보는 넣지 않는다(PRD AC-15).
 */

const NOTICE_TYPES = ["WARNING", "SUSPENSION"] as const;
const HISTORY_LIMIT = 50;

async function handler(req: NextApiRequest, res: NextApiResponse<ResponseType>) {
  const userId = req.user!.id;

  if (req.method === "GET") {
    const unacknowledgedOnly = req.query.unacknowledged === "1";
    const [rows, summary] = await Promise.all([
      client.userSanction.findMany({
        where: unacknowledgedOnly
          ? { userId, type: { in: [...NOTICE_TYPES] }, acknowledgedAt: null }
          : { userId },
        orderBy: { createdAt: unacknowledgedOnly ? "asc" : "desc" },
        take: HISTORY_LIMIT,
      }),
      getSanctionSummary(userId),
    ]);
    // 확인 모달의 "최근 180일 경고 n회" 문구에 쓴다. 권장 조치는 운영자용이라 내려주지 않는다.
    return res.json({
      success: true,
      sanctions: rows.map(toUserSanctionView),
      recentWarningCount: summary.recentWarningCount,
      recentSuspensionCount: summary.recentSuspensionCount,
    });
  }

  // PATCH
  const id = Number(req.body?.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ success: false, error: "잘못된 요청이에요." });
  }
  const { count } = await client.userSanction.updateMany({
    where: { id, userId, type: { in: [...NOTICE_TYPES] }, acknowledgedAt: null },
    data: { acknowledgedAt: new Date() },
  });
  if (count === 0) {
    const existing = await client.userSanction.findFirst({
      where: { id, userId, type: { in: [...NOTICE_TYPES] } },
      select: { id: true },
    });
    if (!existing) return res.status(404).json({ success: false, error: "확인할 안내를 찾을 수 없어요." });
  }
  return res.json({ success: true });
}

export default withAuth(
  withHandler({
    methods: ["GET", "PATCH"],
    isPrivate: true,
    handler,
  })
);
