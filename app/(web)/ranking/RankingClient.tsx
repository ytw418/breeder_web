"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import Image from "@components/atoms/Image";
import Link from "next/link";
import Layout from "@components/features/MainLayout";
import { cn, makeImageUrl } from "@libs/client/utils";
import { RankingResponse, BreederRank } from "pages/api/ranking";
import { useRouter } from "next/navigation";

/** 메인 탭 */
const TABS = [
  { id: "guinness", name: "브리더북", icon: "🏆" },
  { id: "coolInsect", name: "멋진 곤충", icon: "🪲" },
  { id: "mutation", name: "희귀 변이", icon: "✨" },
  { id: "breeder", name: "최고 브리더", icon: "👑" },
];

/** 기간 서브탭 */
const PERIOD_TABS = [
  { id: "all", name: "역대" },
  { id: "monthly", name: "이번 달" },
  { id: "yearly", name: "올해" },
];

/** 종 필터 (기네스북용) */
const SPECIES_OPTIONS = [
  "전체",
  "장수풍뎅이",
  "사슴벌레",
  "왕사슴벌레",
  "넓적사슴벌레",
  "애사슴벌레",
  "톱사슴벌레",
  "미야마사슴벌레",
];

/** 랭킹 메달 색상 */
const getMedalColor = (rank: number) => {
  if (rank === 1) return "bg-yellow-400 text-white";
  if (rank === 2) return "bg-gray-400 text-white";
  if (rank === 3) return "bg-amber-700 text-white";
  return "bg-gray-200 text-gray-600";
};

const RankingClient = () => {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("coolInsect");
  const [period, setPeriod] = useState("all");
  const [species, setSpecies] = useState(SPECIES_OPTIONS[0] || "");

  const apiUrl = () => {
    let url = `/api/ranking?tab=${activeTab}&period=${period}`;
    if (activeTab === "guinness" && species) {
      url += `&species=${species}`;
    }
    return url;
  };

  const { data, mutate } = useSWR<RankingResponse>(apiUrl());

  useEffect(() => {
    mutate();
  }, [activeTab, period, species]);

  useEffect(() => {
    if (activeTab === "guinness" && !species && SPECIES_OPTIONS.length > 0) {
      setSpecies(SPECIES_OPTIONS[0]);
    }
  }, [activeTab, species]);

  const handleMainTabClick = (tabId: string) => {
    if (tabId === "guinness") {
      router.push("/guinness");
      return;
    }
    setActiveTab(tabId);
  };

  const activeTabName =
    TABS.find((tab) => tab.id === activeTab)?.name ?? "랭킹";
  const activePeriodName =
    PERIOD_TABS.find((tab) => tab.id === period)?.name ?? "역대";
  const summaryCta =
    activeTab === "breeder"
      ? { href: "/guinness", label: "브리더북 보기" }
      : { href: "/posts/upload", label: "게시글 올리기" };

  return (
    <Layout canGoBack title="랭킹" seoTitle="랭킹">
      <div className="app-page flex flex-col min-h-screen">
        {/* 메인 탭 */}
        <div className="app-sticky-rail">
          <div className="app-rail flex px-3 snap-none">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleMainTabClick(tab.id)}
                className={cn(
                  "flex-shrink-0 flex items-center gap-1.5 px-3.5 py-3 text-[14px] font-semibold tracking-[-0.01em] whitespace-nowrap transition-colors border-b-2",
                  activeTab === tab.id
                    ? "border-slate-900 text-slate-900"
                    : "border-transparent text-slate-400 hover:text-slate-600"
                )}
              >
                <span>{tab.icon}</span>
                {tab.name}
              </button>
            ))}
          </div>
        </div>

        {/* 서브탭 (기간 + 종 필터) */}
        <div className="px-4 py-3 space-y-3 bg-slate-50/70 border-b border-slate-100 app-reveal-fade">
          {/* 기간 */}
          <div className="flex gap-2">
            {PERIOD_TABS.map((p) => (
              <button
                key={p.id}
                onClick={() => setPeriod(p.id)}
                className={cn(
                  "app-chip px-3 py-1.5 rounded-full text-xs tracking-tight",
                  period === p.id
                    ? "app-chip-active"
                    : "app-chip-muted bg-white"
                )}
              >
                {p.name}
              </button>
            ))}
          </div>

          {/* 종 필터 (기네스북) */}
          {activeTab === "guinness" && (
            <div className="app-rail flex gap-2 snap-none">
              {SPECIES_OPTIONS.map((sp) => (
                <button
                  key={sp}
                  onClick={() => setSpecies(sp)}
                  className={cn(
                    "app-chip px-3 py-1.5 rounded-full text-xs tracking-tight",
                    species === sp
                      ? "border-primary bg-primary text-white"
                      : "app-chip-muted bg-white"
                  )}
                >
                  {sp}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 콘텐츠 영역 */}
        <div className="flex-1 px-4 py-4 app-reveal">
          <div className="app-card mb-3 p-3">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="app-kicker">랭킹 기준</p>
                <p className="mt-1 app-body-md text-slate-700">
                  {activeTabName} · {activePeriodName}
                </p>
              </div>
              <Link href={summaryCta.href} className="app-section-link text-xs">
                {summaryCta.label}
                <span aria-hidden="true">›</span>
              </Link>
            </div>
          </div>

          {!data ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="app-card flex items-center gap-3 p-3 animate-pulse">
                  <div className="w-8 h-8 rounded-full bg-gray-200" />
                  <div className="w-12 h-12 rounded-lg bg-gray-200" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-200 rounded w-2/3" />
                    <div className="h-3 bg-gray-200 rounded w-1/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <>
              {/* 기네스북 */}
              {activeTab === "guinness" && (
                <GuinnessContent records={data.records || []} />
              )}

              {/* 멋진 곤충 / 변이 */}
              {(activeTab === "coolInsect" || activeTab === "mutation") && (
                <PostRankingContent posts={data.postRanking || []} />
              )}

              {/* 최고 브리더 */}
              {activeTab === "breeder" && (
                <BreederRankingContent ranking={data.breederRanking || []} />
              )}
            </>
          )}
        </div>
      </div>
    </Layout>
  );
};

/** 기네스북 콘텐츠 */
const GuinnessContent = ({
  records,
}: {
  records: RankingResponse["records"] | undefined;
}) => {
  const sizeRecords = (records || []).filter(
    (record) => record.recordType === "size"
  );

  if (!sizeRecords.length) {
    return (
      <EmptyState
        title="아직 등록된 기록이 없습니다"
        description="첫 기록을 등록해 보세요!"
      />
    );
  }

  return (
    <div className="space-y-3 app-reveal-fade">
      {sizeRecords.map((record, i) => (
        <div
          key={record.id}
          className={cn(
            "app-card app-card-interactive flex items-center gap-3 p-3 transition-colors",
            i < 3 ? "ring-1 ring-amber-200/70 bg-gradient-to-r from-amber-50/70 to-white" : ""
          )}
        >
          {/* 순위 */}
          <div
            className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0",
              getMedalColor(i + 1)
            )}
          >
            {i + 1}
          </div>

          {/* 증거 사진 */}
          <div className="w-14 h-14 rounded-lg overflow-hidden bg-slate-100 flex-shrink-0">
            <Image
              src={makeImageUrl(record.photo, "avatar")}
              className="w-full h-full object-cover"
              width={56}
              height={56}
              alt=""
            />
          </div>

          {/* 정보 */}
          <div className="flex-1 min-w-0">
            <p className="app-title-md truncate">{record.species}</p>
            <div className="mt-1 flex items-center gap-1.5">
              <span className="app-pill-muted">체장</span>
              <Link href={`/profiles/${record.user.id}`} className="app-caption text-slate-500 hover:text-slate-700">
                {record.user.name}
              </Link>
            </div>
          </div>

          {/* 기록 + 유저 */}
          <div className="text-right flex-shrink-0">
            <p className="text-lg font-bold text-primary">
              {record.value}
              <span className="app-caption ml-0.5">mm</span>
            </p>
            <p className="app-caption">공식 기록</p>
          </div>
        </div>
      ))}
    </div>
  );
};

/** 멋진 곤충 / 변이 콘텐츠 */
const PostRankingContent = ({ posts }: { posts: RankingResponse["postRanking"] }) => {
  if (!posts || posts.length === 0) {
    return (
      <EmptyState
        title="아직 등록된 게시글이 없습니다"
        description="곤충생활에서 사진/변이 카테고리로 게시글을 올려보세요!"
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Top 3 */}
      {posts.length >= 3 && (
        <div className="grid grid-cols-3 gap-2 mb-4">
          {posts.slice(0, 3).map((post, i) => (
            <Link
              key={post.id}
              href={`/posts/${post.id}`}
              className="relative overflow-hidden rounded-xl aspect-square app-card-interactive"
            >
              {post.image && (
                <Image
                  src={makeImageUrl(post.image, "public")}
                  className="object-cover"
                  fill
                  sizes="200px"
                  alt=""
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
              <div className="absolute top-2 left-2">
                <div
                  className={cn(
                    "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold",
                    getMedalColor(i + 1)
                  )}
                >
                  {i + 1}
                </div>
              </div>
              <div className="absolute bottom-2 left-2 right-2">
                <p className="text-white text-xs font-medium truncate">{post.title}</p>
                <p className="text-white/70 text-[10px]">
                  ❤️ {post._count.Likes}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* 리스트 */}
      {posts.slice(posts.length >= 3 ? 3 : 0).map((post, i) => {
        const rank = posts.length >= 3 ? i + 4 : i + 1;
        return (
          <Link
            key={post.id}
            href={`/posts/${post.id}`}
            className="app-card app-card-interactive flex items-center gap-3 p-3 transition-colors hover:bg-slate-50"
          >
            <div
              className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0",
                getMedalColor(rank)
              )}
            >
              {rank}
            </div>
            <div className="w-12 h-12 rounded-lg overflow-hidden bg-slate-100 flex-shrink-0">
              {post.image && (
                <Image
                  src={makeImageUrl(post.image, "public")}
                  className="w-full h-full object-cover"
                  width={48}
                  height={48}
                  alt=""
                />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="app-title-md truncate">{post.title}</p>
              <p className="app-caption">{post.user.name}</p>
            </div>
            <span className="app-pill-muted bg-rose-50 text-rose-500 flex-shrink-0">
              <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
              </svg>
              {post._count.Likes}
            </span>
          </Link>
        );
      })}
    </div>
  );
};

/** 최고 브리더 콘텐츠 */
const BreederRankingContent = ({ ranking }: { ranking: RankingResponse["breederRanking"] }) => {
  if (!ranking || ranking.length === 0) {
    return (
      <EmptyState
        title="아직 랭킹이 없습니다"
        description="활동을 시작하면 랭킹에 올라갈 수 있어요!"
      />
    );
  }

  return (
    <div className="space-y-3 app-reveal-fade">
      {/* Top 3 큰 카드 */}
      {ranking.length >= 3 && (
        <div className="flex items-end justify-center gap-3 py-6 mb-4">
          {/* 2등 */}
          <TopBreederCard rank={2} data={ranking[1]} />
          {/* 1등 */}
          <TopBreederCard rank={1} data={ranking[0]} />
          {/* 3등 */}
          <TopBreederCard rank={3} data={ranking[2]} />
        </div>
      )}

      {/* 나머지 리스트 */}
      {ranking.slice(ranking.length >= 3 ? 3 : 0).map((breeder, i) => {
        const rank = ranking.length >= 3 ? i + 4 : i + 1;
        return (
          <Link
            key={breeder.user.id}
            href={`/profiles/${breeder.user.id}`}
            className="app-card app-card-interactive flex items-center gap-3 p-3 transition-colors hover:bg-slate-50"
          >
            <div
              className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0",
                getMedalColor(rank)
              )}
            >
              {rank}
            </div>
            {breeder.user.avatar ? (
              <Image
                src={makeImageUrl(breeder.user.avatar, "avatar")}
                className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                width={40}
                height={40}
                alt=""
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-slate-200 flex-shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <p className="app-title-md">{breeder.user.name}</p>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                <span className="app-pill-muted">기록 {breeder.recordCount}</span>
                <span className="app-pill-muted">경매 {breeder.auctionCount}</span>
                <span className="app-pill-muted bg-rose-50 text-rose-500">
                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                  </svg>
                  {breeder.totalLikes}
                </span>
              </div>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-sm font-bold text-primary">{breeder.score.toLocaleString()}</p>
              <p className="app-caption text-[10px]">점</p>
            </div>
          </Link>
        );
      })}
    </div>
  );
};

/** Top 3 브리더 카드 */
const TopBreederCard = ({
  rank,
  data,
}: {
  rank: number;
  data: BreederRank;
}) => {
  if (!data) return null;
  const isFirst = rank === 1;

  return (
    <Link
      href={`/profiles/${data.user.id}`}
      className={cn(
        "flex flex-col items-center app-card-interactive",
        isFirst ? "order-2" : rank === 2 ? "order-1" : "order-3"
      )}
    >
      <div className={cn("relative mb-2", isFirst ? "w-20 h-20" : "w-16 h-16")}>
        <div
          className={cn(
            "absolute -top-2 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold z-10",
            getMedalColor(rank)
          )}
        >
          {rank}
        </div>
        {data.user.avatar ? (
          <Image
            src={makeImageUrl(data.user.avatar, "avatar")}
            className={cn(
              "rounded-full object-cover border-2",
              isFirst ? "border-yellow-400" : "border-slate-300"
            )}
            fill
            sizes="80px"
            alt=""
          />
        ) : (
          <div
            className={cn(
              "w-full h-full rounded-full border-2",
              isFirst
                ? "bg-slate-200 border-yellow-400"
                : "bg-slate-200 border-slate-300"
            )}
          />
        )}
      </div>
      <p className="app-caption font-semibold text-slate-900 text-center">{data.user.name}</p>
      <p className="app-caption font-bold text-primary">{data.score.toLocaleString()}점</p>
    </Link>
  );
};

/** 빈 상태 */
const EmptyState = ({ title, description }: { title: string; description: string }) => (
  <div className="flex flex-col items-center justify-center py-20 text-slate-400 app-reveal-fade">
    <p className="app-title-md text-slate-500">{title}</p>
    <p className="app-body-sm mt-1">{description}</p>
  </div>
);

export default RankingClient;
