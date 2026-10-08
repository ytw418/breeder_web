"use client";
/**
 * 앨범 보기 — 사진형 프로필 2단계(앱 albums/[albumId].tsx, PRD S-7, 시안 #album).
 * 헤더(뒤로 · 앨범 이름 · 주인이면 ⋯: 앨범 편집/앨범 삭제) + 넣은 순서대로 3열 그리드.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import useSWR, { useSWRConfig } from "swr";
import MainLayout from "@components/features/MainLayout";
import ConfirmDialog from "@components/atoms/ConfirmDialog";
import { ActionSheet } from "@components/app/ActionSheet";
import { HeaderIconButton } from "@components/app/HeaderIconButton";
import PhotoGrid from "@components/features/profile/PhotoGrid";
import { LineIcon } from "@components/features/profile/ProfileRows";
import type { ProfilePost } from "@components/features/profile/ProfileActivityLists";
import type { PagedListState } from "@components/features/profile/usePagedList";
import { authFetch } from "@libs/client/authFetch";
import { toast } from "@libs/client/toast";
import useUser from "hooks/useUser";

interface AlbumDetailResponse {
  success: boolean;
  album: { id: number; title: string; userId: number; createdAt: string; user: { id: number; name: string } };
  /** 넣은 순서대로 보이는 사진 글(지워진·숨긴 글은 빠진다). */
  posts: ProfilePost[];
}

export const albumKey = (albumId: number | string) => `/api/albums/${albumId}`;

export default function AlbumClient({ albumId }: { albumId: string }) {
  const router = useRouter();
  const { mutate: globalMutate } = useSWRConfig();
  const { user: me } = useUser();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const { data, error, isLoading, mutate } = useSWR<AlbumDetailResponse>(albumKey(albumId));
  const album = data?.success ? data.album : undefined;
  const isOwner = Boolean(me?.id && album?.userId === me.id);
  const notFound = (error as { status?: number } | undefined)?.status === 404;
  const editHref = `/albums/edit?albumId=${albumId}`;

  // 앨범 글은 한 번에 오므로(최대 30) 페이지 없는 목록 상태로 PhotoGrid 에 넘긴다.
  const list: PagedListState<ProfilePost> = {
    items: data?.posts ?? [],
    isLoading,
    isError: Boolean(error) && !data,
    isLoaded: Boolean(data),
    hasNextPage: false,
    isFetchingNextPage: false,
    isFetchNextPageError: false,
    loadMore: () => undefined,
    refetch: () => void mutate(),
  };

  const handleDelete = async () => {
    if (deleting) return;
    setDeleting(true);
    try {
      const res = await authFetch(albumKey(albumId), { method: "DELETE" });
      const result = (await res.json().catch(() => null)) as { success?: boolean; error?: string } | null;
      if (!res.ok || !result?.success) throw new Error(result?.error || "앨범을 지우지 못했어요.");
      toast.success("앨범을 지웠어요.");
      void globalMutate((key) => typeof key === "string" && /^\/api\/users\/\d+\/albums$/.test(key));
      setConfirmOpen(false);
      if (window.history.length > 1) router.back();
      else router.replace("/myPage");
    } catch (deleteError) {
      toast.error(deleteError instanceof Error ? deleteError.message : "앨범을 지우지 못했어요.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <MainLayout
      headerVariant="profile"
      title={album?.title}
      headerRight={
        isOwner ? (
          <HeaderIconButton label="더보기" onClick={() => setSheetOpen(true)}>
            <LineIcon name="more" size={24} strokeWidth={2} />
          </HeaderIconButton>
        ) : null
      }
    >
      {notFound ? (
        <div className="flex flex-col items-center justify-center px-5 py-24">
          <p className="text-[14px] text-app-muted">앨범을 찾을 수 없어요</p>
          <button
            type="button"
            onClick={() => router.back()}
            className="mt-3 h-9 rounded-md bg-app-surface px-3.5 text-[14px] font-semibold text-app-text"
          >
            돌아가기
          </button>
        </div>
      ) : (
        <div className="pb-8">
          <PhotoGrid
            list={list}
            emptyMessage="앨범에 사진이 없어요"
            emptyAction={isOwner ? { label: "사진 추가", href: editHref } : undefined}
          />
        </div>
      )}
      <ActionSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        actions={[
          { key: "edit-album", label: "앨범 편집", onSelect: () => router.push(editHref) },
          { key: "delete-album", label: "앨범 삭제", destructive: true, onSelect: () => setConfirmOpen(true) },
        ]}
      />
      <ConfirmDialog
        open={confirmOpen}
        title="앨범을 지울까요?"
        description="앨범 안의 게시글은 지워지지 않아요."
        confirmText="지우기"
        tone="danger"
        loading={deleting}
        onConfirm={() => void handleDelete()}
        onCancel={() => setConfirmOpen(false)}
      />
    </MainLayout>
  );
}
