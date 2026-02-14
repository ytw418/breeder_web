import { NextApiRequest, NextApiResponse } from "next";
import withHandler from "@libs/server/withHandler";
import { withApiSession } from "@libs/server/withSession";
import {
  isUserPushSubscribed,
  removePushSubscription,
  upsertPushSubscription,
} from "@libs/server/pushStore";
import { getVapidPublicKey, isWebPushConfigured } from "@libs/server/push";

interface PushSubscriptionStatusResponse {
  success: boolean;
  error?: string;
  configured: boolean;
  subscribed: boolean;
  vapidPublicKey: string;
}

interface PushSubscriptionUpsertBody {
  action: "subscribe" | "unsubscribe";
  token?: string;
  userAgent?: string;
}

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<PushSubscriptionStatusResponse>
) {
  try {
    const userId = req.session.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: "로그인이 필요합니다.",
        configured: false,
        subscribed: false,
        vapidPublicKey: "",
      });
    }

    const configured = isWebPushConfigured();
    const vapidPublicKey = getVapidPublicKey();

    if (req.method === "GET") {
      // 설정 화면 최초 렌더 시 필요한 상태(configured/subscribed/vapidPublicKey)를 반환한다.
      const subscribed = await isUserPushSubscribed(userId);
      return res.json({
        success: true,
        configured,
        subscribed,
        vapidPublicKey,
      });
    }

    if (req.method === "POST") {
      const body = req.body as PushSubscriptionUpsertBody;

      if (body.action === "subscribe") {
        // 서버 설정 미완료 상태에서는 구독 저장 자체를 막아 UX 혼선을 방지한다.
        if (!configured || !vapidPublicKey) {
          return res.status(400).json({
            success: false,
            error:
              "FCM/VAPID 푸시 서버 설정(Firebase Admin 서비스계정 포함)이 완료되지 않았습니다.",
            configured: false,
            subscribed: false,
            vapidPublicKey: "",
          });
        }

        const token = typeof body.token === "string" ? body.token.trim() : "";
        if (!token) {
          return res.status(400).json({
            success: false,
            error: "FCM 토큰이 올바르지 않습니다.",
            configured,
            subscribed: false,
            vapidPublicKey,
          });
        }

        await upsertPushSubscription(userId, {
          token,
          userAgent: body.userAgent,
        });
        return res.json({
          success: true,
          configured,
          subscribed: true,
          vapidPublicKey,
        });
      }

      if (body.action === "unsubscribe") {
        // token 미전달 시 유저의 전체 토큰을 정리해 브라우저 초기화 케이스를 흡수한다.
        await removePushSubscription(
          userId,
          typeof body.token === "string" ? body.token.trim() : undefined
        );
        return res.json({
          success: true,
          configured,
          subscribed: false,
          vapidPublicKey,
        });
      }
    }

    return res.status(400).json({
      success: false,
      error: "요청 형식이 올바르지 않습니다.",
      configured,
      subscribed: false,
      vapidPublicKey,
    });
  } catch (error) {
    console.error("Push subscription API error:", error);
    return res.status(500).json({
      success: false,
      error: "푸시 구독 처리 중 오류가 발생했습니다.",
      configured: isWebPushConfigured(),
      subscribed: false,
      vapidPublicKey: getVapidPublicKey(),
    });
  }
}

export default withApiSession(
  withHandler({
    methods: ["GET", "POST"],
    handler,
    isPrivate: true,
  })
);
