import type { Metadata } from "next";
import { Suspense } from "react";
import AuthGuard from "@components/auth/AuthGuard";
import AlbumEditClient from "./AlbumEditClient";

export const metadata: Metadata = {
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
  title: "앨범 만들기 | 브리디",
};

/** 앨범 만들기(?albumId= 이면 편집, 앱 albums/edit.tsx). 로그인한 본인만. */
export default function AlbumEditPage() {
  return (
    <AuthGuard>
      <Suspense fallback={null}>
        <AlbumEditClient />
      </Suspense>
    </AuthGuard>
  );
}
