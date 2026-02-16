import LoginClient from "./LoginClient";

const shouldDisplayTestLogin = (() => {
  const runtimeEnv = String(
    process.env.NEXT_PUBLIC_VERCEL_ENV ||
      process.env.VERCEL_ENV ||
      process.env.NEXT_PUBLIC_APP_ENV ||
      process.env.NODE_ENV ||
      "development"
  ).toLowerCase();

  return runtimeEnv !== "production" && runtimeEnv !== "prod";
})();

const Page = async () => {
  return <LoginClient shouldShowTestLogin={shouldDisplayTestLogin} />;
};

export default Page;
