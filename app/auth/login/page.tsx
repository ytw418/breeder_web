import LoginClient from "./LoginClient";
import {
  getAppRuntimeEnv,
  shouldShowTestLoginForEnv,
} from "@libs/shared/test-accounts";

const shouldDisplayTestLogin = shouldShowTestLoginForEnv(getAppRuntimeEnv());

const Page = async () => {
  return <LoginClient shouldShowTestLogin={shouldDisplayTestLogin} />;
};

export default Page;
