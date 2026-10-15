"use client";

import type React from "react";
import { HorizontalRail } from "@components/ui/HorizontalRail";
import Link from "next/link";
import Image from "@components/atoms/Image";
import { getTimeAgoString, makeImageUrl } from "@libs/client/utils";
import { toPostPath } from "@libs/post-route";
import type { HotActivityKind } from "@libs/shared/communityVibe";
import { activityLabel, participantsLabel, remainingLabel, type DebateSummary } from "@libs/shared/debateFormat";
import { DebatePill } from "@components/features/debate/DebateParts";

/** 실시간 TOP 토론 카드 한 장에 필요한 값(서버 hot=realtime 또는 구 home/feed 를 맞춘 모양). */
export type RealtimeHotItem = {
  id: number;
  title: string;
  image?: string | null;
  authorName: string;
  comments: number;
  /** 최근 댓글·좋아요 시각. 없으면 글 작성 시각. */
  lastActivityAt: string;
  lastActivityKind: HotActivityKind;
  /** 찬반 토론 글이면 요약. 카드가 '토론' 칩 + "방금 댓글 · 23명 참여 · 18시간 남음" 메타로 바뀐다. */
  debate?: DebateSummary | null;
};

const ACTIVITY_LABEL: Record<HotActivityKind, string> = {
  vote: "투표",
  comment: "댓글",
  like: "좋아요",
  post: "새 글",
};

/** '방금' · '12분 전' · '3시간 전'. 1분 안이면 '방금'. */
export function activityTimeLabel(at: string, now: number = Date.now()): string {
  const date = new Date(at);
  if (Number.isNaN(date.getTime())) return "";
  if (now - date.getTime() < 60_000) return "방금";
  return getTimeAgoString(date);
}

/** 카드 메타: '방금 댓글 · 젠크레 · 댓글 4'(최근 활동 시각이 먼저, community-vibe §3.5). 토론은 '방금 댓글 · 23명 참여 · 18시간 남음'. */
export function realtimeHotMeta(item: RealtimeHotItem, now?: number) {
  if (item.debate && item.debate.state === "open") {
    const time = activityLabel(item.debate.lastActivityAt, now);
    return {
      time,
      rest: [time ? "댓글" : null, participantsLabel(item.debate.participants), remainingLabel(item.debate.endsAt, now)]
        .filter(Boolean)
        .join(" · "),
    };
  }
  const time = activityTimeLabel(item.lastActivityAt, now);
  return {
    time,
    rest: [
      ACTIVITY_LABEL[item.lastActivityKind],
      item.authorName,
      item.comments > 0 ? `댓글 ${item.comments}` : null,
    ]
      .filter(Boolean)
      .join(" · "),
  };
}

/**
 * 반려생활 '실시간 TOP 토론' 가로 레일(2026-10-12 사용자 "섹션이 너무 작다, 이미지를 크게, 내용은 밑에" — 앱과 같다).
 * 카드 200, 위에 사진 200×150(r12, 순위 뱃지 겹침), 아래 제목 2줄 15/600 + 메타 한 줄 12.
 * 사진이 없는 글은 같은 자리에 brand-soft 채움 + 제목 17/700 4줄(글 카드), 아래엔 메타만.
 */
export default function RealtimeHotRail({
  items,
  onOpen,
  rankOffset = 0,
  endCard,
}: {
  items: RealtimeHotItem[];
  onOpen?: (item: RealtimeHotItem, index: number) => void;
  /** 위에 맨 위 토론 카드가 1위로 따로 있으면 1, 레일 순위가 2부터 시작한다. */
  rankOffset?: number;
  /** 레일 맨 끝 카드(홈 '토론 열기'). */
  endCard?: React.ReactNode;
}) {
  return (
    <HorizontalRail label="실시간 TOP 토론" className="items-start gap-2.5 px-4" data-testid="realtime-hot-rail">
      {items.map((item, index) => {
        const meta = realtimeHotMeta(item);
        return (
          <Link
            key={item.id}
            href={toPostPath(item.id, item.title)}
            onClick={() => onOpen?.(item, index)}
            className="block w-[200px] shrink-0 transition-transform active:scale-[0.98]"
          >
            <span
              className={`relative block h-[150px] w-[200px] overflow-hidden rounded-xl ${
                item.image ? "bg-app-surface" : "bg-app-brand-soft"
              }`}
            >
              {item.image ? (
                <Image
                  src={makeImageUrl(item.image, "public")}
                  alt=""
                  width={200}
                  height={150}
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="block px-3.5 pt-11">
                  {item.debate ? <DebatePill className="mb-1.5" /> : null}
                  <span
                    className={`${item.debate ? "line-clamp-3" : "line-clamp-4"} break-keep text-[17px] font-bold leading-6 text-app-text`}
                  >
                    {item.title}
                  </span>
                </span>
              )}
              <span className="absolute left-2 top-2 flex h-[26px] min-w-[26px] items-center justify-center rounded-full bg-app-brand px-1.5 text-[14px] font-bold leading-[18px] text-white tabular-nums">
                {index + 1 + rankOffset}
              </span>
            </span>
            {item.image ? (
              <span className="mt-2 line-clamp-2 break-keep text-[15px] font-semibold leading-[21px] text-app-text">
                {item.title}
              </span>
            ) : null}
            <span className={`${item.image ? "mt-1" : "mt-2"} block truncate text-[12px] leading-4 text-app-muted`}>
              {meta.time ? <b className="font-semibold text-app-brand">{meta.time}</b> : null}
              {meta.time ? " " : null}
              {meta.rest}
            </span>
          </Link>
        );
      })}
      {endCard}
    </HorizontalRail>
  );
}

export function RealtimeHotRailSkeleton() {
  return (
    <div className="flex gap-2.5 overflow-hidden px-4">
      {[0, 1].map((i) => (
        <div key={i} className="w-[200px] shrink-0">
          <div className="h-[150px] w-[200px] animate-pulse rounded-xl bg-app-placeholder" />
          <div className="mt-2 h-[15px] w-[90%] animate-pulse rounded bg-app-placeholder" />
          <div className="mt-1.5 h-3 w-[60%] animate-pulse rounded bg-app-placeholder" />
        </div>
      ))}
    </div>
  );
}
