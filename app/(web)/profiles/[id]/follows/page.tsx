import type { Metadata } from "next";
import { Suspense } from "react";
import FollowsClient from "./FollowsClient";

export const metadata: Metadata = {
  robots: { index: false, follow: true },
  title: "팔로워·팔로잉 | 브리디",
};

/** 팔로워·팔로잉 목록(앱 profiles/[id]/follows.tsx). ?tab=following 이면 팔로잉 탭으로 연다. */
export default async function FollowsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense fallback={null}>
      <FollowsClient id={id} />
    </Suspense>
  );
}
