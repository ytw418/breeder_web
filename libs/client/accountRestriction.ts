/**
 * 이용 제한(정지·영구 정지) 안내 정보. 로그인·refresh 가 403 ACCOUNT_SUSPENDED/ACCOUNT_BANNED 를 주면
 * 응답을 sessionStorage 에 담고 로그인 화면(/auth/login?restricted=1)에서 안내를 보여 준다.
 * 앱은 같은 응답으로 src/app/account-restricted.tsx 를 연다. 기획: 앱 docs/prd/admin-moderation.md S-6
 */

export type AccountRestrictionCode = "ACCOUNT_SUSPENDED" | "ACCOUNT_BANNED";

export interface AccountRestriction {
  errorCode: AccountRestrictionCode;
  /** 서버 문구(사유 포함). 구조화 필드가 없을 때 그대로 보여 준다 */
  message: string;
  reasonLabel?: string;
  messageToUser?: string;
  /** 기간 정지 해제 시각(ISO) */
  suspendedUntil?: string;
}

const STORAGE_KEY = "bredy:account-restriction";
export const ACCOUNT_RESTRICTED_LOGIN_PATH = "/auth/login?restricted=1";

const asString = (value: unknown) => (typeof value === "string" && value ? value : undefined);

/** 로그인·refresh 응답에서 이용 제한 정보를 꺼낸다. 이용 제한이 아니면 null */
export function toAccountRestriction(payload: unknown): AccountRestriction | null {
  if (!payload || typeof payload !== "object") return null;
  const value = payload as Record<string, unknown>;
  const code = value.errorCode;
  if (code !== "ACCOUNT_SUSPENDED" && code !== "ACCOUNT_BANNED") return null;
  return {
    errorCode: code,
    message: asString(value.message) ?? asString(value.error) ?? "이용이 제한된 계정이에요.",
    reasonLabel: asString(value.reasonLabel),
    messageToUser: asString(value.messageToUser),
    suspendedUntil: asString(value.suspendedUntil),
  };
}

export function saveAccountRestriction(restriction: AccountRestriction) {
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(restriction));
  } catch {
    // 저장소를 못 쓰면 안내만 건너뛴다(로그인 화면은 그대로 열린다).
  }
}

export function readAccountRestriction(): AccountRestriction | null {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    return raw ? toAccountRestriction(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

/** 로그인 화면의 이용 제한 안내로 보낸다(이미 로그인 화면이면 그대로 둔다). */
export function openAccountRestrictedNotice() {
  if (typeof window === "undefined") return;
  if (window.location.pathname.startsWith("/auth/login")) return;
  window.location.assign(ACCOUNT_RESTRICTED_LOGIN_PATH);
}

export function clearAccountRestriction() {
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // 무시
  }
}
