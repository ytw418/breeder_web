import {
  StoredPushSubscription,
  getPushSubscriptionsByUserIds,
  removePushSubscriptionByEndpoint,
} from "@libs/server/pushStore";

// web-push는 CJS 패키지이므로 require를 사용해 타입/번들 충돌을 줄인다.
const webpush = require("web-push");

export interface PushMessagePayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

// .env 값을 모아 웹푸시 구성 상태를 계산한다.
const getPushConfig = () => {
  const publicKey =
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;

  return {
    publicKey: publicKey || "",
    privateKey: privateKey || "",
    subject: subject || "",
    configured: Boolean(publicKey && privateKey && subject),
  };
};

let configuredOnce = false;
// setVapidDetails는 프로세스 기준 1회만 호출하면 충분하다.
const ensureWebPushConfigured = () => {
  if (configuredOnce) return;
  const config = getPushConfig();
  if (!config.configured) return;
  webpush.setVapidDetails(config.subject, config.publicKey, config.privateKey);
  configuredOnce = true;
};

export const getVapidPublicKey = () => getPushConfig().publicKey;
export const isWebPushConfigured = () => getPushConfig().configured;

const sendToSingleSubscription = async (
  subscription: StoredPushSubscription,
  payload: PushMessagePayload
) => {
  ensureWebPushConfigured();
  const message = JSON.stringify(payload);

  try {
    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: subscription.keys,
      },
      message
    );
  } catch (error: any) {
    // 만료된 구독은 저장소에서 정리한다.
    if (error?.statusCode === 404 || error?.statusCode === 410) {
      await removePushSubscriptionByEndpoint(subscription.endpoint);
      return;
    }
    throw error;
  }
};

export const sendPushToUsers = async (
  userIds: number[],
  payload: PushMessagePayload
) => {
  // 서버 설정이 없으면 조용히 종료한다(운영 중 단계적 적용 용도).
  if (!isWebPushConfigured()) return;

  // 동일 유저가 중복으로 들어와도 중복 발송하지 않도록 정규화한다.
  const uniqueUserIds = Array.from(new Set(userIds));
  const subscriptions = await getPushSubscriptionsByUserIds(uniqueUserIds);
  if (!subscriptions.length) return;

  // 일부 단말 전송 실패가 전체 전송을 막지 않도록 개별 실패를 흡수한다.
  await Promise.all(
    subscriptions.map((subscription) =>
      sendToSingleSubscription(subscription, payload).catch((error) => {
        console.error("Failed to send web push:", error);
      })
    )
  );
};
