import { NextApiRequest, NextApiResponse } from "next";
import { withDetailRevalidation } from "@libs/server/pageRevalidation";
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
import { newcomerSince } from "@libs/shared/newcomer";
import { toPostPlainText } from "@libs/shared/post-body";
import { recentBroadcastAt, sendAdminBroadcast } from "@libs/server/adminBroadcast";

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
    const { page = 1, limit = 20, keyword, hidden, unanswered, newcomer } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    // hidden=1 이면 운영자가 숨긴 것만 본다.
    // unanswered=1 이면 운영진이 첫 댓글을 달 글: 최근 7일, 보이는 댓글이 없는 글(공지·숨김 제외).
    // newcomer=1 이면 가입 7일 안 회원의 글만(커뮤니티 감사 #20 '새 회원 첫 글'). 위 둘과 같이 건다.
    const baseFilter =
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
    const filter =
      newcomer === "1" ? { ...baseFilter, user: { createdAt: { gte: newcomerSince() } } } : baseFilter;
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
              createdAt: true,
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
    const { action, title, description, image, sendPush } = req.body;

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

    // '푸시도 보내기'는 운영자 푸시와 같은 하루 1회 상한을 쓴다. 이미 보냈으면 공지도 만들지 않고 알린다.
    if (sendPush && (await recentBroadcastAt())) {
      return res.status(429).json({
        success: false,
        error: "오늘은 이미 운영자 푸시를 보냈어요(하루 1회). '푸시도 보내기'를 끄고 등록해 주세요.",
      });
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

    // 공지 푸시(커뮤니티 감사 #22): 전체에게 제목 = 공지 제목, 누르면 공지 글.
    const push = sendPush
      ? await sendAdminBroadcast({
          senderId: user!.id,
          input: {
            audience: "all",
            inactiveDays: 0,
            title: normalizedTitle.replace(/^\[공지\]\s*/, "").slice(0, 40) || "새 공지",
            body: toPostPlainText(String(description)).replace(/\s+/g, " ").trim().slice(0, 100) || "새 공지가 올라왔어요",
            url: `/posts/${post.id}`,
          },
        })
      : null;

    return res.json({ success: true, post, push });
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
    handler: withDetailRevalidation(handler, (req) => [{ type: "POST", id: Number(req.query.id) }]),
  })
);
