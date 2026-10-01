import type { TokenMessage } from "firebase-admin/messaging";

export interface FcmPushContent {
  title: string;
  body: string;
  /** 절대 URL(클릭 시 이동 경로) */
  url: string;
  tag: string;
}

const DEFAULT_CLICK_BASE_URL = "https://bredy.app";

// 알림 클릭 URL은 절대 경로여야 한다. 환경변수에 프로토콜이 빠진 값(예: Preview 도메인)이
// 들어와도 new URL이 throw 하지 않도록 https를 붙여 보정한다.
export const toAbsoluteClickUrl = (url: string | undefined, baseUrl: string | undefined) => {
  const normalized = typeof url === "string" && url.trim().length > 0 ? url.trim() : "/";
  if (normalized.startsWith("http://") || normalized.startsWith("https://")) {
    return normalized;
  }
  const rawBase = (baseUrl || "").trim() || DEFAULT_CLICK_BASE_URL;
  const base = /^https?:\/\//.test(rawBase) ? rawBase : `https://${rawBase}`;
  return new URL(normalized, base).toString();
};

export type PushClientPlatform = "web" | "android" | "ios";

// 모바일 앱(bredy_app)은 토큰 등록 시 userAgent를 `BredyApp/{version} ({os})`로 보낸다.
const NATIVE_APP_USER_AGENT = /^BredyApp\/\S+\s*\((android|ios)\)/i;

// 앱의 Android 알림 채널 ID(bredy_app nativePush.ts와 동일해야 한다).
const ANDROID_CHANNEL_ID = "default";

export const getPushClientPlatform = (userAgent?: string | null): PushClientPlatform => {
  const match = userAgent?.match(NATIVE_APP_USER_AGENT);
  if (!match) return "web";
  return match[1].toLowerCase() === "ios" ? "ios" : "android";
};

export const buildFcmMessage = (
  token: string,
  userAgent: string | null | undefined,
  content: FcmPushContent
): TokenMessage => {
  const { title, body, url, tag } = content;
  const platform = getPushClientPlatform(userAgent);

  if (platform === "android") {
    // expo-notifications(Android)는 data.message를 본문으로, data.body를 JSON(content.data)으로 파싱한다.
    // notification 필드가 있어야 앱이 백그라운드/종료 상태일 때도 시스템이 알림을 띄운다.
    return {
      token,
      notification: { title, body },
      data: {
        title,
        message: body,
        body: JSON.stringify({ url, tag }),
        url,
        tag,
      },
      android: {
        priority: "high",
        notification: { channelId: ANDROID_CHANNEL_ID, tag, sound: "default" },
      },
    };
  }

  if (platform === "ios") {
    // expo-notifications(iOS)는 APNs userInfo.body 딕셔너리를 content.data로 노출한다.
    return {
      token,
      notification: { title, body },
      data: { url, tag },
      apns: {
        headers: { "apns-priority": "10" },
        payload: {
          aps: { sound: "default", threadId: tag },
          body: { url, tag },
        },
      },
    };
  }

  // 웹은 notification 필드 대신 data 중심으로 보내고, SW에서 통일 파싱한다.
  return {
    token,
    data: { title, body, url, tag },
    webpush: {
      fcmOptions: { link: url },
      headers: { Urgency: "high" },
    },
  };
};
