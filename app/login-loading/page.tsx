import { Metadata } from "next";
import KakaoLogin from "@components/auth/KakaoLogin";
import { Suspense } from "react";
export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "로그인 처리 중",
    description: "카카오 로그인 인증을 처리하고 있습니다.",
  };
}

const Page = async () => {
  return (
    <Suspense>
      <div className="flex h-full min-h-screen w-full items-center justify-center">
        <KakaoLogin />
      </div>
    </Suspense>
  );
};

export default Page;
