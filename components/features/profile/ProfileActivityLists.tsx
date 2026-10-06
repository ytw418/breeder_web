"use client";

import Link from "next/link";
import { PostCard } from "@components/app/PostCard";
import { ProductCard } from "@components/app/ProductCard";
import { getTimeAgoString } from "@libs/client/utils";
import { toAuctionPath } from "@libs/auction-route";
import { toPostPath } from "@libs/post-route";
import type { ProductListResponse } from "pages/api/users/[id]/productList";
import type { UserPostListResponse } from "pages/api/users/[id]/posts";
import type { UserCommentListResponse } from "pages/api/users/[id]/comments";
import type { UserAuctionsResponse } from "pages/api/users/[id]/auctions";
import type { UserBloodlineCardsResponse } from "pages/api/users/[id]/bloodline-cards";
import type { PagedListState } from "./usePagedList";
import { usePagedList } from "./usePagedList";
import { EmptyBlock, EmptyMessage, LoadingBlock, RetryBlock, Thumb } from "./ProfileRows";

export type ProfilePost = UserPostListResponse["posts"][number];
export type ProfileComment = UserCommentListResponse["comments"][number];
export type ProfileProduct = ProductListResponse["products"][number] & {
  category?: string | null;
  status?: string | null;
  isHidden?: boolean | null;
};
export type ProfileAuction = UserAuctionsResponse["auctions"][number];
export type ProfileBloodlineCard = UserBloodlineCardsResponse["cards"][number];

const pickPosts = (page: UserPostListResponse) => page.posts;
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
        <PostCard
          key={post.id}
          post={{
            id: post.id,
            title: post.title,
            description: post.description,
            category: post.category,
            image: post.image,
            images: post.images,
            createdAt: post.createdAt,
            _count: post._count,
          }}
        />
      ))}
      <LoadMoreFooter state={list} label="게시물" />
    </div>
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
        <Link key={item.id} href={toPostPath(item.post.id, item.post.title)} className={LIST_ROW_CLASS}>
          <div className="min-w-0 flex-1">
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

export function ProfileProductRows({
  list,
  emptyMessage = "등록된 상품이 없습니다",
}: {
  list: PagedListState<ProfileProduct>;
  emptyMessage?: string;
}) {
  if (list.isLoading) return <LoadingBlock />;
  if (list.isError) {
    return (
      <RetryBlock
        message="상품을 불러오지 못했습니다. 잠시 후 다시 시도해주세요."
        onRetry={list.refetch}
      />
    );
  }
  if (!list.items.length) return <EmptyMessage message={emptyMessage} />;
  return (
    <div>
      {list.items.map((product) => (
        <ProductCard
          key={product.id}
          product={{
            id: product.id,
            name: product.name,
            price: product.price ?? null,
            image: product.photos?.[0] ?? null,
            createdAt: product.createdAt,
            category: product.category ?? null,
            status: product.status ?? null,
            isHidden: product.isHidden ?? null,
            wishCount: product._count?.favs ?? 0,
          }}
        />
      ))}
      <LoadMoreFooter state={list} label="상품" />
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
        message="혈통 카드를 불러오지 못했습니다. 잠시 후 다시 시도해주세요."
        onRetry={onRetry}
      />
    );
  }
  if (!data?.cards?.length) return <EmptyMessage message="등록한 혈통 카드가 없습니다" />;
  return (
    <div>
      {data.cards.map((card) => (
        <Link key={card.id} href={`/bloodline-management/card/${card.id}`} className={LIST_ROW_CLASS}>
          <Thumb imageId={card.image} variant="product" alt={card.name} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[16px] font-semibold text-app-text">{card.name}</p>
            <p className="mt-0.5 truncate text-[14px] text-app-muted">
              {card.description ||
                `${card.speciesType ? `${card.speciesType} · ` : ""}BC-${String(card.id).padStart(6, "0")}`}
            </p>
            <p className="mt-1.5 truncate text-[13px] text-app-muted">
              {card.cardType === "BLOODLINE" ? "혈통" : "라인"} · 소유 {card.currentOwner.name}
              {card.issueCount > 0 ? ` · 발급 ${card.issueCount}회` : ""}
            </p>
          </div>
        </Link>
      ))}
    </div>
  );
}
