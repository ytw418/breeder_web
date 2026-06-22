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
