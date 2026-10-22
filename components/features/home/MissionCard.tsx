"use client";

import Link from "next/link";
import useSWR from "swr";
import useScopeTerms from "@/hooks/useScopeTerms";
import { cn } from "@libs/client/utils";
import type { HomeMissionsResponse } from "pages/api/home/missions";

/** 입찰 미션. 포유류만 고정해 경매를 숨긴 사람에겐 빼고 보인다(앱 docs/prd/category-pin.md §15). */
const AUCTION_MISSION_KEY = "auction_bid";

/**
 * 미션 바로가기(2026-10-22 사용자 "미션에 클릭 버튼 — 경매 탭으로 보내는 버튼 같은 거"). 아직 못 끝낸 미션 오른쪽에
 * 채움 작은 버튼(32 r8 brand-soft, 13/600 brand-text)을 두고, 끝낸 미션은 버튼 없이 'n/목표'만. 앱 MissionCard 와 같다.
 */
const MISSION_ACTIONS: Record<string, { label: string; href: string }> = {
  post_create: { label: "글쓰기", href: "/posts/upload" },
  comment_write: { label: "답 달기", href: "/posts/unanswered" },
  auction_bid: { label: "경매 보기", href: "/auctions" },
};

/**
 * 홈 '이번 주 미션'(앱 src/components/features/home/MissionCard.tsx, 시안 앱 design/mockups/home-ia/A-karrot.html #mission).
 * 로그인했을 때만 부르고, 이번 주 진행이 1 이상인 미션이 하나라도 있을 때만 보인다 — 0/3 같은 빈 진행도는 그리지 않는다
 * ('작은 숫자는 빈 티' 결정과 같은 이유, 2026-10-21 감사 #29). 카드: elevated r12 1px line, 제목 15/600,
 * 행마다 이름 13 · 보상 12 muted · 오른쪽 'n/목표' 12 muted, 아래 진행 막대 4(brand / surface), 못 끝낸 미션은 그 오른쪽 바로가기 버튼.
 */
export default function MissionCard({ enabled }: { enabled: boolean }) {
  const { showAuctions } = useScopeTerms();
  const { data } = useSWR<HomeMissionsResponse>(enabled ? "/api/home/missions" : null);
  const missions = (data?.missions ?? []).filter((mission) => showAuctions || mission.key !== AUCTION_MISSION_KEY);
  if (!missions.some((mission) => mission.progress > 0)) return null;

  return (
    <section className="px-4 pt-3" data-home-section="weekly_missions">
      <div className="rounded-xl border border-app-line bg-app-elevated px-4 py-3.5">
        <h2 className="text-[15px] font-semibold leading-5 text-app-text">이번 주 미션</h2>
        <ul className="mt-1">
          {missions.map((mission) => {
            const done = Math.min(mission.progress, mission.targetCount);
            const ratio = mission.targetCount > 0 ? done / mission.targetCount : 0;
            const action = mission.isCompleted ? null : MISSION_ACTIONS[mission.key];
            return (
              <li key={mission.key} className="flex items-center gap-3 pt-2.5">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="shrink-0 text-[13px] leading-[18px] text-app-text">{mission.title}</span>
                    {mission.rewardLabel ? (
                      <span className="min-w-0 truncate text-[12px] leading-4 text-app-muted">{mission.rewardLabel}</span>
                    ) : null}
                    <span
                      className={cn(
                        "ml-auto shrink-0 text-[12px] leading-4 tabular-nums",
                        mission.isCompleted ? "font-semibold text-app-brand-text" : "text-app-muted"
                      )}
                    >
                      {done}/{mission.targetCount}
                    </span>
                  </div>
                  <div
                    role="progressbar"
                    aria-label={`${mission.title} ${done}/${mission.targetCount}`}
                    aria-valuemin={0}
                    aria-valuemax={mission.targetCount}
                    aria-valuenow={done}
                    className="mt-1.5 h-1 overflow-hidden rounded-full bg-app-surface"
                  >
                    <i className="block h-full rounded-full bg-app-brand" style={{ width: `${Math.round(ratio * 100)}%` }} />
                  </div>
                </div>
                {action ? (
                  <Link
                    href={action.href}
                    aria-label={`${mission.title}, ${action.label}`}
                    className="flex h-8 shrink-0 items-center rounded-lg bg-app-brand-soft px-3 text-[13px] font-semibold text-app-brand-text active:opacity-80"
                  >
                    {action.label}
                  </Link>
                ) : null}
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
