"use client";

import Link from "next/link";
import { useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import useSWR from "swr";

import Image from "@components/atoms/Image";
import Layout from "@components/features/MainLayout";
import { toAuctionPath } from "@libs/auction-route";
import { cn, makeImageUrl } from "@libs/client/utils";
import { toPostPath } from "@libs/post-route";
import {
  AuctionRankingItem,
  BloodlineRankingItem,
  BreederRankingItem,
  RankingPeriod,
  TrendingPostItem,
} from "@libs/shared/ranking";

const RANKING_TABS = [
  { id: "breeders", label: "브리더", description: "게시, 댓글, 입찰, 낙찰 활동 점수" },
  { id: "auctions", label: "최고가 경매", description: "카테고리별 최고 낙찰 기록" },
  { id: "bloodlines", label: "인기 혈통", description: "보유자 수와 발급 수 기반" },
  { id: "community", label: "커뮤니티", description: "좋아요와 댓글 반응이 높은 글" },
] as const;

const PERIOD_TABS = [
  { id: "weekly", label: "이번 주" },
  { id: "all", label: "역대" },
] as const;

type RankingTab = (typeof RANKING_TABS)[number]["id"];

type RankingResponseMap = {
  breeders: { success: boolean; items: BreederRankingItem[]; error?: string };
  auctions: { success: boolean; items: AuctionRankingItem[]; error?: string };
  bloodlines: { success: boolean; items: BloodlineRankingItem[]; error?: string };
  community: { success: boolean; items: TrendingPostItem[]; error?: string };
};

const isRankingTab = (value: string | null): value is RankingTab =>
  RANKING_TABS.some((tab) => tab.id === value);

const isRankingPeriod = (value: string | null): value is RankingPeriod =>
  value === "weekly" || value === "all";

const formatRankDelta = (rankDelta: number) => {
  if (rankDelta > 0) return `▲ ${rankDelta}`;
  if (rankDelta < 0) return `▼ ${Math.abs(rankDelta)}`;
  return "유지";
};

const getSummary = (tab: RankingTab, period: RankingPeriod) => {
  const periodLabel = period === "weekly" ? "이번 주" : "역대";

  if (tab === "breeders") {
    return {
      title: `${periodLabel} 브리더 랭킹`,
      description:
        period === "weekly"
          ? "KST 기준 이번 주 게시, 댓글, 입찰, 낙찰 활동 점수를 합산합니다."
          : "누적 게시, 댓글, 입찰, 낙찰 활동을 합산한 역대 리더보드입니다.",
      ctaHref: "/posts/upload",
      ctaLabel: "활동 시작하기",
    };
  }

  if (tab === "auctions") {
    return {
      title: `${periodLabel} 최고가 경매`,
      description:
        period === "weekly"
          ? "이번 주 종료된 낙찰 경매만 대상으로 카테고리별 최고가를 보여줍니다."
          : "누적 낙찰 기록 기준으로 카테고리별 최고가 경매를 보여줍니다.",
      ctaHref: "/auctions/create",
      ctaLabel: "경매 등록하기",
    };
  }

  if (tab === "bloodlines") {
    return {
      title: `${periodLabel} 인기 혈통`,
      description:
        period === "weekly"
          ? "실제 보유자 수가 많은 혈통카드를 우선으로 보여줍니다."
          : "실제 보유자 수와 총 발급 수를 기준으로 인기 혈통을 정렬합니다.",
      ctaHref: "/bloodline-cards/create",
      ctaLabel: "혈통카드 만들기",
    };
  }

  return {
    title: `${periodLabel} 커뮤니티 랭킹`,
    description:
      period === "weekly"
        ? "최근 24시간 좋아요와 댓글 반응이 빠르게 늘어난 글을 집계합니다."
        : "누적 좋아요와 댓글 반응이 높은 커뮤니티 글을 보여줍니다.",
    ctaHref: "/posts/upload",
    ctaLabel: "글 작성하기",
  };
};

const getApiUrl = (tab: RankingTab, period: RankingPeriod) => {
  if (tab === "breeders") {
    return `/api/rankings/breeders?limit=50&period=${period}`;
  }
  if (tab === "auctions") {
    return `/api/rankings/auctions?limit=50&periodScope=${period === "weekly" ? "week" : "all"}`;
  }
  if (tab === "bloodlines") {
    return `/api/rankings/bloodlines?limit=50&period=${period}`;
  }
  return `/api/rankings/community?limit=50&window=${period === "weekly" ? "24h" : "all"}`;
};

const EmptyState = ({
  period,
  onSwitchPeriod,
}: {
  period: RankingPeriod;
  onSwitchPeriod: (period: RankingPeriod) => void;
}) => (
  <div className="app-card p-5 text-center">
    <p className="text-sm font-semibold text-slate-700">집계 가능한 랭킹 데이터가 없습니다.</p>
    <p className="mt-2 text-sm text-slate-500">
      {period === "weekly"
        ? "이번 주 데이터가 비어 있습니다. 역대 기준으로 먼저 확인해보세요."
        : "조건을 만족하는 활동이 아직 없습니다."}
    </p>
    {period === "weekly" ? (
      <button
        type="button"
        onClick={() => onSwitchPeriod("all")}
        className="mt-4 inline-flex h-10 items-center rounded-full bg-slate-900 px-4 text-sm font-semibold text-white"
      >
        역대 랭킹 보기
      </button>
    ) : null}
  </div>
);

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
  const { data, isLoading } = useSWR<RankingResponseMap[RankingTab]>(apiUrl);

  const updateQuery = (nextTab: RankingTab, nextPeriod: RankingPeriod) => {
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    params.set("tab", nextTab);
    params.set("period", nextPeriod);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const items = data?.items ?? [];

  return (
    <Layout canGoBack title="랭킹" seoTitle="랭킹">
      <div className="app-page min-h-screen bg-slate-50/70">
        <section className="border-b border-slate-200 bg-white px-4 py-4">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {RANKING_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => updateQuery(tab.id, period)}
                className={cn(
                  "rounded-full px-4 py-2 text-sm font-semibold transition-colors",
                  activeTab === tab.id
                    ? "bg-slate-900 text-white"
                    : "bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            {PERIOD_TABS.map((periodTab) => (
              <button
                key={periodTab.id}
                type="button"
                onClick={() => updateQuery(activeTab, periodTab.id)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
                  period === periodTab.id
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-700"
                )}
              >
                {periodTab.label}
              </button>
            ))}
          </div>
        </section>

        <section className="px-4 py-4">
          <div className="app-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="app-kicker">랭킹 기준</p>
                <h2 className="mt-1 text-lg font-black tracking-tight text-slate-900">{summary.title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{summary.description}</p>
              </div>
              <Link href={summary.ctaHref} className="app-section-link shrink-0 text-xs">
                {summary.ctaLabel}
                <span aria-hidden="true">›</span>
              </Link>
            </div>
          </div>
        </section>

        <section className="px-4 pb-8">
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="app-card flex items-center gap-3 p-4 animate-pulse">
                  <div className="h-10 w-10 rounded-full bg-slate-200" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-1/2 rounded bg-slate-200" />
                    <div className="h-3 w-1/3 rounded bg-slate-200" />
                  </div>
                </div>
              ))}
            </div>
          ) : data?.success === false ? (
            <div className="app-card p-5 text-sm text-rose-500">{data.error || "랭킹을 불러오지 못했습니다."}</div>
          ) : items.length === 0 ? (
            <EmptyState period={period} onSwitchPeriod={(nextPeriod) => updateQuery(activeTab, nextPeriod)} />
          ) : (
            <div className="space-y-3">
              {activeTab === "breeders" &&
                (items as BreederRankingItem[]).map((item) => (
                  <Link
                    key={item.user.id}
                    href={`/profiles/${item.user.id}`}
                    className="app-card app-card-interactive flex items-center gap-3 p-4"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-900 text-sm font-black text-white">
                      {item.rank}
                    </div>
                    <div className="h-14 w-14 overflow-hidden rounded-2xl bg-slate-100">
                      {item.user.avatar ? (
                        <Image
                          src={makeImageUrl(item.user.avatar, "avatar")}
                          alt={item.user.name}
                          width={56}
                          height={56}
                          className="h-full w-full object-cover"
                        />
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="truncate text-sm font-semibold text-slate-900">{item.user.name}</h3>
                        <span className="text-xs font-semibold text-slate-400">{formatRankDelta(item.rankDelta)}</span>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">점수 {item.score.toLocaleString()}</p>
                      <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] text-slate-600">
                        <span className="rounded-full bg-slate-100 px-2 py-1">게시 {item.postsCount}</span>
                        <span className="rounded-full bg-slate-100 px-2 py-1">댓글 {item.commentsCount}</span>
                        <span className="rounded-full bg-slate-100 px-2 py-1">입찰 {item.bidsCount}</span>
                        <span className="rounded-full bg-slate-100 px-2 py-1">낙찰 {item.auctionWinsCount}</span>
                      </div>
                    </div>
                  </Link>
                ))}

              {activeTab === "auctions" &&
                (items as AuctionRankingItem[]).map((item) => (
                  <Link
                    key={item.auctionId}
                    href={toAuctionPath(item.auctionId, item.title)}
                    className="app-card app-card-interactive block p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-bold text-emerald-600">#{item.rank} {item.topLevelCategory}</p>
                        <h3 className="mt-1 text-base font-semibold text-slate-900">{item.title}</h3>
                        <p className="mt-2 text-2xl font-black tracking-tight text-slate-900">
                          {item.currentPrice.toLocaleString()}원
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          판매자 {item.seller.name} · {new Date(item.endAt).toLocaleDateString("ko-KR")}
                        </p>
                      </div>
                      <div className="rounded-2xl bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700">
                        #{item.rank}
                      </div>
                    </div>
                  </Link>
                ))}

              {activeTab === "bloodlines" &&
                (items as BloodlineRankingItem[]).map((item) => (
                  <Link
                    key={item.bloodlineRootId}
                    href={`/bloodline-management/card/${item.bloodlineRootId}`}
                    className="app-card app-card-interactive block p-4"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-sm font-black text-amber-700">
                        {item.rank}
                      </div>
                    <div className="h-14 w-14 overflow-hidden rounded-2xl bg-slate-100">
                      {item.image ? (
                        <Image
                          src={makeImageUrl(item.image, "public")}
                          alt={item.name}
                            width={56}
                          height={56}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-end bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.88),transparent_35%),linear-gradient(145deg,#0f172a,#1e293b_60%,#f59e0b)] p-2">
                          <span className="text-[9px] font-semibold tracking-[0.2em] text-white/80">
                            BLOODLINE
                          </span>
                        </div>
                      )}
                    </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="truncate text-sm font-semibold text-slate-900">{item.name}</h3>
                        <p className="mt-1 text-xs text-slate-500">
                          {item.speciesType || "종 미지정"} · {item.creator.name}
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-slate-600">
                      <div className="rounded-2xl bg-slate-50 px-3 py-2">보유자 {item.ownerCount}</div>
                      <div className="rounded-2xl bg-slate-50 px-3 py-2">발급 수 {item.issuedCount}</div>
                    </div>
                  </Link>
                ))}

              {activeTab === "community" &&
                (items as TrendingPostItem[]).map((item) => (
                  <Link
                    key={item.post.id}
                    href={toPostPath(item.post.id, item.post.title)}
                    className="app-card app-card-interactive block p-4"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-100 text-sm font-black text-rose-700">
                        {item.rank}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="line-clamp-2 text-sm font-semibold text-slate-900">{item.post.title}</h3>
                        <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-500">
                          {item.post.description}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-slate-500">
                          <span>{item.post.user.name}</span>
                          <span>좋아요 {item.likes24h}</span>
                          <span>댓글 {item.comments24h}</span>
                        </div>
                      </div>
                      {item.post.image ? (
                        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-2xl bg-slate-100">
                          <Image
                            src={makeImageUrl(item.post.image, "public")}
                            alt={item.post.title}
                            width={64}
                            height={64}
                            className="h-full w-full object-cover"
                          />
                        </div>
                      ) : null}
                    </div>
                  </Link>
                ))}
            </div>
          )}
        </section>
      </div>
    </Layout>
  );
};

export default RankingClient;
