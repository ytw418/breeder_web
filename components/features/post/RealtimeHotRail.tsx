"use client";

import { HorizontalRail } from "@components/ui/HorizontalRail";
import Link from "next/link";
import Image from "@components/atoms/Image";
import { getTimeAgoString, makeImageUrl } from "@libs/client/utils";
import { toPostPath } from "@libs/post-route";
import type { HotActivityKind } from "@libs/shared/communityVibe";

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
};

const ACTIVITY_LABEL: Record<HotActivityKind, string> = {
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

/** 카드 메타: '방금 댓글 · 젠크레 · 댓글 4'(최근 활동 시각이 먼저, community-vibe §3.5). */
export function realtimeHotMeta(item: RealtimeHotItem, now?: number) {
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
 * 반려생활 '실시간 TOP 토론' 가로 레일(시안 community-vibe .hot/.hc).
 * 카드 240, app-gap 채움 r12 p12, 순위 숫자 주황 16/700, 제목 2줄 14/600, 메타 12, 썸네일 48 r8.
 */
export default function RealtimeHotRail({
  items,
  onOpen,
}: {
  items: RealtimeHotItem[];
  onOpen?: (item: RealtimeHotItem, index: number) => void;
}) {
  return (
    <HorizontalRail label="실시간 TOP 토론" className="gap-2 px-4" data-testid="realtime-hot-rail">
      {items.map((item, index) => {
        const meta = realtimeHotMeta(item);
        return (
          <Link
            key={item.id}
            href={toPostPath(item.id, item.title)}
            onClick={() => onOpen?.(item, index)}
            className="flex w-[240px] shrink-0 gap-2.5 rounded-xl bg-app-gap p-3 transition-transform active:scale-[0.98]"
          >
            <span className="w-5 shrink-0 text-[16px] font-bold leading-[22px] text-app-brand tabular-nums">
              {index + 1}
            </span>
            <span className="min-w-0 flex-1">
              <span className="line-clamp-2 break-keep text-[14px] font-semibold leading-5 text-app-text">
                {item.title}
              </span>
              <span className="mt-1 block truncate text-[12px] leading-4 text-app-muted">
                {meta.time ? <b className="font-semibold text-app-brand">{meta.time}</b> : null}
                {meta.time ? " " : null}
                {meta.rest}
              </span>
            </span>
            {item.image ? (
              <span className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-app-placeholder">
                <Image
                  src={makeImageUrl(item.image, "public")}
                  alt=""
                  width={48}
                  height={48}
                  className="h-full w-full object-cover"
                />
              </span>
            ) : null}
          </Link>
        );
      })}
    </HorizontalRail>
  );
}

export function RealtimeHotRailSkeleton() {
  return (
    <div className="flex gap-2 overflow-hidden px-4">
      {[0, 1].map((i) => (
        <div key={i} className="h-[84px] w-[240px] shrink-0 animate-pulse rounded-xl bg-app-gap" />
      ))}
    </div>
  );
}
