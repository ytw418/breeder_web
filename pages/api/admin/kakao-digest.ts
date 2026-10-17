import { NextApiRequest, NextApiResponse } from "next";
import withHandler, { ResponseType } from "@libs/server/withHandler";
import { withAuth } from "@libs/server/auth";
import { hasAdminAccess } from "@libs/server/adminAccess";
import { buildAllKakaoDigests, notifyKakaoDigestReady } from "@libs/server/kakaoDigest";

interface KakaoDigestAdminItem {
  key: string;
  label: string;
  emoji: string;
  text: string;
  counts: {
    endingAuctions: number;
    newProducts: number;
    popularPosts: number;
    openQuestions: number;
  };
}

interface KakaoDigestAdminResponse extends ResponseType {
  digests?: KakaoDigestAdminItem[];
  recipients?: number;
  error?: string;
}

/**
 * 오픈채팅방 소식 문구. GET 은 미리보기, POST 는 운영자 기기로 지금 알림 보내기.
 * 크론(`/api/internal/cron/kakao-digest`)이 매일 아침 같은 알림을 보낸다.
 */
async function handler(
  req: NextApiRequest,
  res: NextApiResponse<KakaoDigestAdminResponse>
) {
  const isAdmin = await hasAdminAccess(req.user?.id);
  if (!isAdmin) {
    return res.status(403).json({ success: false, error: "접근 권한이 없습니다." });
  }

  const digests = await buildAllKakaoDigests();
  if (req.method === "POST") {
    try {
      const recipients = await notifyKakaoDigestReady(digests);
      return res.json({ success: true, recipients });
    } catch (error) {
      console.error("[admin][kakao-digest] push", error);
      return res.status(502).json({ success: false, error: "알림 발송에 실패했습니다." });
    }
  }

  return res.json({
    success: true,
    digests: digests.map(({ room, data, text }) => ({
      key: room.key,
      label: room.label,
      emoji: room.emoji,
      text,
      counts: {
        endingAuctions: data.endingAuctions.length,
        newProducts: data.newProductCount,
        popularPosts: data.popularPosts.length,
        openQuestions: data.openQuestions.length,
      },
    })),
  });
}

export default withAuth(
  withHandler({
    methods: ["GET", "POST"],
    isPrivate: false,
    handler,
  })
);
