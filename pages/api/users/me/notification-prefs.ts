import { NextApiRequest, NextApiResponse } from "next";
import type { Prisma } from "@prisma/client";
import withHandler, { ResponseType } from "@libs/server/withHandler";
import { withAuth } from "@libs/server/auth";
import client from "@libs/server/client";
import { mergePrefs, normalizePrefs, type NotificationPrefs } from "@libs/shared/notificationPrefs";

export interface NotificationPrefsResponse {
  success: boolean;
  prefs: NotificationPrefs;
  error?: string;
}

/**
 * 내 알림 종류·방해 금지 설정(앱 docs/prd/notifications.md §알림 종류, 2026-10-21).
 * - GET → 지금 설정(저장된 적이 없으면 모두 켜짐·방해 금지 꺼짐)
 * - PATCH { chat?, trade?, reaction?, follow?, news?, quiet?: { enabled?, start?, end?, exemptChatTrade? } }
 *   → 보낸 값만 바꾸고(틀린 값은 버린다) 바뀐 전체 설정을 돌려준다.
 * 이 설정은 푸시만 거른다. 알림 목록에는 그대로 쌓인다(libs/server/notificationGate).
 */
async function handler(req: NextApiRequest, res: NextApiResponse<ResponseType>) {
  const userId = req.user!.id;
  const current = await client.user.findUnique({
    where: { id: userId },
    select: { notificationPrefs: true },
  });
  if (!current) {
    return res.status(404).json({ success: false, error: "사용자를 찾을 수 없습니다." });
  }

  if (req.method === "GET") {
    return res.json({ success: true, prefs: normalizePrefs(current.notificationPrefs) });
  }

  const body = req.body;
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return res.status(400).json({ success: false, error: "잘못된 요청이에요." });
  }
  const prefs = mergePrefs(current.notificationPrefs, body);
  await client.user.update({
    where: { id: userId },
    data: { notificationPrefs: prefs as unknown as Prisma.InputJsonValue },
  });
  return res.json({ success: true, prefs });
}

export default withAuth(
  withHandler({
    methods: ["GET", "PATCH"],
    handler,
    isPrivate: true,
  })
);
