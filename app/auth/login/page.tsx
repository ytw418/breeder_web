import LoginClient from "./LoginClient";
import { shouldShowTestLoginForEnv } from "@libs/shared/test-accounts";

const shouldDisplayTestLogin = (() => {
  const runtimeEnv =
    process.env.NEXT_PUBLIC_VERCEL_ENV ||
    process.env.VERCEL_ENV ||
    process.env.NEXT_PUBLIC_APP_ENV ||
    process.env.NODE_ENV ||
    "development";

  return shouldShowTestLoginForEnv(runtimeEnv);
})();

const Page = async () => {
  return <LoginClient shouldShowTestLogin={shouldDisplayTestLogin} />;
};

export default Page;
