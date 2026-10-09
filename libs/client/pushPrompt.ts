"use client";
/**
 * 알림 권유 시트 상태(앱 lib/notifications/pushPrompt.ts, 대응표 O-2). 어디서든 열고, 루트 레이아웃의
 * PushPermissionPrompt 가 그린다.
 * - welcome: 웹은 첫 로그인 뒤(온보딩을 마친 화면에서) 이 브라우저에 한 번. 이미 알림을 허용한 브라우저는 건너뛴다.
 *   앱은 설치 후 첫 실행에 한 번이다(온보딩 시점 O-1 과 같은 대응).
 * - product: 상품 등록 직후 이 브라우저에서 알림을 못 받는 상태면 매번.
 * 브라우저 권한 창은 시트에서 사용자가 켜기를 눌렀을 때만 띄운다. 웹 푸시가 안 되는 브라우저나 서버 푸시가
 * 설정되지 않은 환경에서는 묻지 않는다.
 */
import {
  fetchPushSubscriptionStatus,
  getWebPushPermission,
  isReceivingOnThisBrowser,
  type PushSubscriptionStatusResponse,
} from "@libs/client/webPush";

export type PushPromptReason = "welcome" | "product";

export interface PushPromptRequest {
  reason: PushPromptReason;
  /** denied 면 권한 창 대신 브라우저 설정 안내를 보인다. granted 면 서버 구독만 다시 켠다. */
  permission: NotificationPermission;
  /** 열 때 받은 서버 설정. 켜기를 누른 직후 네트워크를 기다리지 않고 권한 창을 띄우려고 들고 있는다. */
  status: Pick<PushSubscriptionStatusResponse, "configured" | "vapidPublicKey">;
}

type PushPromptListener = (request: PushPromptRequest | null) => void;

export const PUSH_PROMPT_WELCOME_KEY = "bredy.pushPrompt.welcomeShown";
/** 상품 상세로 넘어가는 전환과 등록 토스트를 본 뒤에 띄운다(앱과 같다). */
const PRODUCT_PROMPT_DELAY_MS = 700;

let current: PushPromptRequest | null = null;
const listeners = new Set<PushPromptListener>();

function emit(next: PushPromptRequest | null) {
  current = next;
  listeners.forEach((listener) => listener(current));
}

function open(request: PushPromptRequest) {
  if (current) return;
  emit(request);
}

export function subscribePushPrompt(listener: PushPromptListener) {
  listeners.add(listener);
  listener(current);
  return () => {
    listeners.delete(listener);
  };
}

export function closePushPrompt() {
  emit(null);
}

function welcomeShown() {
  try {
    return window.localStorage.getItem(PUSH_PROMPT_WELCOME_KEY) === "1";
  } catch {
    // 저장소를 못 쓰면 매번 묻게 되므로 묻지 않는다.
    return true;
  }
}

function markWelcomeShown() {
  try {
    window.localStorage.setItem(PUSH_PROMPT_WELCOME_KEY, "1");
  } catch {
    // noop
  }
}

/** 로그인한 뒤 한 번: 이 브라우저가 알림을 허용하지 않았으면 권유 시트를 연다. */
export async function promptPushOnWelcome() {
  try {
    const permission = getWebPushPermission();
    if (permission === "unsupported" || welcomeShown()) return;
    const status = await fetchPushSubscriptionStatus();
    // 서버 푸시가 설정되지 않은 환경에서는 켤 수 없으니 묻지 않는다(설정되면 그때 묻는다).
    if (!status?.configured) return;
    markWelcomeShown();
    if (permission === "granted") return;
    open({ reason: "welcome", permission, status });
  } catch {
    // 권유는 부가 기능이라 실패해도 사용을 막지 않는다.
  }
}

/** 상품 등록 직후: 이 브라우저에서 이 계정 알림을 못 받는 상태면 다시 권유한다. */
export async function promptPushAfterProductUpload(userId: number) {
  const startedAt = Date.now();
  try {
    const permission = getWebPushPermission();
    if (permission === "unsupported") return;
    const status = await fetchPushSubscriptionStatus();
    if (!status?.configured) return;
    if (isReceivingOnThisBrowser(userId, status)) return;

    const wait = PRODUCT_PROMPT_DELAY_MS - (Date.now() - startedAt);
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    open({ reason: "product", permission, status });
  } catch {
    // 상태를 확인하지 못하면 묻지 않는다.
  }
}
