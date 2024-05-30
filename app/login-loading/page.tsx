import { Metadata } from "next";
import KakaoLogin from "@components/auth/KakaoLogin";
import { Suspense } from "react";
export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "title",
    description: "description",
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
