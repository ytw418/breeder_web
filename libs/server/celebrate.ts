import type { Prisma } from "@prisma/client";
import client from "@libs/server/client";
import { getKstWeekWindow } from "@libs/server/season";
import { celebrateFact, type CelebrateTarget } from "@libs/shared/communityCopy";
import type { Celebrate } from "@libs/shared/communityVibe";
import { nearbyRegions, regionScopeLabel, regionScopeOr } from "@libs/shared/regionScope";

/**
 * 글·분양글·경매 등록 직후 보상 시트 데이터(앱 docs/prd/community-vibe.md §3.4, AC-5).
 * - ordinal: 그 종류 전체에서 몇 번째인지(이 글 포함, id 순). 게시글은 공지를 뺀다.
 * - fact: 범위(시 단위 + 50km) 첫 글 > 오늘(KST) 첫 글 > 이번 주(KST) 같은 종 첫 글 > 관심 분야 고정 N명 (libs/shared/communityCopy).
 * 등록 응답을 막지 않도록 실패하면 null 을 돌려준다(구 앱은 이 필드를 무시한다).
 */

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** KST 기준 그 날 00:00 의 UTC 시각. */
export function kstDayStart(date: Date): Date {
  const kst = date.getTime() + KST_OFFSET_MS;
  return new Date(Math.floor(kst / DAY_MS) * DAY_MS - KST_OFFSET_MS);
}

type Where = Record<string, unknown>;

const countOf = (target: CelebrateTarget, where: Where): Promise<number> => {
  if (target === "post") return client.post.count({ where: where as Prisma.PostWhereInput });
  if (target === "product") return client.product.count({ where: where as Prisma.ProductWhereInput });
  return client.auction.count({ where: where as Prisma.AuctionWhereInput });
};

/** 종 필드 이름(게시글 type, 분양글·경매 category). */
const SPECIES_FIELD: Record<CelebrateTarget, string> = { post: "type", product: "category", auction: "category" };

/** 게시글은 공지를 세지 않는다(카테고리 없는 글은 센다). */
const baseWhere = (target: CelebrateTarget): Where =>
  target === "post" ? { OR: [{ category: null }, { category: { not: "공지" } }] } : {};

export async function buildCelebrate({
  target,
  id,
  userId,
  createdAt,
  species,
  categoryId,
}: {
  target: CelebrateTarget;
  id: number;
  userId: number;
  createdAt: Date;
  species: string | null;
  categoryId: number | null;
}): Promise<Celebrate | null> {
  try {
    const base = baseWhere(target);
    const before = { ...base, id: { lt: id } };
    const author = await client.user.findUnique({
      where: { id: userId },
      select: { regionSido: true, regionSigungu: true },
    });
    const regions =
      author?.regionSido && author.regionSigungu ? nearbyRegions(author.regionSido, author.regionSigungu) : null;
    const regionLabel = author?.regionSido ? regionScopeLabel(author.regionSido, author.regionSigungu) : null;
    const weekStart = getKstWeekWindow(createdAt).startAt;

    const [ordinal, regionBefore, todayBefore, weekSpeciesBefore, pinnedCount] = await Promise.all([
      countOf(target, { ...base, id: { lte: id } }),
      regions ? countOf(target, { ...before, user: { OR: regionScopeOr(regions) } }) : Promise.resolve(1),
      countOf(target, { ...before, createdAt: { gte: kstDayStart(createdAt) } }),
      species
        ? countOf(target, { ...before, [SPECIES_FIELD[target]]: species, createdAt: { gte: weekStart } })
        : Promise.resolve(1),
      categoryId
        ? client.user.count({ where: { pinnedCategoryIds: { has: categoryId }, id: { not: userId }, status: "ACTIVE" } })
        : Promise.resolve(0),
    ]);

    return {
      ordinal,
      fact: celebrateFact({
        target,
        regionLabel,
        regionFirst: Boolean(regions) && regionBefore === 0,
        todayFirst: todayBefore === 0,
        species,
        weekSpeciesFirst: Boolean(species) && weekSpeciesBefore === 0,
        pinnedCount,
      }),
    };
  } catch (error) {
    console.error("[celebrate]", error);
    return null;
  }
}
