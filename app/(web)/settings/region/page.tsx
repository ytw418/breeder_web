import type { Metadata } from "next";
import AuthGuard from "@components/auth/AuthGuard";
import RegionPicker from "@components/features/region/RegionPicker";

export const metadata: Metadata = {
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
  title: "내 동네 | 브리디",
};

/**
 * 설정 > 내 동네(앱 settings/region/index.tsx) — 시/도 목록·현재 위치로 찾기·나를 표시·완료.
 * `?from=` 은 로그인을 거쳐 들어올 때 '완료' 뒤 돌아갈 곳(components/features/region/regionHref.ts).
 */
export default async function RegionPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string | string[] }>;
}) {
  const { from } = await searchParams;
  return (
    <AuthGuard>
      <RegionPicker from={typeof from === "string" ? from : undefined} />
    </AuthGuard>
  );
}
