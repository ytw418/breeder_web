"use client";

import Link from "next/link";
import { getTimeAgoString } from "@libs/client/utils";
import { formatProductPrice } from "@libs/shared/price";
import { toAuctionPath } from "@libs/auction-route";
import { toPostCommentPath, toPostPath } from "@libs/post-route";
import type { ProductListResponse } from "pages/api/users/[id]/productList";
import type { UserPostListResponse } from "pages/api/users/[id]/posts";
import type { UserCommentListResponse } from "pages/api/users/[id]/comments";
import type { UserAuctionsResponse } from "pages/api/users/[id]/auctions";
import type { UserBloodlineCardsResponse } from "pages/api/users/[id]/bloodline-cards";
import {
  BLOODLINE_MASKED_USER_NAME,
  bloodlineCardTypeLabel,
  type BloodlineCardItem,
} from "@libs/shared/bloodline-card";
import { formatRegionShort } from "@libs/shared/regions";
import type { PagedListState } from "./usePagedList";
import { usePagedList } from "./usePagedList";
import { EmptyBlock, EmptyMessage, LoadingBlock, RetryBlock, Thumb } from "./ProfileRows";
import { toPostPlainText } from "@libs/shared/post-body";

export type ProfilePost = UserPostListResponse["posts"][number] & { isHidden?: boolean | null };
export type ProfileComment = UserCommentListResponse["comments"][number];
export type ProfileProduct = ProductListResponse["products"][number] & {
  category?: string | null;
  status?: string | null;
  isHidden?: boolean | null;
};
export type ProfileAuction = UserAuctionsResponse["auctions"][number];
export type ProfileBloodlineCard = UserBloodlineCardsResponse["cards"][number];

const pickPosts = (page: UserPostListResponse) => page.posts as ProfilePost[];
const pickComments = (page: UserCommentListResponse) => page.comments;
const pickProducts = (page: ProductListResponse) => page.products as ProfileProduct[];
const pickAuctions = (page: UserAuctionsResponse) => page.auctions;

/* ------------------------------------------------------------------ */
/* 목록 훅 (게시물·댓글·상품·경매는 페이지로 받고 '더보기'로 이어 붙인다)        */
/* ------------------------------------------------------------------ */

export const useUserPostsList = (userId: number | string | undefined, enabled = true) =>
  usePagedList<UserPostListResponse, ProfilePost>(
    userId && enabled ? `/api/users/${userId}/posts` : null,
    pickPosts
  );

export const useUserCommentsList = (userId: number | string | undefined, enabled = true) =>
  usePagedList<UserCommentListResponse, ProfileComment>(
    userId && enabled ? `/api/users/${userId}/comments` : null,
    pickComments
  );

export const useUserProductsList = (userId: number | string | undefined, enabled = true) =>
  usePagedList<ProductListResponse, ProfileProduct>(
    userId && enabled ? `/api/users/${userId}/productList` : null,
    pickProducts
  );

export const useUserAuctionsList = (userId: number | string | undefined, enabled = true) =>
  usePagedList<UserAuctionsResponse, ProfileAuction>(
    userId && enabled ? `/api/users/${userId}/auctions` : null,
    pickAuctions
  );

/** 프로필 '사진' 탭·종별 사진: 사진 있는 글만, 프로필 고정 글이 먼저 온다(앱 useUserPhotoPostsList). */
export const useUserPhotoPostsList = (
  userId: number | string | undefined,
  species?: string,
  enabled = true
) =>
  usePagedList<UserPostListResponse, ProfilePost>(
    userId && enabled
      ? `/api/users/${userId}/posts?media=photo${species ? `&species=${encodeURIComponent(species)}` : ""}`
      : null,
    pickPosts
  );

/* ------------------------------------------------------------------ */
/* 목록 끝                                                              */
/* ------------------------------------------------------------------ */

type LoadMoreState = Pick<
  PagedListState<unknown>,
  "hasNextPage" | "isFetchingNextPage" | "isFetchNextPageError" | "loadMore"
>;

/** 남은 페이지가 있으면 '더보기', 받는 중이면 스피너, 실패하면 다시 시도(앱 LoadMoreFooter). */
export function LoadMoreFooter({ state, label }: { state: LoadMoreState; label: string }) {
  if (state.isFetchingNextPage) {
    return <LoadingBlock height={56} />;
  }
  if (state.isFetchNextPageError) {
    return (
      <div className="flex flex-col items-center gap-2 py-6">
        <p className="text-[13px] text-app-muted">더 불러오지 못했어요</p>
        <button
          type="button"
          aria-label={`${label} 다시 불러오기`}
          onClick={state.loadMore}
          className="text-[13px] font-semibold text-app-text"
        >
          다시 시도
        </button>
      </div>
    );
  }
  if (!state.hasNextPage) return null;
  return (
    <div className="px-4 py-3">
      <button
        type="button"
        aria-label={`${label} 더보기`}
        onClick={state.loadMore}
        className="h-11 w-full rounded-md bg-app-surface text-[14px] font-semibold text-app-text"
      >
        더보기
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 행 목록                                                              */
/* ------------------------------------------------------------------ */

/** 비공개(숨김) 글·분양글 표시(앱 HiddenPill). */
function HiddenPill() {
  return (
    <span className="shrink-0 rounded-full bg-app-surface px-1.5 py-px text-[11px] font-semibold text-app-muted">
      비공개
    </span>
  );
}

const LIST_ROW_CLASS =
  "flex items-start gap-3 border-b border-app-line px-4 py-3.5 transition-colors hover:bg-app-surface";

export function ProfilePostRows({
  list,
  emptyTitle = "등록한 게시물이 없습니다",
  emptyDescription,
}: {
  list: PagedListState<ProfilePost>;
  emptyTitle?: string;
  emptyDescription?: string;
}) {
  if (list.isLoading) return <LoadingBlock />;
  if (list.isError) {
    return (
      <RetryBlock
        message="게시물을 불러오지 못했습니다. 잠시 후 다시 시도해주세요."
        onRetry={list.refetch}
      />
    );
  }
  if (!list.items.length) {
    return emptyDescription ? (
      <EmptyBlock title={emptyTitle} description={emptyDescription} />
    ) : (
      <EmptyMessage message={emptyTitle} />
    );
  }
  return (
    <div>
      {list.items.map((post) => (
        <Link key={post.id} href={toPostPath(post.id, post.title)} className={LIST_ROW_CLASS}>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <p className="min-w-0 shrink truncate text-[16px] font-semibold text-app-text">{post.title}</p>
              {post.isHidden ? <HiddenPill /> : null}
            </div>
            <p className="mt-0.5 truncate text-[14px] text-app-muted">{toPostPlainText(post.description)}</p>
            <p className="mt-1.5 truncate text-[13px] text-app-muted">
              {post.category ? `${post.category} · ` : ""}
              {getTimeAgoString(new Date(post.createdAt))} · 댓글 {post._count?.comments ?? 0} · 좋아요{" "}
              {post._count?.Likes ?? 0}
            </p>
          </div>
          {post.image ? <Thumb imageId={post.image} variant="public" alt={post.title} /> : null}
        </Link>
      ))}
      <LoadMoreFooter state={list} label="게시물" />
    </div>
  );
}

/** 댓글 행 위 작은 회색 pill('답글'·'비공개'). 앱 HiddenPill 과 같은 모양 */
function RowPill({ children }: { children: string }) {
  return (
    <span className="shrink-0 rounded-full bg-app-surface px-1.5 py-px text-[11px] font-semibold text-app-muted">
      {children}
    </span>
  );
}

export function ProfileCommentRows({ list }: { list: PagedListState<ProfileComment> }) {
  if (list.isLoading) return <LoadingBlock />;
  if (list.isError) {
    return (
      <RetryBlock
        message="댓글을 불러오지 못했습니다. 잠시 후 다시 시도해주세요."
        onRetry={list.refetch}
      />
    );
  }
  if (!list.items.length) {
    return (
      <EmptyBlock
        title="작성한 댓글이 없습니다"
        description="댓글을 작성하면 여기에 모아볼 수 있어요."
      />
    );
  }
  return (
    <div>
      {list.items.map((item) => (
        // 누르면 글을 열고 그 댓글까지 스크롤한다.
        <Link
          key={item.id}
          href={toPostCommentPath(item.post.id, item.id, item.post.title)}
          className={LIST_ROW_CLASS}
        >
          <div className="min-w-0 flex-1">
            {/* 답글이면 '답글' pill + 'OO님 댓글에', 운영자가 숨겼으면 '비공개'(앱 마이페이지 댓글 목록과 같음) */}
            {item.parentId != null || item.isHidden ? (
              <div className="mb-1 flex min-w-0 items-center gap-1.5">
                {item.parentId != null ? <RowPill>답글</RowPill> : null}
                {item.replyTo ? (
                  <span className="min-w-0 truncate text-[13px] text-app-muted">
                    {`${item.replyTo.name}님 댓글에`}
                  </span>
                ) : null}
                {item.isHidden ? <RowPill>비공개</RowPill> : null}
              </div>
            ) : null}
            <p className="line-clamp-2 break-keep text-[15px] leading-[21px] text-app-text">{item.comment}</p>
            <p className="mt-1.5 truncate text-[13px] text-app-muted">
              {item.post.title} · {getTimeAgoString(new Date(item.createdAt))}
            </p>
          </div>
        </Link>
      ))}
      <LoadMoreFooter state={list} label="댓글" />
    </div>
  );
}

/**
 * 56 썸네일 분양글 행(앱 profiles/[id] ProductList · 마이페이지 ProductGrid).
 * showMeta: 프로필은 "상대시간 · 관심 N" 줄을 두고, 마이페이지는 이름·가격만 둔다(앱과 같다).
 */
export function ProfileProductRows({
  list,
  emptyMessage = "등록된 분양글이 없습니다",
  showMeta = true,
}: {
  list: PagedListState<ProfileProduct>;
  emptyMessage?: string;
  showMeta?: boolean;
}) {
  if (list.isLoading) return <LoadingBlock />;
  if (list.isError) {
    return (
      <RetryBlock
        message="분양글을 불러오지 못했습니다. 잠시 후 다시 시도해주세요."
        onRetry={list.refetch}
      />
    );
  }
  if (!list.items.length) return <EmptyMessage message={emptyMessage} />;
  return (
    <div>
      {list.items.map((product) => (
        <Link key={product.id} href={`/products/${product.id}`} className={LIST_ROW_CLASS}>
          <Thumb imageId={product.photos?.[0]} variant="product" alt={product.name} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <p className="min-w-0 shrink truncate text-[16px] font-medium text-app-text">{product.name}</p>
              {product.isHidden ? <HiddenPill /> : null}
            </div>
            <p className="mt-1 text-[15px] font-bold text-app-text">{formatProductPrice(product.price ?? null)}</p>
            {showMeta ? (
              <p className="mt-1 truncate text-[13px] text-app-muted">
                {getTimeAgoString(new Date(product.createdAt))} · 관심 {product._count?.favs ?? 0}
              </p>
            ) : null}
          </div>
        </Link>
      ))}
      <LoadMoreFooter state={list} label="분양글" />
    </div>
  );
}

export function ProfileAuctionRows({ list }: { list: PagedListState<ProfileAuction> }) {
  if (list.isLoading) return <LoadingBlock />;
  if (list.isError) {
    return (
      <RetryBlock
        message="경매를 불러오지 못했습니다. 잠시 후 다시 시도해주세요."
        onRetry={list.refetch}
      />
    );
  }
  if (!list.items.length) return <EmptyMessage message="등록한 경매가 없습니다" />;
  return (
    <div>
      {list.items.map((auction) => (
        <Link key={auction.id} href={toAuctionPath(auction.id, auction.title)} className={LIST_ROW_CLASS}>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[16px] font-semibold text-app-text">{auction.title}</p>
            <p className="mt-1 text-[15px] font-bold text-app-text">
              현재가 {auction.currentPrice.toLocaleString()}원
            </p>
            <p className="mt-1 truncate text-[13px] text-app-muted">
              {auction.status} · {auction.category ? `${auction.category} · ` : ""}입찰{" "}
              {auction._count.bids} · {getTimeAgoString(new Date(auction.createdAt))}
            </p>
          </div>
          {auction.photos?.[0] ? <Thumb imageId={auction.photos[0]} variant="public" alt={auction.title} /> : null}
        </Link>
      ))}
      <LoadMoreFooter state={list} label="경매" />
    </div>
  );
}

/** 프로필 혈통 행 둘째 줄: 소개, 없으면 "종 · 산지"(종이 없으면 "종 미지정"). */
function profileBloodlineSubtitle(card: BloodlineCardItem) {
  const description = card.description?.trim();
  if (description) return description;
  const origin =
    card.originLabel?.trim() || formatRegionShort({ sido: card.originSido, sigungu: card.originSigungu });
  return [card.speciesType?.trim() || "종 미지정", origin].filter(Boolean).join(" · ");
}

/** 셋째 줄: "혈통 · 보유 강산 · 받은 사람 3명" / "출처 카드 · 보유 도윤파파". 받은 사람 수가 없거나 0 이면 뺀다. */
function profileBloodlineMeta(card: BloodlineCardItem) {
  const owner = card.currentOwner.masked ? BLOODLINE_MASKED_USER_NAME : card.currentOwner.name;
  const received =
    card.cardType === "BLOODLINE" && typeof card.receivedCount === "number" && card.receivedCount > 0
      ? `받은 사람 ${card.receivedCount}명`
      : null;
  return [bloodlineCardTypeLabel(card.cardType), `보유 ${owner}`, received].filter(Boolean).join(" · ");
}

export function ProfileBloodlineRows({
  data,
  isLoading,
  isError,
  onRetry,
}: {
  data?: UserBloodlineCardsResponse;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
}) {
  if (isLoading) return <LoadingBlock />;
  if (isError && !data) {
    return (
      <RetryBlock
        message="혈통을 불러오지 못했습니다. 잠시 후 다시 시도해주세요."
        onRetry={onRetry}
      />
    );
  }
  if (!data?.cards?.length) return <EmptyMessage message="보유한 혈통이 없습니다" />;
  return (
    <div>
      {data.cards.map((card) => (
        <Link key={card.id} href={`/bloodline-management/card/${card.id}`} className={LIST_ROW_CLASS}>
          <Thumb imageId={card.image} variant="product" alt={card.name} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[16px] font-semibold text-app-text">{card.name}</p>
            <p className="mt-0.5 truncate text-[14px] text-app-muted">
              {profileBloodlineSubtitle(card)}
            </p>
            <p className="mt-1.5 truncate text-[13px] text-app-muted">{profileBloodlineMeta(card)}</p>
          </div>
        </Link>
      ))}
    </div>
  );
}
