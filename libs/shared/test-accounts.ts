export type TestAccountViewer = {
  role?: string | null;
  provider?: string | null;
};

export const isProductionLikeEnv = (rawEnv?: string | null) => {
  const normalized = String(rawEnv || "development").toLowerCase();
  return normalized === "production" || normalized === "prod";
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
  return !isProductionLikeEnv(rawEnv);
};

/** 실행 환경 이름(Vercel → 앱 지정 → NODE_ENV 순). 테스트 로그인 노출·API 허용 판단에 같이 쓴다. */
export const getAppRuntimeEnv = () =>
  process.env.NEXT_PUBLIC_VERCEL_ENV ||
  process.env.VERCEL_ENV ||
  process.env.NEXT_PUBLIC_APP_ENV ||
  process.env.NODE_ENV ||
  "development";
