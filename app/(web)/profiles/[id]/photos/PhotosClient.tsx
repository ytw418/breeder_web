"use client";
/**
 * 종별 사진 — 사진형 프로필 앨범 줄에서 종을 누르면 연다(앱 profiles/[id]/photos.tsx, PRD S-4, 시안 #photos).
 * 헤더(뒤로 · "종 · 사용자 이름") + 3열 그리드(고정 라벨 동일). 본인이면 칸 ⋯ 로 고정/해제.
 */
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import useSWR from "swr";
import MainLayout from "@components/features/MainLayout";
import PhotoGrid from "@components/features/profile/PhotoGrid";
import ProfilePinSheet from "@components/features/profile/ProfilePinSheet";
import { useUserPhotoPostsList, type ProfilePost } from "@components/features/profile/ProfileActivityLists";
import useUser from "hooks/useUser";
import type { UserResponse } from "pages/api/users/[id]";

export default function PhotosClient({ id }: { id: string }) {
  const searchParams = useSearchParams();
  const species = searchParams?.get("species") ?? undefined;
  const { user: me } = useUser();
  const [pinTarget, setPinTarget] = useState<ProfilePost | null>(null);
  const { data: profile } = useSWR<UserResponse>(id ? `/api/users/${id}` : null);
  const isMine = Boolean(me?.id && String(me.id) === String(id));
  const photos = useUserPhotoPostsList(id, species);
  const title = [species, profile?.user?.name].filter(Boolean).join(" · ");
  return (
    <MainLayout headerVariant="profile" title={title}>
      <div className="pb-8">
        <PhotoGrid list={photos} emptyMessage="이 종의 사진이 없어요" onPinPost={isMine ? setPinTarget : undefined} />
      </div>
      <ProfilePinSheet post={pinTarget} onClose={() => setPinTarget(null)} />
    </MainLayout>
  );
}
