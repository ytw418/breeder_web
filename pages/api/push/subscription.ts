import { NextApiRequest, NextApiResponse } from "next";
import withHandler from "@libs/server/withHandler";
import { withApiSession } from "@libs/server/withSession";
import {
  PushSubscriptionPayload,
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
  subscription?: PushSubscriptionPayload;
  endpoint?: string;
}

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<PushSubscriptionStatusResponse>
) {
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
    // 설정 화면에서 토글 상태를 즉시 렌더링할 수 있도록 현재 구독 여부를 반환한다.
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
      // 서버 키 미설정 상태에서 구독을 허용하면 사용자에게 성공처럼 보여 혼란을 준다.
      if (!configured || !vapidPublicKey) {
        return res.status(400).json({
          success: false,
          error: "푸시 서버 설정이 완료되지 않았습니다.",
          configured: false,
          subscribed: false,
          vapidPublicKey: "",
        });
      }

      const subscription = body.subscription;
      if (
        !subscription?.endpoint ||
        !subscription?.keys?.p256dh ||
        !subscription?.keys?.auth
      ) {
        return res.status(400).json({
          success: false,
          error: "구독 정보가 올바르지 않습니다.",
          configured,
          subscribed: false,
          vapidPublicKey,
        });
      }

      await upsertPushSubscription(userId, subscription);
      return res.json({
        success: true,
        configured,
        subscribed: true,
        vapidPublicKey,
      });
    }

    if (body.action === "unsubscribe") {
      // endpoint가 없으면 해당 사용자의 모든 구독을 정리한다(브라우저 초기화 등 예외 케이스 대응).
      await removePushSubscription(userId, body.endpoint);
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
}

export default withApiSession(
  withHandler({
    methods: ["GET", "POST"],
    handler,
    isPrivate: true,
  })
);
