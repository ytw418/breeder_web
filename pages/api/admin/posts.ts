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

/** '답 없는 글' 필터가 보는 기간 */
const UNANSWERED_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

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
    const { page = 1, limit = 20, keyword, hidden, unanswered } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    // hidden=1 이면 운영자가 숨긴 것만 본다.
    // unanswered=1 이면 운영진이 첫 댓글을 달 글: 최근 7일, 보이는 댓글이 없는 글(공지·숨김 제외).
    const filter =
      unanswered === "1"
        ? {
            isHidden: false,
            OR: [{ category: null }, { category: { not: "공지" } }],
            createdAt: { gte: new Date(Date.now() - UNANSWERED_WINDOW_MS) },
            comments: { none: { isHidden: false, deletedAt: null } },
          }
        : hidden === "1"
          ? { isHidden: true }
          : {};
    const where = keyword
      ? {
          ...filter,
          AND: [
            {
              OR: [
                { title: { contains: String(keyword) } },
                { description: { contains: String(keyword) } },
                { user: { name: { contains: String(keyword) } } },
              ],
            },
          ],
        }
      : filter;

    const [posts, totalCount] = await Promise.all([
      client.post.findMany({
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
              Likes: true,
              comments: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: Number(limit),
        skip,
      }),
      client.post.count({ where }),
    ]);

    return res.json({
      success: true,
      posts,
      totalCount,
      totalPages: Math.ceil(totalCount / Number(limit)),
    });
  }

  if (req.method === "POST") {
    const { action, title, description, image } = req.body;

    if (action !== "create_notice") {
      return res
        .status(400)
        .json({ success: false, error: "지원하지 않는 action 입니다." });
    }

    if (!title || !description) {
      return res
        .status(400)
        .json({ success: false, error: "제목과 내용을 입력해주세요." });
    }

    const normalizedTitle = String(title).trim();
    const finalTitle = normalizedTitle.startsWith("[공지]")
      ? normalizedTitle
      : `[공지] ${normalizedTitle}`;

    const post = await client.post.create({
      data: {
        title: finalTitle,
        description: String(description),
        image: image || "",
        category: "공지",
        user: {
          connect: {
            id: user?.id,
          },
        },
      },
    });

    return res.json({ success: true, post });
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
        targetType: "POST",
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
    methods: ["GET", "POST", "DELETE"],
    isPrivate: false,
    handler,
  })
);
