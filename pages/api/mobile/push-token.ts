import { NextApiRequest, NextApiResponse } from "next";
import withHandler, { ResponseType } from "@libs/server/withHandler";
import { withApiSession } from "@libs/server/withSession";
import {
  removeMobilePushSubscription,
  upsertMobilePushSubscription,
} from "@libs/server/mobile/pushStore";

interface MobilePushTokenRequestBody {
  token?: string;
  platform?: string;
  appVersion?: string;
  userAgent?: string;
}

interface MobilePushTokenResponse extends ResponseType {
  success: boolean;
}

const normalizeToken = (value: unknown) => (typeof value === "string" ? value.trim() : "");

async function handler(
  req: NextApiRequest,
  res: NextApiResponse<MobilePushTokenResponse>
) {
  const userId = req.session.user?.id;
  if (!userId) {
    return res.status(401).json({
      success: false,
      message: "로그인이 필요합니다.",
    });
  }

  if (req.method === "POST") {
    const body = req.body as MobilePushTokenRequestBody;
    const token = normalizeToken(body.token);

    if (!token) {
      return res.status(400).json({
        success: false,
        message: "Expo 푸시 토큰이 필요합니다.",
      });
    }

    await upsertMobilePushSubscription(userId, {
      token,
      platform: typeof body.platform === "string" ? body.platform : "android",
      appVersion: typeof body.appVersion === "string" ? body.appVersion : undefined,
      userAgent: typeof body.userAgent === "string" ? body.userAgent : undefined,
    });

    return res.json({ success: true });
  }

  if (req.method === "DELETE") {
    const body = (req.body || {}) as MobilePushTokenRequestBody;
    const token = normalizeToken(body.token);
    await removeMobilePushSubscription(userId, token || undefined);
    return res.json({ success: true });
  }

  return res.status(405).json({
    success: false,
    message: "지원하지 않는 메서드입니다.",
  });
}

export default withApiSession(
  withHandler({
    methods: ["POST", "DELETE"],
    handler,
    isPrivate: true,
  })
);
