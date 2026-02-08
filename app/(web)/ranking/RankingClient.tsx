"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import Image from "@components/atoms/Image";
import Link from "next/link";
import Layout from "@components/features/MainLayout";
import { cn, makeImageUrl } from "@libs/client/utils";
import { RankingResponse, BreederRank } from "pages/api/ranking";

/** 메인 탭 */
const TABS = [
  { id: "guinness", name: "기네스북", icon: "🏆" },
  { id: "coolInsect", name: "멋진 곤충", icon: "🪲" },
  { id: "mutation", name: "희귀 변이", icon: "✨" },
  { id: "breeder", name: "최고 브리더", icon: "👑" },
];

/** 기간 서브탭 */
const PERIOD_TABS = [
  { id: "all", name: "역대" },
  { id: "monthly", name: "이번 달" },
];

/** 종 필터 (기네스북용) */
const SPECIES_OPTIONS = [
  "전체",
  "장수풍뎅이",
  "사슴벌레",
  "왕사슴벌레",
  "넓적사슴벌레",
  "코카서스장수풍뎅이",
  "헤라클레스장수풍뎅이",
];

/** 랭킹 메달 색상 */
const getMedalColor = (rank: number) => {
  if (rank === 1) return "bg-yellow-400 text-white";
  if (rank === 2) return "bg-gray-400 text-white";
  if (rank === 3) return "bg-amber-700 text-white";
  return "bg-gray-200 text-gray-600";
};

const RankingClient = () => {
  const [activeTab, setActiveTab] = useState("guinness");
  const [period, setPeriod] = useState("all");
  const [species, setSpecies] = useState("전체");

  const apiUrl = () => {
    let url = `/api/ranking?tab=${activeTab}&period=${period}`;
    if (activeTab === "guinness" && species !== "전체") {
      url += `&species=${species}`;
    }
    return url;
  };

  const { data, mutate } = useSWR<RankingResponse>(apiUrl());

  useEffect(() => {
    mutate();
  }, [activeTab, period, species]);

  return (
    <Layout canGoBack title="랭킹" seoTitle="랭킹">
      <div className="flex flex-col min-h-screen">
        {/* 메인 탭 */}
        <div className="sticky top-14 z-10 bg-white border-b border-gray-100">
          <div className="flex overflow-x-auto scrollbar-hide px-2">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex-shrink-0 flex items-center gap-1.5 px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors border-b-2",
                  activeTab === tab.id
                    ? "border-gray-900 text-gray-900"
                    : "border-transparent text-gray-400 hover:text-gray-600"
                )}
              >
                <span>{tab.icon}</span>
                {tab.name}
              </button>
            ))}
          </div>
        </div>

        {/* 서브탭 (기간 + 종 필터) */}
        <div className="px-4 py-3 space-y-3 bg-gray-50/50">
          {/* 기간 */}
          <div className="flex gap-2">
            {PERIOD_TABS.map((p) => (
              <button
                key={p.id}
                onClick={() => setPeriod(p.id)}
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs font-medium transition-colors",
                  period === p.id
                    ? "bg-gray-900 text-white"
                    : "bg-white text-gray-500 border border-gray-200"
                )}
              >
                {p.name}
              </button>
            ))}
          </div>

          {/* 종 필터 (기네스북) */}
          {activeTab === "guinness" && (
            <div className="flex gap-2 overflow-x-auto scrollbar-hide">
              {SPECIES_OPTIONS.map((sp) => (
                <button
                  key={sp}
                  onClick={() => setSpecies(sp)}
                  className={cn(
                    "flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors",
                    species === sp
                      ? "bg-primary text-white"
                      : "bg-white text-gray-500 border border-gray-200"
                  )}
                >
                  {sp}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 콘텐츠 영역 */}
        <div className="flex-1 px-4 py-4">
          {!data ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center gap-3 p-3 animate-pulse">
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
const GuinnessContent = ({ records }: { records: RankingResponse["records"] }) => {
  if (!records || records.length === 0) {
    return (
      <EmptyState
        title="아직 등록된 기록이 없습니다"
        description="첫 기록을 등록해 보세요!"
      />
    );
  }

  return (
    <div className="space-y-3">
      {records.map((record, i) => (
        <div
          key={record.id}
          className={cn(
            "flex items-center gap-3 p-3 rounded-xl transition-colors",
            i < 3 ? "bg-gradient-to-r from-yellow-50/80 to-transparent" : "bg-white"
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
          <div className="w-14 h-14 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
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
            <p className="text-sm font-semibold text-gray-900 truncate">
              {record.species}
            </p>
            <p className="text-xs text-gray-400">
              {record.recordType === "size" ? "크기" : "무게"}
            </p>
          </div>

          {/* 기록 + 유저 */}
          <div className="text-right flex-shrink-0">
            <p className="text-lg font-bold text-primary">
              {record.value}
              <span className="text-xs font-normal text-gray-400 ml-0.5">
                {record.recordType === "size" ? "mm" : "g"}
              </span>
            </p>
            <Link href={`/profiles/${record.user.id}`} className="text-xs text-gray-400 hover:text-gray-600">
              {record.user.name}
            </Link>
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
              className="relative overflow-hidden rounded-xl aspect-square"
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
            className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors"
          >
            <div
              className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0",
                getMedalColor(rank)
              )}
            >
              {rank}
            </div>
            <div className="w-12 h-12 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
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
              <p className="text-sm font-medium text-gray-900 truncate">{post.title}</p>
              <p className="text-xs text-gray-400">{post.user.name}</p>
            </div>
            <div className="flex items-center gap-1 text-sm text-red-400 font-medium flex-shrink-0">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
              </svg>
              {post._count.Likes}
            </div>
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
    <div className="space-y-3">
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
            className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors"
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
              <div className="w-10 h-10 rounded-full bg-gray-200 flex-shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900">{breeder.user.name}</p>
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <span>기록 {breeder.recordCount}</span>
                <span>·</span>
                <span>경매 {breeder.auctionCount}</span>
                <span>·</span>
                <span>❤️ {breeder.totalLikes}</span>
              </div>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-sm font-bold text-primary">{breeder.score.toLocaleString()}</p>
              <p className="text-[10px] text-gray-400">점</p>
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
        "flex flex-col items-center",
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
            className={cn("rounded-full object-cover border-2", isFirst ? "border-yellow-400" : "border-gray-300")}
            fill
            sizes="80px"
            alt=""
          />
        ) : (
          <div className={cn("w-full h-full rounded-full border-2", isFirst ? "bg-gray-200 border-yellow-400" : "bg-gray-200 border-gray-300")} />
        )}
      </div>
      <p className="text-xs font-semibold text-gray-900 text-center">{data.user.name}</p>
      <p className="text-xs font-bold text-primary">{data.score.toLocaleString()}점</p>
    </Link>
  );
};

/** 빈 상태 */
const EmptyState = ({ title, description }: { title: string; description: string }) => (
  <div className="flex flex-col items-center justify-center py-20 text-gray-400">
    <p className="text-lg font-medium">{title}</p>
    <p className="text-sm mt-1">{description}</p>
  </div>
);

export default RankingClient;
