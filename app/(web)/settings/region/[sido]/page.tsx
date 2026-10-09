import type { Metadata } from "next";
import AuthGuard from "@components/auth/AuthGuard";
import RegionPicker from "@components/features/region/RegionPicker";

export const metadata: Metadata = {
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
  title: "내 동네 | 브리디",
};

/** 설정 > 내 동네 > 시/군/구 고르기(앱 settings/region/[sido].tsx). `?sigungu=` 는 내 동네 화면에서 고르던 시/군/구. */
export default async function RegionSidoPage({
  params,
  searchParams,
}: {
  params: Promise<{ sido: string }>;
  searchParams: Promise<{ sigungu?: string | string[] }>;
}) {
  const { sido } = await params;
  const { sigungu } = await searchParams;
  return (
    <AuthGuard>
      <RegionPicker sido={decodeURIComponent(sido)} selected={typeof sigungu === "string" ? sigungu : undefined} />
    </AuthGuard>
  );
}
