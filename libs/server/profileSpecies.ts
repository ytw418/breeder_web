import type { Prisma } from "@prisma/client";
import client from "@libs/server/client";

/**
 * 프로필 주력 종·종별 자동 앨범(앱 docs/prd/profile.md F-5, F-7).
 * 게시글 종은 `Post.type`, 상품 종은 `Product.category` 문자열을 그대로 쓴다.
 */

/** 종으로 세지 않는 값. community·general 은 예전 게시글의 '종 없음' 표시다. */
export const NON_SPECIES = new Set(["", "community", "general"]);
/** 이름 아래에 보여 줄 주력 종 수. */
export const TOP_SPECIES_LIMIT = 2;
/** 앨범 줄에 보여 줄 종별 앨범 수. */
export const SPECIES_ALBUM_LIMIT = 8;

export interface SpeciesCountRow {
  label: string | null | undefined;
  count: number;
  latestAt: Date | null | undefined;
}

export interface RankedSpecies {
  label: string;
  count: number;
  latestAt: Date | null;
}

/**
 * 같은 라벨을 합쳐 많은 순 → 최근 사용순 → 이름순으로 정렬한다.
 * 종이 아닌 값(null·빈 값·community·general)은 뺀다.
 */
export function rankSpecies(rows: SpeciesCountRow[], limit: number): RankedSpecies[] {
  const merged = new Map<string, RankedSpecies>();
  for (const row of rows) {
    const label = (row.label ?? "").trim();
    if (NON_SPECIES.has(label) || row.count <= 0) continue;
    const prev = merged.get(label);
    const latestAt = row.latestAt ?? null;
    if (!prev) {
      merged.set(label, { label, count: row.count, latestAt });
      continue;
    }
    prev.count += row.count;
    if (latestAt && (!prev.latestAt || latestAt > prev.latestAt)) prev.latestAt = latestAt;
  }
  return Array.from(merged.values())
    .sort(
      (a, b) =>
        b.count - a.count ||
        (b.latestAt?.getTime() ?? 0) - (a.latestAt?.getTime() ?? 0) ||
        a.label.localeCompare(b.label, "ko")
    )
    .slice(0, limit);
}

/** 프로필 주력 종(최대 2개). 공지·숨김 글, 삭제·숨김 상품은 세지 않는다. */
export async function getTopSpecies(userId: number): Promise<string[]> {
  const [postRows, productRows] = await Promise.all([
    client.post.groupBy({
      by: ["type"],
      where: { userId, isHidden: false, NOT: { category: "공지" } },
      _count: { _all: true },
      _max: { createdAt: true },
    }),
    client.product.groupBy({
      by: ["category"],
      where: { userId, isDeleted: false, isHidden: false },
      _count: { _all: true },
      _max: { createdAt: true },
    }),
  ]);
  return rankSpecies(
    [
      ...postRows.map((row) => ({
        label: row.type,
        count: row._count._all,
        latestAt: row._max.createdAt,
      })),
      ...productRows.map((row) => ({
        label: row.category,
        count: row._count._all,
        latestAt: row._max.createdAt,
      })),
    ],
    TOP_SPECIES_LIMIT
  ).map((row) => row.label);
}

/**
 * 여러 사용자의 주력 종을 한 번에 구한다(홈 '우리 동네 브리더' 카드). 규칙은 getTopSpecies 와 같다.
 * 결과에는 넘긴 id 가 모두 들어가고, 종이 없는 사람은 빈 배열이다.
 */
export async function getTopSpeciesByUserIds(userIds: number[]): Promise<Map<number, string[]>> {
  const result = new Map<number, string[]>(userIds.map((id) => [id, []]));
  if (userIds.length === 0) return result;
  const [postRows, productRows] = await Promise.all([
    client.post.groupBy({
      by: ["userId", "type"],
      where: {
        userId: { in: userIds },
        isHidden: false,
        NOT: { category: "공지" },
      },
      _count: { _all: true },
      _max: { createdAt: true },
    }),
    client.product.groupBy({
      by: ["userId", "category"],
      where: { userId: { in: userIds }, isDeleted: false, isHidden: false },
      _count: { _all: true },
      _max: { createdAt: true },
    }),
  ]);
  const rowsByUser = new Map<number, SpeciesCountRow[]>();
  const push = (userId: number, row: SpeciesCountRow) => {
    const rows = rowsByUser.get(userId);
    if (rows) rows.push(row);
    else rowsByUser.set(userId, [row]);
  };
  for (const row of postRows) {
    push(row.userId, {
      label: row.type,
      count: row._count._all,
      latestAt: row._max.createdAt,
    });
  }
  for (const row of productRows) {
    push(row.userId, {
      label: row.category,
      count: row._count._all,
      latestAt: row._max.createdAt,
    });
  }
  rowsByUser.forEach((rows, userId) => {
    if (!result.has(userId)) return;
    result.set(
      userId,
      rankSpecies(rows, TOP_SPECIES_LIMIT).map((row) => row.label)
    );
  });
  return result;
}

/**
 * 프로필 '사진' 탭에 들어가는 글: 공지가 아니고 사진이 있는 글.
 * 구 데이터는 images 가 비어 있고 image 만 있어 둘 중 하나만 있어도 사진 글로 본다.
 * 숨김 글은 작성자·운영자(canSeeHidden)에게만 보인다.
 */
export function photoPostWhere(userId: number, canSeeHidden: boolean): Prisma.PostWhereInput {
  return {
    userId,
    NOT: { category: "공지" },
    ...(canSeeHidden ? {} : { isHidden: false }),
    OR: [{ images: { isEmpty: false } }, { image: { not: "" } }],
  };
}

export interface SpeciesAlbum {
  species: string;
  count: number;
  /** 그 종의 가장 최근 사진 글의 대표 사진(Cloudflare 이미지 id). */
  cover: string;
}

/** 종별 자동 앨범: 사진 글이 많은 종부터 최대 8개, 표지는 그 종 최신 사진. */
export async function getSpeciesAlbums(
  userId: number,
  canSeeHidden: boolean
): Promise<SpeciesAlbum[]> {
  const baseWhere = photoPostWhere(userId, canSeeHidden);
  const rows = await client.post.groupBy({
    by: ["type"],
    where: { ...baseWhere, type: { not: null } },
    _count: { _all: true },
    _max: { createdAt: true },
  });
  const ranked = rankSpecies(
    rows.map((row) => ({
      label: row.type,
      count: row._count._all,
      latestAt: row._max.createdAt,
    })),
    SPECIES_ALBUM_LIMIT
  );

  // 종이 많아야 8개라 종마다 최신 글 1개를 인덱스(userId)로 찾는다.
  const albums = await Promise.all(
    ranked.map(async (album) => {
      const latest = await client.post.findFirst({
        where: { ...baseWhere, type: album.label },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        select: { image: true, images: true },
      });
      const cover = latest?.images?.[0] || latest?.image || "";
      return { species: album.label, count: album.count, cover };
    })
  );
  return albums;
}
