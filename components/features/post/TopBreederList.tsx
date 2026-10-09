"use client";
/**
 * 반려생활 TOP 브리더(앱 components/features/post/TopBreederList.tsx, 시안 design/mockups/top-breeder C안):
 * 1~3위 행마다 순위·아바타·이름 + '○○ 부자' 키워드·활동 요약·점수, 그 아래 최근 사진 줄을 둔다.
 * 오른쪽 위 '점수 기준'은 점수식 시트를 연다. 나머지는 '전체 랭킹 보기'(/ranking)에서 본다.
 * `breeders` 가 undefined 면 스켈레톤.
 */
import { useMemo, useState } from "react";
import Link from "next/link";
import Image from "@components/atoms/Image";
import BreederScoreSheet from "@components/features/post/BreederScoreSheet";
import { cn, makeImageUrl } from "@libs/client/utils";
import { toPostPath } from "@libs/post-route";
import { pickBreederKeywords, summarizeBreederActivity } from "@libs/shared/breederKeywords";
import type { BloodlineRankingItem, BreederRankingItem } from "@libs/shared/ranking";

/** 반려생활 상단에 보여 줄 인원. */
export const TOP_BREEDER_COUNT = 3;
/** 랭킹 API `highlights` 값. 차단한 사람이 상위에서 빠져도 사진이 비지 않게 두 명 더 받는다. */
export const TOP_BREEDER_HIGHLIGHTS = TOP_BREEDER_COUNT + 2;
/** 웹 .app-card (앱 makeCardStyles.appCard). */
const APP_CARD = "rounded-xl border border-app-border bg-app-elevated shadow-card";

/** 앱 Icon "info"(heroicon) 과 같은 path. */
const InfoIcon = () => (
  <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
    <path
      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export default function TopBreederList({
  breeders,
  bloodlines,
  scoped = false,
  onOpen,
}: {
  breeders: BreederRankingItem[] | undefined;
  bloodlines: BloodlineRankingItem[];
  /** 관심 카테고리 범위 랭킹인지('점수 기준' 문구가 달라진다). */
  scoped?: boolean;
  onOpen?: (breeder: BreederRankingItem, index: number) => void;
}) {
  const [guideOpen, setGuideOpen] = useState(false);
  const top = useMemo(() => breeders?.slice(0, TOP_BREEDER_COUNT) ?? [], [breeders]);
  const keywords = useMemo(
    () => pickBreederKeywords(breeders ?? [], bloodlines, TOP_BREEDER_COUNT),
    [breeders, bloodlines],
  );

  return (
    <div className={cn(APP_CARD, "mx-4 overflow-hidden")}>
      <div className="flex items-center justify-between px-3.5 pt-3">
        <span className="text-[13px] text-app-muted">{scoped ? "관심 카테고리 활동 점수" : "누적 활동 점수"}</span>
        <button
          type="button"
          onClick={() => setGuideOpen(true)}
          className="-mr-1 flex items-center gap-[3px] px-1 text-[13px] font-medium text-app-sub"
        >
          점수 기준
          <InfoIcon />
        </button>
      </div>

      {!breeders ? (
        [0, 1, 2].map((i) => (
          <div key={i} className={cn("px-3.5 py-3.5", i > 0 && "border-t border-app-line")}>
            <div className="flex items-center gap-2.5">
              <span className="h-4 w-[18px] animate-pulse rounded bg-app-placeholder" />
              <span className="h-11 w-11 animate-pulse rounded-full bg-app-placeholder" />
              <div className="flex flex-1 flex-col gap-1.5">
                <span className="h-3.5 w-1/2 animate-pulse rounded bg-app-placeholder" />
                <span className="h-3 w-[35%] animate-pulse rounded bg-app-placeholder" />
              </div>
            </div>
            <div className="ml-7 mt-2.5 flex gap-1.5">
              {[0, 1, 2].map((j) => (
                <span key={j} className="h-16 w-16 animate-pulse rounded-lg bg-app-placeholder" />
              ))}
            </div>
          </div>
        ))
      ) : top.length === 0 ? (
        <p className="px-3.5 py-4 text-[13px] font-medium text-app-muted">표시할 브리더 랭킹이 없습니다.</p>
      ) : (
        top.map((breeder, index) => {
          const keyword = keywords[index];
          const summary = summarizeBreederActivity(breeder, keyword);
          const photos = breeder.highlight?.photos ?? [];
          return (
            <div key={breeder.user.id} className={cn("px-3.5 py-3.5", index > 0 && "border-t border-app-line")}>
              <Link
                href={`/profiles/${breeder.user.id}`}
                onClick={() => onOpen?.(breeder, index)}
                aria-label={`${index + 1}위 ${breeder.user.name}${keyword ? `, ${keyword.label}` : ""}${
                  summary ? `, ${summary}` : ""
                }, ${breeder.score.toLocaleString()}점`}
                className="flex items-center gap-2.5"
              >
                <span
                  className={cn(
                    "w-[18px] shrink-0 text-center text-[16px] font-bold",
                    index === 0 ? "text-app-brand" : "text-app-strong",
                  )}
                  aria-hidden="true"
                >
                  {index + 1}
                </span>
                {breeder.user.avatar ? (
                  <Image
                    src={makeImageUrl(breeder.user.avatar, "avatar")}
                    alt=""
                    width={44}
                    height={44}
                    className="h-11 w-11 shrink-0 rounded-full object-cover"
                  />
                ) : (
                  <span className="h-11 w-11 shrink-0 rounded-full bg-app-placeholder" aria-hidden="true" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 items-center gap-1.5">
                    <p className="truncate text-[15px] font-semibold leading-5 text-app-strong">{breeder.user.name}</p>
                    {keyword ? (
                      <span className="shrink-0 rounded-full bg-app-brand-soft px-2 py-[2px] text-[12px] font-semibold leading-4 text-app-brand">
                        {keyword.emoji} {keyword.label}
                      </span>
                    ) : null}
                  </div>
                  {summary ? (
                    <p className="mt-0.5 truncate text-[13px] leading-[18px] text-app-muted">{summary}</p>
                  ) : null}
                </div>
                <span className="shrink-0 text-[15px] font-bold text-app-strong">
                  {breeder.score.toLocaleString()}
                  <span className="ml-px text-[12px] font-medium text-app-muted">점</span>
                </span>
              </Link>
              {photos.length > 0 ? (
                <div className="ml-7 mt-2.5 flex gap-1.5">
                  {photos.map((photo) => (
                    <Link
                      key={photo.postId}
                      href={toPostPath(photo.postId)}
                      aria-label={`${breeder.user.name}의 게시글 사진`}
                      className="shrink-0 overflow-hidden rounded-lg bg-app-placeholder"
                    >
                      <Image
                        src={makeImageUrl(photo.image, "product")}
                        alt=""
                        width={64}
                        height={64}
                        className="h-16 w-16 object-cover"
                      />
                    </Link>
                  ))}
                </div>
              ) : null}
            </div>
          );
        })
      )}
      <Link
        href="/ranking"
        className="flex h-11 items-center justify-center gap-0.5 border-t border-app-line text-[13px] font-medium text-app-sub transition-colors hover:bg-app-surface"
      >
        전체 랭킹 보기
        <svg
          width={14}
          height={14}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          aria-hidden="true"
          className="text-app-muted"
        >
          <path d="M9 5l7 7-7 7" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </Link>
      <BreederScoreSheet open={guideOpen} scoped={scoped} onClose={() => setGuideOpen(false)} />
    </div>
  );
}
