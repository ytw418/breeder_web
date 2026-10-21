"use client";
/**
 * 받은 거래 후기 — 앱 profiles/[id]/reviews.tsx, 앱 docs/prd/trade-review.md S-8,
 * 시안 design/mockups/trade-review/A-karrot.html #reviews-list #reviews-empty.
 *
 * 구조:
 *   프로필 헤더(뒤로 · '받은 거래 후기 N', 공유·더보기 없음)
 *   키워드 집계 칩 가로 스크롤('응답이 빨라요 **3**', 많은 순)
 *   후기 행(작성자 · 날짜 · 키워드 칩 · 분양글 줄 44 · 분양자 답글) — 본인이면 답글 없는 후기에 '답글 남기기',
 *   운영자는 ⋯ 숨기기(web-only)
 *   빈 상태(64 원 + 별) / 로딩 스켈레톤 3 / 오류 다시 시도 / 20개씩 '더보기'
 *
 * API 는 GET /api/users/:id/reviews(공개). `/profiles/0/reviews`(비로그인 사이드 메뉴 링크)처럼 id 가 양의 정수가
 * 아니면 로그인한 내 id 경로로 바꾼다.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Image from "@components/atoms/Image";
import MainLayout from "@components/features/MainLayout";
import { LoadMoreFooter } from "@components/features/profile/ProfileActivityLists";
import { LineIcon, LoadingBlock, RetryBlock } from "@components/features/profile/ProfileRows";
import { usePagedList } from "@components/features/profile/usePagedList";
import {
  TradeReplyButton,
  TradeReviewAdminMenu,
  TradeReviewContent,
} from "@components/features/trade/TradeReviewCard";
import { useTradeReviewRefresh } from "@components/features/trade/useTradeReviewRefresh";
import { TradeReviewReplySheet } from "@components/features/trade/TradeReviewReplySheet";
import useUser from "hooks/useUser";
import { makeImageUrl } from "@libs/client/utils";
import { getProductPath } from "@libs/product-route";
import {
  keywordLabel,
  type TradeReviewProduct,
  type UserTradeReviewItem,
  type UserTradeReviewsResponse,
} from "@libs/shared/tradeReview";

const pickItems = (page: UserTradeReviewsResponse) => page.items;

export default function ReviewsClient({ id }: { id: string }) {
  const router = useRouter();
  const { user, isLoading: userLoading, isAdmin } = useUser();
  const numericId = Number(id);
  const resolvingOwner = !(Number.isInteger(numericId) && numericId > 0);
  const isMine = Boolean(user?.id && user.id === numericId);
  const list = usePagedList<UserTradeReviewsResponse, UserTradeReviewItem>(
    resolvingOwner ? null : `/api/users/${numericId}/reviews`,
    pickItems
  );
  const refresh = useTradeReviewRefresh();
  const [replyTarget, setReplyTarget] = useState<UserTradeReviewItem | null>(null);

  useEffect(() => {
    if (!resolvingOwner || userLoading) return;
    if (user?.id) router.replace(`/profiles/${user.id}/reviews`);
    else router.replace(`/auth/login?next=${encodeURIComponent("/profiles/0/reviews")}`);
  }, [resolvingOwner, router, user?.id, userLoading]);

  const total = list.firstPage?.total;
  const keywordCounts = (list.firstPage?.keywordCounts ?? []).filter((item) => keywordLabel(item.key));
  const title = total ? `받은 거래 후기 ${total}` : "받은 거래 후기";

  let content;
  if (resolvingOwner) {
    content = <LoadingBlock height={320} />;
  } else if (list.isLoading) {
    content = (
      <div aria-label="불러오는 중" role="status">
        {Array.from({ length: 3 }, (_, i) => (
          <ReviewRowSkeleton key={i} />
        ))}
      </div>
    );
  } else if (list.isError) {
    content = <RetryBlock message="받은 거래 후기를 불러오지 못했어요" onRetry={list.refetch} />;
  } else if (list.items.length === 0) {
    content = <ReviewsEmpty />;
  } else {
    content = (
      <>
        {keywordCounts.length > 0 ? (
          <ul
            aria-label="받은 키워드"
            className="flex gap-2 overflow-x-auto border-b border-app-surface px-4 py-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {keywordCounts.map((item) => (
              <li
                key={item.key}
                aria-label={`${keywordLabel(item.key)} ${item.count}개`}
                className="flex h-8 shrink-0 items-center gap-1 whitespace-nowrap rounded-2xl border border-app-border px-3 text-[13px] text-app-text"
              >
                {keywordLabel(item.key)}
                <span className="font-bold">{item.count}</span>
              </li>
            ))}
          </ul>
        ) : null}
        <ul>
          {list.items.map((item) => (
            <li key={item.id} className="border-b border-app-surface p-4">
              <TradeReviewContent
                review={item}
                beforeReply={<ReviewProductLine product={item.product} />}
                menu={isAdmin ? <TradeReviewAdminMenu reviewId={item.id} hidden={false} /> : null}
              >
                {isMine && !item.reply ? <TradeReplyButton onClick={() => setReplyTarget(item)} /> : null}
              </TradeReviewContent>
            </li>
          ))}
        </ul>
        <LoadMoreFooter state={list} label="받은 거래 후기" />
      </>
    );
  }

  return (
    <MainLayout headerVariant="profile" title={title} seoTitle="받은 거래 후기">
      <div className="pb-8">{content}</div>
      <TradeReviewReplySheet
        open={replyTarget != null}
        productId={replyTarget?.product.id ?? 0}
        review={replyTarget}
        onClose={() => setReplyTarget(null)}
        onChanged={() => void refresh()}
      />
    </MainLayout>
  );
}

/** 분양글 줄 44(썸네일 32 r6 · 제목 13 sub, 누르면 상세). 지운 분양글은 '삭제된 분양글'(muted, 누를 수 없음). */
function ReviewProductLine({ product }: { product: TradeReviewProduct }) {
  const thumb = "h-8 w-8 shrink-0 overflow-hidden rounded-md bg-app-placeholder";
  if ("removed" in product) {
    return (
      <div className="mt-2.5 flex h-11 items-center gap-2">
        <span className={thumb} aria-hidden="true" />
        <span className="text-[13px] text-app-muted">삭제된 분양글</span>
      </div>
    );
  }
  return (
    <Link
      href={getProductPath(product.id, product.name)}
      aria-label={`${product.name} 분양글 보기`}
      className="mt-2.5 flex h-11 items-center gap-2"
    >
      <span className={thumb}>
        {product.image ? (
          <Image
            src={makeImageUrl(product.image, "product")}
            alt=""
            width={32}
            height={32}
            className="h-full w-full object-cover"
          />
        ) : null}
      </span>
      <span className="min-w-0 flex-1 truncate text-[13px] text-app-sub">{product.name}</span>
    </Link>
  );
}

/** 빈 상태(64 원 + 별 28 · 16/600 · 14 muted, 시안 .empty). */
function ReviewsEmpty() {
  return (
    <div className="flex flex-col items-center px-6 pb-20 pt-12 text-center">
      <span className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-app-surface text-app-caption">
        <LineIcon name="star" size={28} />
      </span>
      <p className="text-[16px] font-semibold leading-[22px] text-app-text">아직 받은 거래 후기가 없어요</p>
      <p className="mt-1.5 text-[14px] leading-5 text-app-muted">
        입양자가 입양을 확정하면
        <br />
        거래 후기를 남길 수 있어요
      </p>
    </div>
  );
}

function ReviewRowSkeleton() {
  const bar = "animate-pulse bg-app-placeholder";
  return (
    <div className="border-b border-app-surface p-4" aria-hidden="true">
      <div className="flex items-center gap-1.5">
        <span className={`h-6 w-6 rounded-full ${bar}`} />
        <span className={`h-3 w-24 rounded ${bar}`} />
      </div>
      <div className="mt-2 flex gap-1.5">
        <span className={`h-7 w-24 rounded-[14px] ${bar}`} />
        <span className={`h-7 w-[72px] rounded-[14px] ${bar}`} />
      </div>
      <div className="mt-[18px] flex items-center gap-2">
        <span className={`h-8 w-8 rounded-md ${bar}`} />
        <span className={`h-3 w-[55%] rounded ${bar}`} />
      </div>
    </div>
  );
}
