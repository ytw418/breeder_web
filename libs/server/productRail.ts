import client from "@libs/server/client";
import { excludedAuthorIds } from "@libs/server/blocks";
import {
  breederProgramSummarySelect,
  getSortedActiveBreederProgramSummaries,
} from "@libs/server/breeder-programs";
import { categoryScopeWhere } from "@libs/server/categories";
import { PRODUCT_RAIL_NEW_HOURS, type ProductRailFlags } from "@libs/shared/communityVibe";

/**
 * 홈 '지금 올라온 분양' 사진 레일(앱 docs/prd/community-vibe.md §3.6, AC-8).
 * - 최신 분양글(숨김·삭제·분양완료 제외) limit 개. 24시간 안 글은 isNew.
 * - 조회자 본인의 첫 분양글이 24시간 안에 올라왔으면 맨 앞에 고정(pinnedFirst). 첫 분양글 보상이다.
 */

export const PRODUCT_RAIL_LIMIT_DEFAULT = 10;
export const PRODUCT_RAIL_LIMIT_MAX = 20;
const HOUR_MS = 60 * 60 * 1000;

const railInclude = {
  user: {
    select: {
      id: true,
      name: true,
      avatar: true,
      breederPrograms: {
        where: { status: "ACTIVE" as const },
        select: breederProgramSummarySelect,
      },
    },
  },
  _count: { select: { favs: true } },
};

export async function getProductRail({
  limit = PRODUCT_RAIL_LIMIT_DEFAULT,
  viewerId,
  categoryPath,
  now = new Date(),
}: {
  limit?: number;
  viewerId?: number;
  categoryPath?: string;
  now?: Date;
}) {
  const newSince = new Date(now.getTime() - PRODUCT_RAIL_NEW_HOURS * HOUR_MS);
  const [excluded, scope] = await Promise.all([excludedAuthorIds(viewerId), categoryScopeWhere(categoryPath)]);
  const visible = {
    isHidden: false,
    isDeleted: false,
    status: { not: "판매완료" },
    // 보호소 공고 글은 홈 '지금 올라온 분양'에 싣지 않는다(앱 docs/prd/shelter-animals.md F-5).
    externalSource: null,
  };

  const [latest, firstOfViewer] = await Promise.all([
    client.product.findMany({
      where: {
        ...visible,
        ...(Object.keys(scope).length ? { AND: [scope] } : {}),
        ...(excluded.length ? { userId: { notIn: excluded } } : {}),
      },
      include: railInclude,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit,
    }),
    viewerId
      ? client.product.findFirst({
          where: { userId: viewerId },
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
          select: { id: true, createdAt: true },
        })
      : Promise.resolve(null),
  ]);

  // 첫 분양글(지운 글 포함 가장 오래된 글)이 24시간 안이고 지금 보이면 맨 앞에 고정한다.
  let pinned: (typeof latest)[number] | null = null;
  if (firstOfViewer && firstOfViewer.createdAt.getTime() >= newSince.getTime()) {
    pinned =
      latest.find((product) => product.id === firstOfViewer.id) ??
      (await client.product.findFirst({ where: { id: firstOfViewer.id, ...visible }, include: railInclude }));
  }

  const ordered = pinned ? [pinned, ...latest.filter((product) => product.id !== pinned!.id)] : latest;
  return ordered.slice(0, limit).map((product) => {
    const flags: ProductRailFlags = {
      isNew: product.createdAt.getTime() >= newSince.getTime(),
      pinnedFirst: pinned !== null && product.id === pinned.id,
    };
    return {
      ...product,
      user: {
        ...product.user,
        breederPrograms: getSortedActiveBreederProgramSummaries(product.user.breederPrograms),
      },
      ...flags,
    };
  });
}
