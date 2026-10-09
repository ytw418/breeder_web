"use client";
/**
 * 앨범 만들기·편집 — 사진형 프로필 2단계(앱 albums/edit.tsx, PRD S-8, 시안 #album-edit).
 * 헤더(뒤로 · "새 앨범"/"앨범 편집" · '완료') → 이름(최대 12자) → "N/30 선택" → 내 사진 글 3열 그리드.
 * 고른 순서가 곧 앨범 순서다. 편집할 때는 앨범에 든 글을 앞에 둬 목록 첫 페이지 밖의 글도 풀 수 있게 한다.
 */
import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import useSWR, { useSWRConfig } from "swr";
import Image from "@components/atoms/Image";
import MainLayout from "@components/features/MainLayout";
import { QueryErrorState } from "@components/app/QueryErrorState";
import { LoadingBlock } from "@components/features/profile/ProfileRows";
import {
  LoadMoreFooter,
  useUserPhotoPostsList,
  type ProfilePost,
} from "@components/features/profile/ProfileActivityLists";
import { authFetch } from "@libs/client/authFetch";
import { clampAlbumTitle, mergeAlbumCandidates, toggleAlbumPost } from "@libs/client/albumEdit";
import { toast } from "@libs/client/toast";
import { cn, makeImageUrl } from "@libs/client/utils";
import { ALBUM_POST_MAX } from "@libs/shared/profile";
import useUser from "hooks/useUser";

interface AlbumDetailResponse {
  success: boolean;
  album: { id: number; title: string; userId: number };
  posts: ProfilePost[];
}

const coverOf = (post: ProfilePost) => post.images?.[0] || post.image;

export default function AlbumEditClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const albumId = searchParams?.get("albumId") ?? "";
  const editing = Boolean(albumId);
  const { mutate: globalMutate } = useSWRConfig();
  const { user: me } = useUser();
  const albumQuery = useSWR<AlbumDetailResponse>(editing ? `/api/albums/${albumId}` : null);
  const photos = useUserPhotoPostsList(me?.id);

  // 편집: 받아 온 앨범 값을 처음 한 번만 입력 상태로 옮긴다(이후 입력은 사용자 몫).
  const [titleDraft, setTitleDraft] = useState<string | null>(null);
  const [selectedDraft, setSelectedDraft] = useState<number[] | null>(null);
  const [saving, setSaving] = useState(false);
  const album = albumQuery.data?.success ? albumQuery.data.album : undefined;
  const title = titleDraft ?? album?.title ?? "";
  const selected = selectedDraft ?? albumQuery.data?.posts?.map((post) => post.id) ?? [];
  const items = useMemo(
    () => mergeAlbumCandidates(albumQuery.data?.posts ?? [], photos.items),
    [albumQuery.data?.posts, photos.items]
  );

  const notOwner = Boolean(editing && album && me && album.userId !== me.id);
  const canSave = Boolean(title.trim()) && selected.length > 0 && !saving && !notOwner && (!editing || Boolean(album));

  const toggle = (postId: number) => {
    const result = toggleAlbumPost(selected, postId);
    if (result.limited) {
      toast.error(`앨범 하나에 사진은 ${ALBUM_POST_MAX}장까지 넣을 수 있어요.`);
      return;
    }
    setSelectedDraft(result.selected);
  };

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      const res = await authFetch(editing ? `/api/albums/${albumId}` : "/api/albums", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), postIds: selected }),
      });
      const result = (await res.json().catch(() => null)) as {
        success?: boolean;
        album?: { id: number };
        error?: string;
      } | null;
      if (!res.ok || !result?.success || !result.album) throw new Error(result?.error || "앨범을 저장하지 못했어요.");
      toast.success(editing ? "앨범을 고쳤어요." : "앨범을 만들었어요.");
      const savedId = result.album.id;
      void globalMutate(
        (key) =>
          typeof key === "string" && (/^\/api\/users\/\d+\/albums$/.test(key) || key === `/api/albums/${savedId}`)
      );
      if (window.history.length > 1) router.back();
      else router.replace(`/albums/${savedId}`);
    } catch (error) {
      toast.error(error instanceof Error && error.message ? error.message : "앨범을 저장하지 못했어요.");
    } finally {
      setSaving(false);
    }
  };

  const loading = photos.isLoading || (editing && albumQuery.isLoading) || !me;

  return (
    <MainLayout
      headerVariant="profile"
      title={editing ? "앨범 편집" : "새 앨범"}
      headerRight={
        <button
          type="button"
          disabled={!canSave}
          onClick={() => void save()}
          className={cn("h-10 px-2 text-[16px] font-semibold", canSave ? "text-app-brand" : "text-app-caption")}
        >
          {saving ? (
            <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-app-border border-t-app-brand" />
          ) : (
            "완료"
          )}
        </button>
      }
    >
      {notOwner ? (
        <p className="py-24 text-center text-[14px] text-app-muted">수정할 수 없는 앨범이에요</p>
      ) : (
        <div className="pb-8">
          <div className="px-4 pb-2 pt-4">
            <input
              type="text"
              value={title}
              onChange={(event) => setTitleDraft(clampAlbumTitle(event.target.value))}
              placeholder="앨범 이름"
              aria-label="앨범 이름"
              className="h-12 w-full rounded-lg border border-app-border bg-app-bg px-3.5 text-[15px] text-app-text outline-none placeholder:text-app-caption focus:border-app-text focus:ring-0"
            />
            <div className="mt-2 flex justify-between text-[13px] text-app-muted">
              <span>사진을 고른 순서대로 앨범에 담겨요</span>
              <span>
                {selected.length}/{ALBUM_POST_MAX} 선택
              </span>
            </div>
          </div>
          {loading ? (
            <LoadingBlock />
          ) : photos.isError && !items.length ? (
            <QueryErrorState onRetry={() => photos.refetch()} />
          ) : !items.length ? (
            <div className="flex flex-col items-center py-12">
              <p className="text-[14px] text-app-muted">앨범에 넣을 사진이 없어요</p>
              <Link
                href="/posts/upload"
                className="mt-3.5 inline-flex h-10 w-[120px] items-center justify-center rounded-md bg-app-brand text-[14px] font-semibold text-white"
              >
                글쓰기
              </Link>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-0.5 pt-0.5">
                {items.map((post) => {
                  const order = selected.indexOf(post.id) + 1;
                  const on = order > 0;
                  return (
                    <button
                      key={post.id}
                      type="button"
                      role="checkbox"
                      aria-checked={on}
                      aria-label={`${post.title} 사진${on ? `, ${order}번째로 선택됨` : ""}`}
                      onClick={() => toggle(post.id)}
                      className="relative aspect-square bg-app-placeholder"
                    >
                      {coverOf(post) ? (
                        <Image
                          src={makeImageUrl(coverOf(post), "public")}
                          alt=""
                          fill
                          sizes="(max-width: 576px) 33vw, 192px"
                          className={cn("object-cover", on && "opacity-70")}
                        />
                      ) : null}
                      <span
                        className={cn(
                          "absolute right-1.5 top-1.5 flex h-[22px] w-[22px] items-center justify-center rounded-full border-[1.5px] text-[12px] font-semibold text-white",
                          on ? "border-app-brand bg-app-brand" : "border-white bg-transparent"
                        )}
                      >
                        {on ? order : null}
                      </span>
                    </button>
                  );
                })}
              </div>
              <LoadMoreFooter state={photos} label="사진" />
            </>
          )}
        </div>
      )}
    </MainLayout>
  );
}
