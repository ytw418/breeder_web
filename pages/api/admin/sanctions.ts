import { NextApiRequest, NextApiResponse } from "next";
import withHandler, { ResponseType } from "@libs/server/withHandler";
import { withAuth } from "@libs/server/auth";
import client from "@libs/server/client";
import { hasAdminAccess } from "@libs/server/adminAccess";
import { isModerationTargetType } from "@libs/server/moderation";
import { isSanctionError, issueSanction, type SanctionTarget } from "@libs/server/sanctions";
import { isSanctionType } from "@libs/shared/sanction";

/**
 * 관리자 사용자 제재.
 * - POST { userId, type: WARNING|SUSPENSION|BAN|LIFT, days?, reasonCode, messageToUser?, internalNote?,
 *          reportId?, target?: { type, id, title?, excerpt? } } → 201 { sanction, user }
 * - GET ?userId= → 그 사용자의 제재 이력(최신순, 운영자 이름·내부 메모 포함)
 * 기획: 앱 docs/prd/admin-moderation.md
 */

const toPositiveInt = (value: unknown) => {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
};

function parseTarget(raw: unknown): SanctionTarget | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  const id = toPositiveInt(value.id);
  if (!isModerationTargetType(value.type) || !id) return null;
  return {
    type: value.type,
    id,
    title: typeof value.title === "string" ? value.title.slice(0, 200) : null,
    excerpt: typeof value.excerpt === "string" ? value.excerpt.slice(0, 100) : null,
  };
}

async function handler(req: NextApiRequest, res: NextApiResponse<ResponseType>) {
  const { user } = req;
  if (!(await hasAdminAccess(user?.id))) {
    return res.status(403).json({ success: false, error: "접근 권한이 없습니다." });
  }

  if (req.method === "GET") {
    const userId = toPositiveInt(req.query.userId);
    if (!userId) return res.status(400).json({ success: false, error: "userId 가 필요합니다." });
    const sanctions = await client.userSanction.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { actor: { select: { id: true, name: true } } },
    });
    return res.json({ success: true, sanctions });
  }

  const userId = toPositiveInt(req.body?.userId);
  if (!userId || !isSanctionType(req.body?.type)) {
    return res.status(400).json({ success: false, error: "userId 와 제재 유형이 필요합니다." });
  }

  try {
    const result = await issueSanction({
      actorId: user!.id,
      userId,
      type: req.body.type,
      days: req.body.days == null ? null : Number(req.body.days),
      reasonCode: req.body.reasonCode,
      messageToUser: typeof req.body.messageToUser === "string" ? req.body.messageToUser : null,
      internalNote: typeof req.body.internalNote === "string" ? req.body.internalNote : null,
      reportId: toPositiveInt(req.body.reportId),
      target: parseTarget(req.body.target),
    });
    return res.status(201).json({ success: true, sanction: result.sanction, user: result.user });
  } catch (error) {
    if (isSanctionError(error)) {
      return res.status(error.status).json({ success: false, error: error.message, errorCode: error.code });
    }
    throw error;
  }
}

export default withAuth(
  withHandler({
    methods: ["GET", "POST"],
    isPrivate: false,
    handler,
  })
);
