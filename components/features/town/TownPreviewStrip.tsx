"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import useSWR from "swr";

import { cn, getTimeAgoString } from "@libs/client/utils";
import type { TownPreviewResult } from "@libs/shared/liveTalk";
import { townEmptyTitle, townMessagePreview } from "@libs/shared/townTalk";

export const TOWN_HREF = "/town";
const PREVIEW_KEY = "/api/town/preview";
const ROTATE_MS = 4000;
const REFRESH_MS = 30_000;

/**
 * 홈 동네 섹션의 '동네 사랑방' 줄(앱 docs/prd/live-talk.md §3.4c, 시안 ③ .lv — 앱 TownPreviewStrip 과 같다).
 * gap 배경 r12 패딩 12·14: 실시간 점 · "동네 사랑방" 15/700 · 오른쪽 "들어가기 ›" / 최근 메시지 3개를 4초마다 넘김 + 점.
 * 7일 0개면 "{라벨} 근처 사랑방이 열렸어요 · 첫 인사를 남겨 보세요". 동네 미설정·비로그인·오류면 줄이 없다. 30초마다 갱신.
 */
export default function TownPreviewStrip({ className }: { className?: string }) {
  const { data, error } = useSWR<TownPreviewResult>(PREVIEW_KEY, {
    refreshInterval: REFRESH_MS,
    revalidateOnFocus: false,
    shouldRetryOnError: false,
  });
  const messages = data?.messages ?? [];
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (messages.length < 2) return;
    const timer = window.setInterval(() => setIndex((i) => (i + 1) % messages.length), ROTATE_MS);
    return () => window.clearInterval(timer);
  }, [messages.length]);

  if (error || !data?.success || !data.scope) return null;
  const current = messages.length ? messages[index % messages.length] : null;

  return (
    <Link
      href={TOWN_HREF}
      className={cn("mx-4 block rounded-xl bg-app-gap px-3.5 py-3", className)}
      data-testid="town-preview-strip"
    >
      <span className="flex items-center gap-2">
        <span
          className={cn(
            "h-2 w-2 shrink-0 rounded-full",
            current ? "bg-app-brand shadow-[0_0_0_3px_var(--app-brand-track)]" : "bg-app-caption"
          )}
          aria-hidden="true"
        />
        <span className="text-[15px] font-bold leading-5 text-app-text">동네 사랑방</span>
        <span className="ml-auto flex items-center gap-0.5 text-[13px] font-semibold text-app-text">
          들어가기
          <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden="true">
            <path d="m9 6 6 6-6 6" />
          </svg>
        </span>
      </span>
      {current ? (
        <>
          <span className="mt-2 flex h-[22px] items-center gap-1.5 overflow-hidden whitespace-nowrap text-[14px] leading-5">
            <b className="shrink-0 font-semibold text-app-text">{current.user.name}</b>
            <span className="truncate text-app-sub">
              {townMessagePreview({
                type: current.type,
                body: current.body,
                productName: current.product?.name ?? null,
                deleted: current.deleted,
              })}
            </span>
            <span className="ml-auto shrink-0 pl-2 text-[12px] text-app-muted">
              {getTimeAgoString(new Date(current.createdAt))}
            </span>
          </span>
          {messages.length > 1 ? (
            <span className="mt-2 flex gap-1" aria-hidden="true">
              {messages.map((message, i) => (
                <i
                  key={message.id}
                  className={cn(
                    "block h-1 rounded-full",
                    i === index % messages.length ? "w-3 bg-app-text" : "w-1 bg-app-caption"
                  )}
                />
              ))}
            </span>
          ) : null}
        </>
      ) : (
        <span className="mt-2 block truncate text-[14px] leading-5 text-app-sub">
          {townEmptyTitle(data.scope.label)} · 첫 인사를 남겨 보세요
        </span>
      )}
    </Link>
  );
}
