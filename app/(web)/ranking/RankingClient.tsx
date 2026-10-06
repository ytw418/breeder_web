"use client";

import Link from "next/link";
import { useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import useSWR from "swr";

import Image from "@components/atoms/Image";
import Layout from "@components/features/MainLayout";
import { FilterChip, FilterChipRail } from "@components/app/FilterChip";
import { toAuctionPath } from "@libs/auction-route";
import { cn, makeImageUrl } from "@libs/client/utils";
import { toPostPath } from "@libs/post-route";
import { withoutBlocked } from "@libs/shared/blockFilter";
import {
  AuctionRankingItem,
  BloodlineRankingItem,
  BreederRankingItem,
  getRankingOwnerId,
  RankingPeriod,
  TrendingPostItem,
} from "@libs/shared/ranking";
import useBlocks from "hooks/useBlocks";

const RANKING_TABS = [
  { id: "breeders", label: "브리더" },
  { id: "auctions", label: "최고가 경매" },
  { id: "bloodlines", label: "인기 혈통" },
  { id: "community", label: "커뮤니티" },
] as const;

const PERIOD_TABS = [
  { id: "weekly", label: "이번 주" },
  { id: "all", label: "역대" },
] as const;

type RankingTab = (typeof RANKING_TABS)[number]["id"];

type RankingResponse = {
  success: boolean;
  items: Array<BreederRankingItem | AuctionRankingItem | BloodlineRankingItem | TrendingPostItem>;
  error?: string;
};

const isRankingTab = (value: string | null): value is RankingTab => RANKING_TABS.some((tab) => tab.id === value);

const isRankingPeriod = (value: string | null): value is RankingPeriod => value === "weekly" || value === "all";

const formatRankDelta = (rankDelta: number) => {
  if (rankDelta > 0) return `▲ ${rankDelta}`;
  if (rankDelta < 0) return `▼ ${Math.abs(rankDelta)}`;
  return "유지";
};

/** 랭킹 기준 한 줄 + CTA(앱 getSummary 와 같은 문구). */
const getSummary = (tab: RankingTab, period: RankingPeriod) => {
  if (tab === "breeders") {
    return {
      note:
        period === "weekly"
          ? "이번 주 게시·댓글·입찰·낙찰 활동 점수 합계 (KST 기준)"
          : "누적 게시·댓글·입찰·낙찰 활동 점수 합계",
      ctaHref: "/posts/upload",
      ctaLabel: "활동 시작하기",
    };
  }
  if (tab === "auctions") {
    return {
      note:
        period === "weekly"
          ? "이번 주 종료된 낙찰 경매의 카테고리별 최고가"
          : "누적 낙찰 기록 기준 카테고리별 최고가",
      ctaHref: "/auctions/create",
      ctaLabel: "경매 등록하기",
    };
  }
  if (tab === "bloodlines") {
    return {
      note: period === "weekly" ? "실제 보유자 수가 많은 혈통카드 순" : "보유자 수와 총 발급 수 기준 인기 혈통 순",
      ctaHref: "/bloodline-cards/create",
      ctaLabel: "혈통카드 만들기",
    };
  }
  return {
    note:
      period === "weekly"
        ? "최근 24시간 좋아요·댓글 반응이 빠르게 늘어난 글"
        : "누적 좋아요·댓글 반응이 높은 커뮤니티 글",
    ctaHref: "/posts/upload",
    ctaLabel: "글 작성하기",
  };
};

const getApiUrl = (tab: RankingTab, period: RankingPeriod) => {
  if (tab === "breeders") return `/api/rankings/breeders?limit=50&period=${period}`;
  if (tab === "auctions") {
    return `/api/rankings/auctions?limit=50&periodScope=${period === "weekly" ? "week" : "all"}`;
  }
  if (tab === "bloodlines") return `/api/rankings/bloodlines?limit=50&period=${period}`;
  return `/api/rankings/community?limit=50&window=${period === "weekly" ? "24h" : "all"}`;
};

/* ------------------------------------------------------------------ */
/* 행                                                                  */
/* ------------------------------------------------------------------ */

function SkeletonList() {
  return (
    <div aria-hidden="true">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="flex h-[72px] items-center border-b border-app-line px-4">
          <div className="h-4 w-6 animate-pulse rounded bg-app-surface" />
          <div className="ml-3 h-11 w-11 animate-pulse rounded-full bg-app-surface" />
          <div className="ml-3 flex-1">
            <div className="h-3.5 w-1/2 animate-pulse rounded bg-app-surface" />
            <div className="mt-2 h-3 w-[35%] animate-pulse rounded bg-app-surface" />
          </div>
        </div>
      ))}
    </div>
  );
}

function RankRow({
  rank,
  imageId,
  imageVariant = "public",
  circle,
  title,
  meta,
  right,
  href,
}: {
  rank: number;
  imageId?: string | null;
  imageVariant?: "avatar" | "public" | "product";
  circle?: boolean;
  title: string;
  meta: string;
  right?: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="flex h-[72px] items-center border-b border-app-line bg-app-bg px-4 transition-colors hover:bg-app-surface"
    >
      <span className={cn("w-6 shrink-0 text-[20px] font-bold", rank <= 3 ? "text-app-brand" : "text-app-text")}>
        {rank}
      </span>
      <div
        className={cn("ml-3 h-11 w-11 shrink-0 overflow-hidden bg-app-surface", circle ? "rounded-full" : "rounded-lg")}
      >
        {imageId ? (
          <Image
            src={makeImageUrl(imageId, imageVariant)}
            alt={title}
            width={44}
            height={44}
            className="h-full w-full object-cover"
          />
        ) : null}
      </div>
      <div className="ml-3 min-w-0 flex-1">
        <p className="truncate text-[16px] font-semibold text-app-text">{title}</p>
        <p className="mt-0.5 truncate text-[13px] text-app-muted">{meta}</p>
      </div>
      {right ? <span className="ml-2 shrink-0 text-[12px] text-app-muted">{right}</span> : null}
    </Link>
  );
}

/* ------------------------------------------------------------------ */
/* 화면                                                                */
/* ------------------------------------------------------------------ */

const RankingClient = () => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tabParam = searchParams?.get("tab") ?? null;
  const periodParam = searchParams?.get("period") ?? null;
  const activeTab: RankingTab = isRankingTab(tabParam) ? tabParam : "breeders";
  const period: RankingPeriod = isRankingPeriod(periodParam) ? periodParam : "weekly";

  const summary = getSummary(activeTab, period);
  const apiUrl = useMemo(() => getApiUrl(activeTab, period), [activeTab, period]);
  const { data, error, isLoading, mutate } = useSWR<RankingResponse>(apiUrl);
  const { blockedIds } = useBlocks();

  const updateQuery = (nextTab: RankingTab, nextPeriod: RankingPeriod) => {
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    params.set("tab", nextTab);
    params.set("period", nextPeriod);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const items = useMemo(
    () => withoutBlocked(data?.items ?? [], blockedIds, (item) => getRankingOwnerId(activeTab, item)),
    [activeTab, blockedIds, data?.items]
  );

  let list;
  if (isLoading) {
    list = <SkeletonList />;
  } else if ((error && !data) || data?.success === false) {
    list = (
      <div className="flex flex-col items-center px-4 py-14 text-center" role="alert">
        <p className="text-[14px] text-app-muted">
          {data?.error || (error instanceof Error && error.message) || "랭킹을 불러오지 못했습니다."}
        </p>
        <button
          type="button"
          onClick={() => void mutate()}
          className="mt-4 h-10 rounded-md bg-app-surface px-4 text-[14px] font-semibold text-app-text"
        >
          다시 시도
        </button>
      </div>
    );
  } else if (items.length === 0) {
    list = (
      <div className="px-4 py-14 text-center">
        <p className="text-[16px] font-semibold text-app-text">집계 가능한 랭킹 데이터가 없습니다</p>
        <p className="mt-1.5 text-[14px] text-app-muted">
          {period === "weekly"
            ? "이번 주 데이터가 비어 있어요. 역대 기준으로 확인해보세요."
            : "조건을 만족하는 활동이 아직 없어요."}
        </p>
        {period === "weekly" ? (
          <button
            type="button"
            onClick={() => updateQuery(activeTab, "all")}
            className="mt-4 h-10 rounded-md bg-app-surface px-4 text-[14px] font-semibold text-app-text"
          >
            역대 랭킹 보기
          </button>
        ) : (
          <Link
            href={summary.ctaHref}
            className="mt-4 inline-flex h-10 items-center rounded-md bg-app-surface px-4 text-[14px] font-semibold text-app-text"
          >
            {summary.ctaLabel}
          </Link>
        )}
      </div>
    );
  } else {
    list = (
      <div>
        {activeTab === "breeders" &&
          (items as BreederRankingItem[]).map((item) => (
            <RankRow
              key={item.user.id}
              rank={item.rank}
              imageId={item.user.avatar}
              imageVariant="avatar"
              circle
              title={item.user.name}
              meta={`점수 ${item.score.toLocaleString()} · 게시 ${item.postsCount} · 댓글 ${item.commentsCount}`}
              right={formatRankDelta(item.rankDelta)}
              href={`/profiles/${item.user.id}`}
            />
          ))}

        {activeTab === "auctions" &&
          (items as AuctionRankingItem[]).map((item) => (
            <RankRow
              key={item.auctionId}
              rank={item.rank}
              imageId={item.photo}
              imageVariant="product"
              title={item.title}
              meta={`${item.currentPrice.toLocaleString()}원 · ${item.topLevelCategory} · ${item.seller.name}`}
              href={toAuctionPath(item.auctionId, item.title)}
            />
          ))}

        {activeTab === "bloodlines" &&
          (items as BloodlineRankingItem[]).map((item) => (
            <RankRow
              key={item.bloodlineRootId}
              rank={item.rank}
              imageId={item.image}
              title={item.name}
              meta={`${item.speciesType || "종 미지정"} · 보유자 ${item.ownerCount} · 발급 ${item.issuedCount}`}
              right={formatRankDelta(item.rankDelta)}
              href={`/bloodline-management/card/${item.bloodlineRootId}`}
            />
          ))}

        {activeTab === "community" &&
          (items as TrendingPostItem[]).map((item) => (
            <RankRow
              key={item.post.id}
              rank={item.rank}
              imageId={item.post.image}
              title={item.post.title}
              meta={`${item.post.user.name} · 좋아요 ${item.likes24h} · 댓글 ${item.comments24h}`}
              href={toPostPath(item.post.id, item.post.title)}
            />
          ))}
      </div>
    );
  }

  return (
    <Layout canGoBack title="랭킹" seoTitle="랭킹">
      <div className="min-h-screen bg-app-bg pb-8">
        {/* 카테고리 칩 1줄 */}
        <FilterChipRail className="mt-1">
          {RANKING_TABS.map((tab) => (
            <FilterChip
              key={tab.id}
              label={tab.label}
              selected={activeTab === tab.id}
              onClick={() => updateQuery(tab.id, period)}
            />
          ))}
        </FilterChipRail>

        {/* 기간 텍스트 세그먼트(오른쪽) */}
        <div className="flex items-center justify-end px-4 pt-2" role="radiogroup" aria-label="랭킹 기간">
          {PERIOD_TABS.map((periodTab, index) => {
            const selected = period === periodTab.id;
            return (
              <span key={periodTab.id} className="flex items-center">
                {index > 0 ? (
                  <span className="mx-2 text-[13px] text-app-caption" aria-hidden="true">
                    ·
                  </span>
                ) : null}
                <button
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => updateQuery(activeTab, periodTab.id)}
                  className={cn(
                    "py-0.5 text-[13px]",
                    selected ? "font-bold text-app-text" : "font-medium text-app-muted"
                  )}
                >
                  {periodTab.label}
                </button>
              </span>
            );
          })}
        </div>

        {/* 랭킹 기준 한 줄 + 링크 */}
        <div className="flex items-center px-4 pb-3 pt-2.5">
          <p className="min-w-0 flex-1 truncate text-[13px] text-app-muted">{summary.note}</p>
          <Link href={summary.ctaHref} className="ml-2 shrink-0 text-[13px] font-semibold text-app-muted">
            {summary.ctaLabel} ›
          </Link>
        </div>

        <div className="border-t border-app-line">{list}</div>
      </div>
    </Layout>
  );
};

export default RankingClient;
