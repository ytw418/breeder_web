"use client";
/**
 * 프로필 사진 그리드(앱 PhotoGrid, 시안 `.grid`): 3열 정사각, 간격 2, 고정 글은 우상단 '고정' 11px 라벨.
 * 칸을 누르면 게시글 상세. onPinPost 를 주면(본인) 칸 오른쪽 아래 ⋯ 버튼(앱의 길게 누르기)·오른쪽 클릭으로
 * 고정/해제 시트를 연다 — 데스크톱에는 길게 누르기가 없어서다(플랫폼 관습 차이).
 */
import Link from "next/link";
import Image from "@components/atoms/Image";
import { QueryErrorState } from "@components/app/QueryErrorState";
import { LineIcon } from "@components/features/profile/ProfileRows";
import { LoadMoreFooter, type ProfilePost } from "@components/features/profile/ProfileActivityLists";
import type { PagedListState } from "@components/features/profile/usePagedList";
import { makeImageUrl } from "@libs/client/utils";
import { toPostPath } from "@libs/post-route";

const coverOf = (post: ProfilePost) => post.images?.[0] || post.image;

export default function PhotoGrid({
  list,
  emptyMessage,
  emptyAction,
  onPinPost,
}: {
  list: PagedListState<ProfilePost>;
  emptyMessage: string;
  emptyAction?: { label: string; href: string };
  onPinPost?: (post: ProfilePost) => void;
}) {
  if (list.isLoading) {
    return (
      <div className="grid grid-cols-3 gap-0.5 pt-0.5" aria-label="사진 불러오는 중" role="status">
        {Array.from({ length: 9 }, (_, i) => (
          <span key={i} className="aspect-square animate-pulse bg-app-placeholder" />
        ))}
      </div>
    );
  }
  if (list.isError) return <QueryErrorState onRetry={() => list.refetch()} />;
  if (!list.items.length) {
    return (
      <div className="flex flex-col items-center px-4 py-12">
        <p className="text-center text-[14px] text-app-muted">{emptyMessage}</p>
        {emptyAction ? (
          <Link
            href={emptyAction.href}
            className="mt-3.5 inline-flex h-10 w-[120px] items-center justify-center rounded-md bg-app-brand text-[14px] font-semibold text-white"
          >
            {emptyAction.label}
          </Link>
        ) : null}
      </div>
    );
  }
  return (
    <div>
      <div className="grid grid-cols-3 gap-0.5 pt-0.5">
        {list.items.map((post) => {
          const pinned = Boolean(post.profilePinnedAt);
          return (
            <div key={post.id} className="relative aspect-square bg-app-placeholder">
              <Link
                href={toPostPath(post.id, post.title)}
                aria-label={`${post.title} 사진${pinned ? ", 프로필에 고정됨" : ""}`}
                onContextMenu={
                  onPinPost
                    ? (event) => {
                        event.preventDefault();
                        onPinPost(post);
                      }
                    : undefined
                }
                className="block h-full w-full"
              >
                {coverOf(post) ? (
                  <Image
                    src={makeImageUrl(coverOf(post), "public")}
                    alt=""
                    fill
                    sizes="(max-width: 576px) 33vw, 192px"
                    className="object-cover"
                  />
                ) : null}
              </Link>
              {pinned ? (
                <span className="pointer-events-none absolute right-1.5 top-1.5 rounded bg-app-bg px-[5px] py-0.5 text-[11px] leading-[14px] text-app-text">
                  고정
                </span>
              ) : null}
              {onPinPost ? (
                <button
                  type="button"
                  aria-label={pinned ? "프로필 고정 해제" : "프로필에 고정"}
                  onClick={() => onPinPost(post)}
                  className="absolute bottom-1 right-1 grid h-7 w-7 place-items-center rounded-full bg-app-bg text-app-text shadow-card"
                >
                  <LineIcon name="more" size={18} strokeWidth={2} />
                </button>
              ) : null}
            </div>
          );
        })}
      </div>
      <LoadMoreFooter state={list} label="사진" />
    </div>
  );
}
