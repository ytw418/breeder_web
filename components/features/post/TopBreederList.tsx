"use client";
/**
 * 반려생활 TOP 브리더(앱 components/features/post/TopBreederList.tsx): 1~3위를 세로 목록으로 보여 주고
 * '○○ 부자' 키워드를 붙인다. 나머지는 '전체 랭킹 보기'(/ranking)에서 본다. `breeders` 가 undefined 면 스켈레톤.
 */
import { useMemo } from "react";
import Link from "next/link";
import Image from "@components/atoms/Image";
import { cn, makeImageUrl } from "@libs/client/utils";
import { pickBreederKeywords } from "@libs/shared/breederKeywords";
import type { BloodlineRankingItem, BreederRankingItem } from "@libs/shared/ranking";

/** 반려생활 상단에 보여 줄 인원. */
export const TOP_BREEDER_COUNT = 3;
const MEDALS = ["🥇", "🥈", "🥉"];
/** 웹 .app-card (앱 makeCardStyles.appCard). */
const APP_CARD = "rounded-xl border border-app-border bg-app-elevated shadow-card";

export default function TopBreederList({
  breeders,
  bloodlines,
  onOpen,
}: {
  breeders: BreederRankingItem[] | undefined;
  bloodlines: BloodlineRankingItem[];
  onOpen?: (breeder: BreederRankingItem, index: number) => void;
}) {
  const top = useMemo(() => breeders?.slice(0, TOP_BREEDER_COUNT) ?? [], [breeders]);
  const keywords = useMemo(
    () => pickBreederKeywords(breeders ?? [], bloodlines, TOP_BREEDER_COUNT),
    [breeders, bloodlines]
  );

  return (
    <div className={cn(APP_CARD, "mx-4 overflow-hidden")}>
      {!breeders ? (
        [0, 1, 2].map((i) => (
          <div key={i} className={cn("flex items-center gap-3 px-3.5 py-3", i > 0 && "border-t border-app-line")}>
            <span className="h-6 w-6 animate-pulse rounded-full bg-app-placeholder" />
            <span className="h-10 w-10 animate-pulse rounded-full bg-app-placeholder" />
            <div className="flex flex-1 flex-col gap-1.5">
              <span className="h-3.5 w-1/2 animate-pulse rounded bg-app-placeholder" />
              <span className="h-3 w-[35%] animate-pulse rounded bg-app-placeholder" />
            </div>
          </div>
        ))
      ) : top.length === 0 ? (
        <p className="px-3.5 py-4 text-[13px] font-medium text-app-muted">표시할 브리더 랭킹이 없습니다.</p>
      ) : (
        top.map((breeder, index) => {
          const keyword = keywords[index];
          return (
            <Link
              key={breeder.user.id}
              href={`/profiles/${breeder.user.id}`}
              onClick={() => onOpen?.(breeder, index)}
              aria-label={`${index + 1}위 ${breeder.user.name}${keyword ? `, ${keyword.label}` : ""}, ${breeder.score.toLocaleString()}점`}
              className={cn(
                "flex items-center gap-3 px-3.5 py-3 transition-colors hover:bg-app-surface",
                index > 0 && "border-t border-app-line"
              )}
            >
              <span className="w-6 shrink-0 text-center text-[20px]" aria-hidden="true">
                {MEDALS[index]}
              </span>
              {breeder.user.avatar ? (
                <Image
                  src={makeImageUrl(breeder.user.avatar, "avatar")}
                  alt=""
                  width={40}
                  height={40}
                  className="h-10 w-10 shrink-0 rounded-full object-cover"
                />
              ) : (
                <span className="h-10 w-10 shrink-0 rounded-full bg-app-placeholder" aria-hidden="true" />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-semibold leading-5 text-app-strong">{breeder.user.name}</p>
                {keyword ? (
                  <div className="mt-1 flex min-w-0 items-center gap-1.5">
                    <span className="shrink-0 rounded-full bg-app-brand-soft px-2 py-[3px] text-[12px] font-semibold leading-4 text-app-brand">
                      {keyword.emoji} {keyword.label}
                    </span>
                    <span className="truncate text-[12px] text-app-muted">{keyword.detail}</span>
                  </div>
                ) : null}
              </div>
              <span className="shrink-0 text-[14px] font-bold text-app-strong">
                {breeder.score.toLocaleString()}
                <span className="text-[12px] font-medium text-app-muted">점</span>
              </span>
            </Link>
          );
        })
      )}
      <Link
        href="/ranking"
        className="flex h-11 items-center justify-center gap-0.5 border-t border-app-line text-[13px] font-medium text-app-sub transition-colors hover:bg-app-surface"
      >
        전체 랭킹 보기
        <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true" className="text-app-muted">
          <path d="M9 5l7 7-7 7" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </Link>
    </div>
  );
}
