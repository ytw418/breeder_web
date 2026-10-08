import type { Metadata } from "next";
import AlbumClient from "./AlbumClient";

export const metadata: Metadata = {
  robots: { index: false, follow: true },
  title: "앨범 | 브리디",
};

/** 사용자가 만든 앨범 보기(앱 albums/[albumId].tsx). */
export default async function AlbumPage({ params }: { params: Promise<{ albumId: string }> }) {
  const { albumId } = await params;
  return <AlbumClient albumId={albumId} />;
}
