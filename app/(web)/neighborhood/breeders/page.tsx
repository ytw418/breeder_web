import type { Metadata } from "next";
import AuthGuard from "@components/auth/AuthGuard";
import NeighborhoodBreedersClient from "./NeighborhoodBreedersClient";

export const metadata: Metadata = {
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
  title: "동네 브리더 | 브리디",
};

/** 동네 브리더 전체 보기(앱 neighborhood/breeders.tsx, PRD neighborhood.md S-3). 로그인한 사람만. */
export default function NeighborhoodBreedersPage() {
  return (
    <AuthGuard>
      <NeighborhoodBreedersClient />
    </AuthGuard>
  );
}
