/**
 * Apple 웹 로그인(Android 앱·웹) 공용 값. 서버 libs/server/appleOAuth.ts·웹 로그인 화면·완료 페이지가 같이 쓴다.
 * 앱은 src/lib/auth/social/appleShared.ts 에 같은 오류 코드를 둔다.
 */

/** 웹: 콜백 복귀 페이지가 검증한 id_token 을 넘기는 sessionStorage 키 */
export const APPLE_WEB_RETURN_STORAGE_KEY = "bredy:apple-return";
/** 웹: 로그인을 시작한 탭이 원래 nonce 를 보관하는 sessionStorage 키 */
export const APPLE_WEB_NONCE_STORAGE_KEY = "bredy:apple-nonce";

/** 콜백·완료 페이지가 로그인 화면으로 돌려보낼 때 붙이는 ?error= 값 */
export type AppleLoginErrorCode =
  | "apple_cancelled"
  | "apple_state"
  | "apple_token"
  | "apple_restart";

const MESSAGES: Record<AppleLoginErrorCode, string> = {
  apple_cancelled: "Apple 로그인이 취소되었습니다.",
  apple_state: "로그인 시간이 지났어요. 다시 시도해주세요.",
  apple_token: "Apple 로그인 정보를 확인하지 못했어요. 다시 시도해주세요.",
  apple_restart: "Apple 로그인을 처음부터 다시 시도해주세요.",
};

export function appleLoginErrorMessage(code: unknown): string | null {
  return typeof code === "string" && code in MESSAGES
    ? MESSAGES[code as AppleLoginErrorCode]
    : null;
}
