import type { Metadata } from "next";
import { Suspense } from "react";
import PhotosClient from "./PhotosClient";

export const metadata: Metadata = {
  robots: { index: false, follow: true },
  title: "종별 사진 | 브리디",
};

/** 종별 사진(앱 profiles/[id]/photos.tsx). 프로필 앨범 줄에서 종을 누르면 연다(?species=). */
export default async function SpeciesPhotosPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense fallback={null}>
      <PhotosClient id={id} />
    </Suspense>
  );
}
