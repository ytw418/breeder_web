import { NextApiRequest, NextApiResponse } from "next";
import withHandler from "@libs/server/withHandler";
import { withApiSession } from "@libs/server/withSession";
import { getPushSubscriptionsByUserIds } from "@libs/server/pushStore";
import { isWebPushConfigured, sendPushToUsers } from "@libs/server/push";

interface PushTestResponse {
  success: boolean;
  error?: string;
  configured: boolean;
  subscriptionCount: number;
}

async function handler(req: NextApiRequest, res: NextApiResponse<PushTestResponse>) {
  try {
    const userId = req.session.user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: "로그인이 필요합니다.",
        configured: false,
        subscriptionCount: 0,
      });
    }

    const configured = isWebPushConfigured();
    const subscriptions = await getPushSubscriptionsByUserIds([userId]);

    if (!configured) {
      return res.status(400).json({
        success: false,
        error:
          "FCM 푸시 환경변수(VAPID 공개키 + Firebase Admin 서비스계정)가 없어 테스트 알림을 보낼 수 없습니다.",
        configured,
        subscriptionCount: subscriptions.length,
      });
    }

    if (!subscriptions.length) {
      return res.status(400).json({
        success: false,
        error: "현재 계정에 등록된 FCM 토큰이 없습니다. 설정에서 먼저 알림을 켜주세요.",
        configured,
        subscriptionCount: 0,
      });
    }

    await sendPushToUsers([userId], {
      title: "브리디 테스트 알림",
      body: "FCM 웹 푸시 연결이 정상 동작합니다.",
      url: "/notifications",
      tag: `push-test-${Date.now()}`,
    });

    return res.json({
      success: true,
      configured,
      subscriptionCount: subscriptions.length,
    });
  } catch (error) {
    console.error("Push test API error:", error);
    return res.status(500).json({
      success: false,
      error: "테스트 알림 전송 중 오류가 발생했습니다.",
      configured: isWebPushConfigured(),
      subscriptionCount: 0,
    });
  }
}

export default withApiSession(
  withHandler({
    methods: ["POST"],
    handler,
    isPrivate: true,
  })
);
