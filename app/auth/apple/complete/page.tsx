import { Metadata } from "next";
import { Suspense } from "react";

import AppleLogin from "@components/auth/AppleLogin";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "로그인 처리 중",
    description: "Apple 로그인 인증을 처리하고 있습니다.",
    robots: { index: false, follow: false },
  };
}

const Page = async () => {
  return (
    <Suspense>
      <div className="flex h-full min-h-screen w-full items-center justify-center bg-app-bg">
        <AppleLogin />
      </div>
    </Suspense>
  );
};

export default Page;
