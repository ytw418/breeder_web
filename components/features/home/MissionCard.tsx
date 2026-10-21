"use client";

import useSWR from "swr";
import useScopeTerms from "@/hooks/useScopeTerms";
import { cn } from "@libs/client/utils";
import type { HomeMissionsResponse } from "pages/api/home/missions";

/** 입찰 미션. 포유류만 고정해 경매를 숨긴 사람에겐 빼고 보인다(앱 docs/prd/category-pin.md §15). */
const AUCTION_MISSION_KEY = "auction_bid";

/**
 * 홈 '이번 주 미션'(앱 src/components/features/home/MissionCard.tsx, 시안 앱 design/mockups/home-ia/A-karrot.html #mission).
 * 로그인했을 때만 부르고, 이번 주 진행이 1 이상인 미션이 하나라도 있을 때만 보인다 — 0/3 같은 빈 진행도는 그리지 않는다
 * ('작은 숫자는 빈 티' 결정과 같은 이유, 2026-10-21 감사 #29). 카드: elevated r12 1px line, 제목 15/600,
 * 행마다 이름 13 · 보상 12 muted · 오른쪽 'n/목표' 12 muted, 아래 진행 막대 4(brand / surface).
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
            return (
              <li key={mission.key} className="pt-2.5">
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
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
