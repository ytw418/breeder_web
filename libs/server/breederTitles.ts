import client from "@libs/server/client";
import { RANKABLE_USER_WHERE } from "@libs/server/rankableUser";
import {
  pickRepresentativeTitleKeys,
  titleLabelOf,
  type BreederTitleKey,
  type LockedTitleStats,
} from "@libs/shared/breederKeywords";

/**
 * 작성자 줄 칭호 pill(community-vibe F-7). 목록·상세의 작성자 select 에 `titleKey: true` 를 넣고
 * 응답에서 이 함수로 `titleLabel`("소통왕")로 바꾼다. 앱 UserMini·웹 AuthorLinkUser 가 titleLabel 을 받아 pill 을 그린다.
 */
export function withTitleLabel<T extends { titleKey?: string | null }>(
  user: T,
): Omit<T, "titleKey"> & { titleLabel: string | null } {
  const { titleKey, ...rest } = user;
  return { ...rest, titleLabel: titleLabelOf(titleKey) };
}

type CountRow = { _count: { _all: number } };

/** groupBy 결과 → id 별 개수. */
function countBy<T extends CountRow>(rows: T[], idOf: (row: T) => number): Map<number, number> {
  return new Map(rows.map((row) => [idOf(row), row._count._all]));
}

/**
 * 대표 칭호(User.titleKey)를 다시 계산해 바뀐 사람만 저장한다(앱 docs/prd/community-vibe.md §3.3, 2026-10-21 감사 #29).
 * 값은 프로필 '딴 칭호'(libs/server/lockedTitles.ts getLockedTitleStats)와 같은 기준이고, 대표는
 * pickRepresentativeTitleKeys(랭킹 대상끼리 비교해 가장 두드러진 칭호)로 고른다. 랭킹 대상이 아닌 계정(운영·테스트)은 비운다.
 * 랭킹 크론(ranking-alerts)이 하루 한 번 부른다. 활동 즉시 갱신은 2차(쓰기마다 집계 비용).
 */
export async function refreshTitleKeys(): Promise<{ checked: number; updated: number }> {
  const notNotice = { OR: [{ category: null }, { category: { not: "공지" } }] };
  const [users, staleUsers, posts, products, comments, bids, auctions, bloodlines, followers] = await Promise.all([
    client.user.findMany({ where: RANKABLE_USER_WHERE, select: { id: true, titleKey: true } }),
    client.user.findMany({ where: { titleKey: { not: null } }, select: { id: true } }),
    client.post.findMany({
      where: { isHidden: false, ...notNotice, user: RANKABLE_USER_WHERE },
      select: { userId: true, image: true, images: true, _count: { select: { Likes: true } } },
    }),
    client.product.groupBy({ by: ["userId"], where: { isDeleted: false, isHidden: false }, _count: { _all: true } }),
    client.comment.groupBy({ by: ["userId"], where: { isHidden: false, deletedAt: null }, _count: { _all: true } }),
    client.bid.groupBy({ by: ["userId"], where: { archivedAt: null }, _count: { _all: true } }),
    client.auction.groupBy({ by: ["userId"], where: { isHidden: false }, _count: { _all: true } }),
    client.bloodlineCard.groupBy({
      by: ["creatorId"],
      where: { cardType: "BLOODLINE", status: "ACTIVE" },
      _count: { _all: true },
    }),
    client.follow.groupBy({ by: ["followingId"], _count: { _all: true } }),
  ]);

  const productCount = countBy(products, (row) => row.userId);
  const commentCount = countBy(comments, (row) => row.userId);
  const bidCount = countBy(bids, (row) => row.userId);
  const auctionCount = countBy(auctions, (row) => row.userId);
  const bloodlineCount = countBy(bloodlines, (row) => row.creatorId);
  const followerCount = countBy(followers, (row) => row.followingId);
  const postStats = new Map<number, { posts: number; photos: number; likes: number }>();
  for (const post of posts) {
    const entry = postStats.get(post.userId) ?? { posts: 0, photos: 0, likes: 0 };
    entry.posts += 1;
    entry.photos += post.images.length > 0 ? post.images.length : post.image ? 1 : 0;
    entry.likes += post._count.Likes;
    postStats.set(post.userId, entry);
  }

  const statsList: LockedTitleStats[] = users.map(({ id }) => {
    const post = postStats.get(id);
    return {
      postsCount: post?.posts ?? 0,
      productsCount: productCount.get(id) ?? 0,
      commentsCount: commentCount.get(id) ?? 0,
      bidsCount: bidCount.get(id) ?? 0,
      auctionsCount: auctionCount.get(id) ?? 0,
      bloodlinesCount: bloodlineCount.get(id) ?? 0,
      followersCount: followerCount.get(id) ?? 0,
      likesReceivedCount: post?.likes ?? 0,
      photosCount: post?.photos ?? 0,
    };
  });
  const picked = pickRepresentativeTitleKeys(statsList);

  // 바뀐 사람만 칭호별로 묶어 저장한다(id 목록 조건이 있는 updateMany).
  const changes = new Map<BreederTitleKey | null, number[]>();
  const rankable = new Set<number>();
  users.forEach(({ id, titleKey }, index) => {
    rankable.add(id);
    const next = picked[index];
    if ((titleKey ?? null) === next) return;
    changes.set(next, [...(changes.get(next) ?? []), id]);
  });
  // 랭킹 대상에서 빠진 계정(운영 role·탈퇴 등)에 남은 칭호는 지운다.
  const cleared = staleUsers.map(({ id }) => id).filter((id) => !rankable.has(id));
  if (cleared.length) changes.set(null, [...(changes.get(null) ?? []), ...cleared]);

  let updated = 0;
  for (const [titleKey, ids] of Array.from(changes)) {
    const result = await client.user.updateMany({ where: { id: { in: ids } }, data: { titleKey } });
    updated += result.count;
  }
  return { checked: users.length, updated };
}
