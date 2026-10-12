import client from "@libs/server/client";
import { getViewerRegionScope } from "@libs/server/nearby";
import { regionScopeOr } from "@libs/shared/regionScope";

/**
 * 동네 홈 방문 기록·집계(앱 docs/prd/community-vibe.md §3.1·§4, 계약 NeighborhoodVisitors).
 * - 기록: 홈 진입 때 하루(KST) 1행 upsert. 그때 사용자의 시/도·시/군/구 이름만 남긴다.
 * - 집계: 최근 7일(오늘 포함, KST) 내 범위(50km) 안에서 홈을 본 서로 다른 사용자 수. 나는 뺀다.
 */

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
export const REGION_VISITOR_DAYS = 7;

/** KST 날짜를 UTC 자정 Date 로(@db.Date 컬럼 값). */
export function kstDate(now: Date, daysAgo = 0): Date {
  const kst = new Date(now.getTime() + KST_OFFSET_MS - daysAgo * DAY_MS);
  return new Date(Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate()));
}

export async function recordRegionVisit(userId: number, now: Date = new Date()): Promise<boolean> {
  const user = await client.user.findUnique({
    where: { id: userId },
    select: { regionSido: true, regionSigungu: true },
  });
  if (!user?.regionSido || !user.regionSigungu) return false;
  const day = kstDate(now);
  const region = { regionSido: user.regionSido, regionSigungu: user.regionSigungu };
  await client.regionVisit.upsert({
    where: { userId_day: { userId, day } },
    update: region,
    create: { userId, day, ...region },
  });
  return true;
}

export async function countRegionVisitors(viewerId: number, now: Date = new Date()): Promise<number> {
  const scope = await getViewerRegionScope(viewerId);
  if (!scope) return 0;
  const rows = await client.regionVisit.findMany({
    where: {
      day: { gte: kstDate(now, REGION_VISITOR_DAYS - 1) },
      userId: { not: viewerId },
      OR: regionScopeOr(scope.regions),
    },
    distinct: ["userId"],
    select: { userId: true },
  });
  return rows.length;
}
