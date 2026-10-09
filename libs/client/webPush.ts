"use client";
/**
 * 웹 푸시(FCM) 켜기·끄기. 설정 > 푸시 알림 토글과 알림 권유 시트(PushPermissionPrompt)가 같이 쓴다.
 * 앱의 lib/notifications/pushRegistration.ts 에 해당한다.
 */
import { authFetch } from "@libs/client/authFetch";

export interface PushSubscriptionStatusResponse {
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

export const PUSH_SUBSCRIPTION_KEY = "/api/push/subscription";

/** 이 브라우저에서 구독한 계정·토큰. 계정 구독은 다른 기기만 켜져 있어도 true 라 이 브라우저 수신 여부를 따로 적는다. */
const LOCAL_TOKEN_KEY = "bredy.webPush.token";

/** 브라우저 알림 권한. 지원하지 않으면 unsupported. */
export type WebPushPermission = NotificationPermission | "unsupported";

/** 웹 푸시를 쓸 수 있는 브라우저인가(보안 컨텍스트 + 서비스워커 + Notification + PushManager). */
export function isWebPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    window.isSecureContext &&
    typeof navigator !== "undefined" &&
    "serviceWorker" in navigator &&
    "Notification" in window &&
    "PushManager" in window
  );
}

export function getWebPushPermission(): WebPushPermission {
  return isWebPushSupported() ? Notification.permission : "unsupported";
}

function readLocalToken(): { userId: number; token: string } | null {
  try {
    const raw = window.localStorage.getItem(LOCAL_TOKEN_KEY);
    const parsed = raw ? (JSON.parse(raw) as { userId?: unknown; token?: unknown }) : null;
    if (typeof parsed?.userId === "number" && typeof parsed.token === "string" && parsed.token) {
      return { userId: parsed.userId, token: parsed.token };
    }
  } catch {
    // 깨진 값은 없는 것으로 본다.
  }
  return null;
}

function writeLocalToken(value: { userId: number; token: string } | null) {
  try {
    if (value) window.localStorage.setItem(LOCAL_TOKEN_KEY, JSON.stringify(value));
    else window.localStorage.removeItem(LOCAL_TOKEN_KEY);
  } catch {
    // 저장이 막힌 브라우저(사생활 보호 모드 등)는 넘어간다.
  }
}

/** 이 브라우저가 이 계정 알림을 받는 중인가(권한 허용 + 계정 구독 + 이 브라우저 토큰). */
export function isReceivingOnThisBrowser(userId: number, status: Pick<PushSubscriptionStatusResponse, "subscribed">) {
  return getWebPushPermission() === "granted" && status.subscribed && readLocalToken()?.userId === userId;
}

/** 브라우저 권한 창에서 거부했거나 이미 차단돼 있을 때. 화면은 권한 복구 안내를 보인다. */
export class WebPushPermissionError extends Error {
  constructor(
    message: string,
    readonly permission: NotificationPermission
  ) {
    super(message);
    this.name = "WebPushPermissionError";
  }
}

// SW가 아직 등록되지 않은 환경(개발/최초 진입)에서도 푸시 설정이 멈추지 않도록 보장한다.
async function ensureServiceWorkerReady() {
  if (!("serviceWorker" in navigator)) {
    throw new Error("현재 브라우저는 서비스워커를 지원하지 않습니다.");
  }
  let registration = await navigator.serviceWorker.getRegistration();
  if (!registration) {
    registration = await navigator.serviceWorker.register("/sw.js");
  }
  return navigator.serviceWorker.ready;
}

// 푸시 구독 API 응답을 공통 처리한다. HTTP 오류/업무 오류를 모두 에러로 승격한다.
async function requestPushApi(body: PushSubscriptionUpsertBody) {
  const res = await authFetch(PUSH_SUBSCRIPTION_KEY, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const result = (await res.json().catch(() => null)) as PushSubscriptionStatusResponse | null;
  if (!res.ok || !result?.success) {
    throw new Error(result?.error || "푸시 알림 설정 요청에 실패했습니다.");
  }
  return result;
}

// Firebase 메시징 SDK는 브라우저 환경에서만 로드한다.
async function getMessagingTools() {
  const [{ app }, messagingModule] = await Promise.all([import("@/firebase"), import("firebase/messaging")]);
  return {
    messaging: messagingModule.getMessaging(app),
    getToken: messagingModule.getToken,
    deleteToken: messagingModule.deleteToken,
  };
}

export function normalizeVapidKey(raw: string | null | undefined): string {
  const normalized = (raw || "").trim().replace(/^['"]|['"]$/g, "").replace(/\s+/g, "");
  // 잘못된 값(예: FCM 토큰 AAA...:APA...)을 조기 차단해 atob 오류를 예방한다.
  if (!normalized || !/^[A-Za-z0-9\-_]+$/.test(normalized) || normalized.length < 80) {
    throw new Error("VAPID 공개키 형식이 올바르지 않습니다. Firebase 웹 푸시 인증서 키를 다시 확인해 주세요.");
  }
  return normalized;
}

function assertReady(status: Pick<PushSubscriptionStatusResponse, "configured" | "vapidPublicKey"> | undefined) {
  if (!("serviceWorker" in navigator) || !("Notification" in window)) {
    throw new Error("현재 브라우저는 알림 기능을 지원하지 않습니다.");
  }
  if (!status?.configured || !status.vapidPublicKey) {
    throw new Error("FCM 푸시 서버 설정이 완료되지 않았습니다.");
  }
  return normalizeVapidKey(status.vapidPublicKey);
}

/** 권한을 묻고(필요하면) 이 브라우저 토큰을 계정에 구독한다. 받은 토큰을 돌려준다. */
export async function enableWebPush(
  userId: number,
  status: Pick<PushSubscriptionStatusResponse, "configured" | "vapidPublicKey"> | undefined
): Promise<string> {
  const vapidKey = assertReady(status);
  // 브라우저에서 이미 '차단(denied)' 상태면 권한 창이 뜨지 않는다. 복구 안내로 보낸다.
  if (Notification.permission === "denied") {
    throw new WebPushPermissionError("알림 권한이 차단되어 있습니다. 아래 안내대로 권한을 허용해 주세요.", "denied");
  }
  // 권한 창은 누른 직후(사용자 동작 안)에 띄워야 하는 브라우저가 있어 다른 비동기 작업보다 먼저 묻는다.
  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new WebPushPermissionError("알림 권한이 거부되어 설정할 수 없습니다.", permission);
  }
  const registration = await ensureServiceWorkerReady();
  const { messaging, getToken } = await getMessagingTools();
  const token = await getToken(messaging, { vapidKey, serviceWorkerRegistration: registration });
  if (!token) {
    throw new Error("FCM 토큰 발급에 실패했습니다. 잠시 후 다시 시도해 주세요.");
  }
  await requestPushApi({ action: "subscribe", token, userAgent: navigator.userAgent });
  writeLocalToken({ userId, token });
  return token;
}

/** 이 브라우저 토큰을 지우고 계정 구독을 해제한다(토큰을 못 구하면 계정 구독만 해제). */
export async function disableWebPush(
  status: Pick<PushSubscriptionStatusResponse, "configured" | "vapidPublicKey"> | undefined,
  knownToken?: string
): Promise<void> {
  const vapidKey = assertReady(status);
  const registration = await ensureServiceWorkerReady();
  const { messaging, getToken, deleteToken } = await getMessagingTools();
  const token =
    knownToken ||
    readLocalToken()?.token ||
    (await getToken(messaging, { vapidKey, serviceWorkerRegistration: registration }).catch(() => ""));
  if (token) {
    await deleteToken(messaging).catch(() => undefined);
    await requestPushApi({ action: "unsubscribe", token });
  } else {
    await requestPushApi({ action: "unsubscribe" });
  }
  writeLocalToken(null);
}

/** 구독 상태(GET). 실패하면 null. */
export async function fetchPushSubscriptionStatus(): Promise<PushSubscriptionStatusResponse | null> {
  try {
    const res = await authFetch(PUSH_SUBSCRIPTION_KEY, { method: "GET", cache: "no-store" });
    const result = (await res.json().catch(() => null)) as PushSubscriptionStatusResponse | null;
    return res.ok && result?.success ? result : null;
  } catch {
    return null;
  }
}
