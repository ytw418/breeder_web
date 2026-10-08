import { NextApiRequest, NextApiResponse } from "next";
import withHandler, { ResponseType } from "@libs/server/withHandler";
import { withAuth } from "@libs/server/auth";
import client from "@libs/server/client";
import { hasAdminAccess } from "@libs/server/adminAccess";
import {
  MODERATION_TARGET_NOT_FOUND_MESSAGE,
  applyModeration,
  isModerationTargetNotFound,
} from "@libs/server/moderation";
import { isSanctionReasonCode } from "@libs/shared/sanction";

async function handler(req: NextApiRequest, res: NextApiResponse<ResponseType>) {
  const {
    user,
  } = req;

  const isAdmin = await hasAdminAccess(user?.id);
  if (!isAdmin) {
    return res
      .status(403)
      .json({ success: false, error: "접근 권한이 없습니다." });
  }

  if (req.method === "GET") {
    const { page = 1, limit = 20, keyword, hidden } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    // hidden=1 이면 운영자가 숨긴 것만 본다.
    const hiddenOnly = hidden === "1" ? { isHidden: true } : {};
    const where = keyword
      ? {
          ...hiddenOnly,
          OR: [
            { name: { contains: String(keyword) } },
            { description: { contains: String(keyword) } },
            { user: { name: { contains: String(keyword) } } },
          ],
        }
      : hiddenOnly;

    const [products, totalCount] = await Promise.all([
      client.product.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              avatar: true,
            },
          },
          _count: {
            select: {
              favs: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: Number(limit),
        skip,
      }),
      client.product.count({ where }),
    ]);

    return res.json({
      success: true,
      products,
      totalCount,
      totalPages: Math.ceil(totalCount / Number(limit)),
    });
  }

  if (req.method === "DELETE") {
    const { id } = req.query;
    if (!id) {
      return res.status(400).json({ success: false, error: "ID가 필요합니다." });
    }

    // 삭제도 운영자 조치 기록(ModerationLog)과 작성자 알림을 남긴다. 사유는 필수다(앱 docs/prd/admin-moderation.md S-4).
    const { reasonCode, reason } = req.query;
    if (!isSanctionReasonCode(reasonCode)) {
      return res.status(400).json({ success: false, error: "삭제 사유를 골라 주세요." });
    }
    try {
      await applyModeration({
        actorId: user!.id,
        targetType: "PRODUCT",
        targetId: Number(id),
        action: "delete",
        reasonCode,
        reason: typeof reason === "string" ? reason : null,
      });
    } catch (error) {
      if (isModerationTargetNotFound(error)) {
        return res.status(404).json({ success: false, error: MODERATION_TARGET_NOT_FOUND_MESSAGE });
      }
      throw error;
    }

    return res.json({ success: true });
  }
}

export default withAuth(
  withHandler({
    methods: ["GET", "DELETE"],
    isPrivate: false,
    handler,
  })
);
