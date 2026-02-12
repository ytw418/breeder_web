import {
  StoredPushSubscription,
  getPushSubscriptionsByUserIds,
  removePushSubscriptionByToken,
} from "@libs/server/pushStore";

export interface PushMessagePayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

const getAbsoluteClickUrl = (url?: string) => {
  const normalized = typeof url === "string" && url.trim().length > 0 ? url.trim() : "/";
  if (normalized.startsWith("http://") || normalized.startsWith("https://")) {
    return normalized;
  }
  const base = process.env.NEXT_PUBLIC_DOMAIN_URL || "https://bredy.app";
  return new URL(normalized, base).toString();
};

const getVapidPublicKeyFromEnv = () =>
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || process.env.VAPID_PUBLIC_KEY || "";

const toMultilinePrivateKey = (value: string) => value.replace(/\\n/g, "\n");

const getServiceAccountFromEnv = () => {
  const rawServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  if (rawServiceAccount) {
    try {
      const parsed = JSON.parse(rawServiceAccount);
      if (
        typeof parsed?.project_id === "string" &&
        typeof parsed?.client_email === "string" &&
        typeof parsed?.private_key === "string"
      ) {
        return {
          projectId: parsed.project_id,
          clientEmail: parsed.client_email,
          privateKey: toMultilinePrivateKey(parsed.private_key),
        };
      }
    } catch (error) {
      console.error("Invalid FIREBASE_SERVICE_ACCOUNT_JSON:", error);
    }
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;
  if (projectId && clientEmail && privateKey) {
    return {
      projectId,
      clientEmail,
      privateKey: toMultilinePrivateKey(privateKey),
    };
  }

  return null;
};

let messagingClient: any | null = null;
let messagingInitAttempted = false;
let messagingInitErrorLogged = false;

const getFirebaseMessaging = () => {
  if (messagingClient) return messagingClient;
  if (messagingInitAttempted) return null;
  messagingInitAttempted = true;

  try {
    // firebase-admin은 서버 런타임에서만 필요하므로 런타임 로드한다.
    const adminApp = require("firebase-admin/app");
    const adminMessaging = require("firebase-admin/messaging");

    const { getApps, initializeApp, cert, applicationDefault } = adminApp;
    const { getMessaging } = adminMessaging;

    if (!getApps().length) {
      const serviceAccount = getServiceAccountFromEnv();
      if (serviceAccount) {
        initializeApp({
          credential: cert(serviceAccount),
        });
      } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        initializeApp({
          credential: applicationDefault(),
        });
      } else {
        return null;
      }
    }

    messagingClient = getMessaging();
    return messagingClient;
  } catch (error) {
    if (!messagingInitErrorLogged) {
      console.error("Failed to initialize Firebase Admin Messaging:", error);
      messagingInitErrorLogged = true;
    }
    return null;
  }
};

const hasFirebaseAdminMessaging = () => Boolean(getFirebaseMessaging());

const getPushConfig = () => {
  const publicKey =
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || process.env.VAPID_PUBLIC_KEY;
  const adminConfigured = hasFirebaseAdminMessaging();

  return {
    publicKey: publicKey || "",
    configured: Boolean(publicKey && adminConfigured),
  };
};

export const getVapidPublicKey = () => getVapidPublicKeyFromEnv();
export const isWebPushConfigured = () => getPushConfig().configured;
export const isFcmPushConfigured = isWebPushConfigured;
export const isFirebaseAdminConfigured = hasFirebaseAdminMessaging;

const isInvalidTokenError = (error: any) => {
  const code = error?.code;
  return (
    code === "messaging/registration-token-not-registered" ||
    code === "messaging/invalid-registration-token"
  );
};

const sendToSingleSubscription = async (
  subscription: StoredPushSubscription,
  payload: PushMessagePayload
) => {
  const messaging = getFirebaseMessaging();
  if (!messaging) {
    throw new Error("Firebase Admin SDK is not configured.");
  }

  const clickUrl = getAbsoluteClickUrl(payload.url);

  try {
    await messaging.send({
      token: subscription.token,
      data: {
        title: payload.title,
        body: payload.body,
        url: clickUrl,
        tag: payload.tag || "default",
      },
      webpush: {
        fcmOptions: {
          link: clickUrl,
        },
        headers: {
          Urgency: "high",
        },
      },
    });
  } catch (error: any) {
    // 더 이상 유효하지 않은 토큰은 저장소에서 즉시 정리한다.
    if (isInvalidTokenError(error)) {
      await removePushSubscriptionByToken(subscription.token);
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
        console.error("Failed to send FCM push:", error);
      })
    )
  );
};
