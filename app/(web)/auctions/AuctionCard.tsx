"use client";

import { useEffect } from "react";
import Image from "@components/atoms/Image";
import { AuthorLink, CardOverlayLink } from "@components/app/AuthorLink";
import {
  BreederProgramBadge,
  hasBreederProgramFrame,
} from "@components/features/breeder/BreederProgramDecorators";
import { cn, makeImageUrl } from "@libs/client/utils";
import { toAuctionPath } from "@libs/auction-route";
import { formatAuctionTimeLeft, isAuctionTimeOver } from "@libs/auctionRules";
import type { AuctionWithUser } from "pages/api/auctions";
import { useIsUnread } from "@libs/client/unreadMarks";

/** 남은 시간이 이보다 짧으면 '마감 임박'(빨간 글자). */
const AUCTION_URGENT_MS = 60 * 60 * 1000;

/** 가격 라벨: 낙찰된 종료 경매는 낙찰가, 입찰 없이 끝난 유찰은 시작가, 그 밖은 현재가. */
function auctionPriceLabel(auction: Pick<AuctionWithUser, "status" | "winnerId">) {
  if (auction.status === "종료" && auction.winnerId) return "낙찰가";
  if (auction.status === "유찰") return "시작가";
  return "현재가";
}

/** 이미지 위 상태 뱃지(앱 AuctionCard): 진행중 초록 / 종료 중립 / 그 외(유찰 등) 노랑. 다크는 불투명 면 + 1px 테두리. */
const STATUS_BADGE_CLASS: Record<string, string> = {
  진행중:
    "border-emerald-200 bg-app-success-soft text-app-success-text dark:border-app-border dark:bg-app-elevated",
  종료: "border-app-border bg-app-surface text-app-sub dark:bg-app-elevated",
};
const OTHER_BADGE_CLASS =
  "border-amber-200 bg-app-warning-soft text-app-warning-text dark:border-app-border dark:bg-app-elevated";

/**
 * 경매 2열 그리드 카드(앱 AuctionCard 와 같은 구성). 부모 그리드 셀이 폭을 정한다.
 * 판매자는 카드 맨 아래 카드 폭 한 줄(아바타 20 + 닉네임 12/600, 누르면 프로필), 브리더 뱃지는 그 아래 왼쪽
 * (시안 bredy_app design/mockups/author-row/A-karrot.html A-③). 상세 링크는 카드를 투명하게 덮는다.
 */
export function AuctionCard({
  auction,
  nowMs,
  onTimeOver,
}: {
  auction: AuctionWithUser;
  nowMs: number;
  /** 진행중인데 마감 시각이 지났을 때 한 번 호출(목록 refetch 로 서버 정산 결과를 받는다). */
  onTimeOver?: (auctionId: number) => void;
}) {
  const live = auction.status === "진행중";
  const timeOver = live && isAuctionTimeOver(auction.endAt, nowMs);
  const programs = auction.user?.breederPrograms;
  const framed = hasBreederProgramFrame(programs);
  const bids = auction._count?.bids ?? 0;
  const urgent =
    live && !timeOver && new Date(auction.endAt).getTime() - nowMs <= AUCTION_URGENT_MS;
  const unread = useIsUnread("auction", {
    id: auction.id,
    createdAt: auction.createdAt,
    authorId: auction.userId,
  });

  useEffect(() => {
    if (timeOver) onTimeOver?.(auction.id);
  }, [timeOver, onTimeOver, auction.id]);

  return (
    <article className="relative min-w-0 overflow-hidden rounded-lg border border-app-border bg-app-elevated">
      <CardOverlayLink href={toAuctionPath(auction.id, auction.title)} label={auction.title} />
      {/* 이미지 */}
      <div className="relative aspect-[4/3] w-full bg-app-surface">
        {auction.photos?.[0] ? (
          <Image
            src={makeImageUrl(auction.photos[0], "public")}
            className="h-full w-full object-cover"
            alt={auction.title}
            fill
            sizes="(max-width: 640px) 50vw, 280px"
          />
        ) : null}
        <span
          className={cn(
            "absolute left-2 top-2 inline-flex h-5 items-center whitespace-nowrap rounded-md border px-2 text-[10px] font-semibold leading-none",
            STATUS_BADGE_CLASS[auction.status] ?? OTHER_BADGE_CLASS
          )}
        >
          {auction.status}
        </span>
      </div>

      {/* 정보 */}
      <div className="p-3">
        <div className="mb-1 flex min-w-0 items-center gap-1.5">
          {auction.category ? (
            <span className="inline-flex h-5 shrink-0 items-center rounded-md bg-app-surface px-1.5 text-[10px] font-semibold text-app-sub">
              {auction.category}
            </span>
          ) : null}
          {live ? (
            <span
              className={cn(
                "truncate text-[10px] font-semibold",
                timeOver ? "text-app-muted" : urgent ? "text-app-danger" : "text-app-success-text"
              )}
            >
              {timeOver
                ? "마감"
                : urgent
                  ? `마감 임박 · ${formatAuctionTimeLeft(auction.endAt, nowMs)}`
                  : formatAuctionTimeLeft(auction.endAt, nowMs)}
            </span>
          ) : null}
        </div>
        <div className="flex min-w-0 items-center gap-1.5">
          {unread ? (
            <span aria-label="안 본 경매" className="h-1.5 w-1.5 shrink-0 rounded-full bg-app-danger" />
          ) : null}
          <h3 className="truncate text-sm font-semibold text-app-strong">{auction.title}</h3>
        </div>
        <div className="mt-2 flex items-end justify-between gap-2">
          {/* 가격 우선: 가격 열은 줄이지 않고 오른쪽 열이 줄어든다. */}
          <div className="shrink-0">
            <p className="text-[10px] text-app-muted">{auctionPriceLabel(auction)}</p>
            <p className="whitespace-nowrap text-sm font-bold text-app-strong">
              {auction.currentPrice.toLocaleString()}원
            </p>
          </div>
          <p className="min-w-0 truncate text-[10px] text-app-muted">
            {live && bids === 0 ? "첫 입찰을 기다려요" : `입찰 ${bids}회`}
          </p>
        </div>
        {auction.user ? (
          <div className="mt-2.5 flex">
            <AuthorLink
              user={auction.user}
              avatarSize={20}
              className="gap-1.5"
              nameClassName="text-[12px] font-semibold text-app-sub"
            />
          </div>
        ) : null}
        {/* 브리더 뱃지('창립 브리더 No.001')는 판매자 줄에 안 들어가 그 아래 한 줄에 둔다. */}
        {framed ? (
          <div className="mt-1.5 flex">
            <BreederProgramBadge programs={programs} />
          </div>
        ) : null}
      </div>
    </article>
  );
}

export function AuctionSkeletonGrid({ className }: { className?: string }) {
  return (
    <div className={cn("grid grid-cols-2 gap-3 py-4", className)} aria-label="불러오는 중" role="status">
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className="animate-pulse overflow-hidden rounded-lg border border-app-border bg-app-elevated"
        >
          <div className="aspect-[4/3] bg-app-placeholder" />
          <div className="p-2.5">
            <div className="h-3 w-3/4 rounded bg-app-placeholder" />
            <div className="mt-2 h-4 w-1/2 rounded bg-app-placeholder" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default AuctionCard;
