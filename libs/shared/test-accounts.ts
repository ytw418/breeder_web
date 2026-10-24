export type TestAccountViewer = {
  role?: string | null;
  provider?: string | null;
};

export const isProductionLikeEnv = (rawEnv?: string | null) => {
  const normalized = String(rawEnv || "development").toLowerCase();
  return normalized === "production" || normalized === "prod";
};

/**
 * 비로그인 테스트 로그인(토큰 발급)을 열어 두는 환경. 허용 목록이라 값이 비었거나 낯선 값이면 닫힌다
 * (2026-10-24 보안 점검 — 예전엔 'production' 이 아니면 전부 열려 env 가 어긋나면 운영에서도 열렸다).
 */
export const isOpenTestLoginEnv = (rawEnv?: string | null) => {
  const normalized = String(rawEnv || "").toLowerCase();
  return normalized === "development" || normalized === "preview" || normalized === "test";
};

export const isTestAccountUser = (user?: TestAccountViewer | null) => {
  return user?.role === "FAKE_USER" || user?.provider === "test_user";
};

export const canUseTestAccountSwitcher = (
  user: TestAccountViewer | null | undefined,
  isAdmin: boolean
) => {
  return Boolean(isAdmin || isTestAccountUser(user));
};

export const shouldShowTestLoginForEnv = (rawEnv?: string | null) => {
  return isOpenTestLoginEnv(rawEnv);
};

/** 실행 환경 이름(Vercel → 앱 지정 → NODE_ENV 순). 테스트 로그인 노출·API 허용 판단에 같이 쓴다. */
export const getAppRuntimeEnv = () =>
  process.env.NEXT_PUBLIC_VERCEL_ENV ||
  process.env.VERCEL_ENV ||
  process.env.NEXT_PUBLIC_APP_ENV ||
  process.env.NODE_ENV ||
  "development";
