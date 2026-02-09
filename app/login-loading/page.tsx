import { Metadata } from "next";
import KakaoLogin from "@components/auth/KakaoLogin";
import { Suspense } from "react";
export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "브리디 로그인 페이지",
    description: "브리디 로그인 페이지입니다.",
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
