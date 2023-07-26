import { Metadata } from "next";
import KakaoLogin from "@components/auth/KakaoLogin";
import { getUser } from "@libs/client/getUser";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "title",
    description: "description",
  };
}

const Page = async () => {
  return (
    <div className="flex h-full min-h-screen w-full items-center justify-center">
      <KakaoLogin />
    </div>
  );
};

export default Page;
