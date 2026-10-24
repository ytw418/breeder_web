import client from "@libs/server/client";
import {
  pickLockedTitles,
  unlockedTitleKeys,
  type BreederTitleKey,
  type LockedTitleStats,
} from "@libs/shared/breederKeywords";
import type { LockedTitle } from "@libs/shared/communityVibe";

/**
 * 본인 프로필 '아직 못 단 칭호'(앱 docs/prd/community-vibe.md §3.3, AC-4). 전체 기간 누적 값으로 센다.
 * 게시글·사진·받은 좋아요는 숨김·공지 글을 빼고(TOP 브리더 highlight 와 같은 기준), 분양글은 삭제·숨김 제외,
 * 혈통은 내가 만든 ACTIVE 혈통 카드, 경매왕은 입찰(다시 시작한 경매의 지난 회차 제외) + 연 경매(숨김 제외).
 */
export async function getLockedTitleStats(userId: number): Promise<LockedTitleStats> {
  const [posts, productsCount, commentsCount, bidsCount, auctionsCount, bloodlinesCount, followersCount] =
    await Promise.all([
      client.post.findMany({
        where: { userId, isHidden: false, OR: [{ category: null }, { category: { not: "공지" } }] },
        select: { image: true, images: true, _count: { select: { Likes: true } } },
      }),
      client.product.count({ where: { userId, isDeleted: false, isHidden: false, externalSource: null } }),
      client.comment.count({ where: { userId, isHidden: false, deletedAt: null } }),
      client.bid.count({ where: { userId, archivedAt: null } }),
      client.auction.count({ where: { userId, isHidden: false } }),
      client.bloodlineCard.count({ where: { creatorId: userId, cardType: "BLOODLINE", status: "ACTIVE" } }),
      client.follow.count({ where: { followingId: userId } }),
    ]);
  let photosCount = 0;
  let likesReceivedCount = 0;
  for (const post of posts) {
    photosCount += post.images.length > 0 ? post.images.length : post.image ? 1 : 0;
    likesReceivedCount += post._count.Likes;
  }
  return {
    postsCount: posts.length,
    productsCount,
    commentsCount,
    bidsCount,
    auctionsCount,
    bloodlinesCount,
    followersCount,
    likesReceivedCount,
    photosCount,
  };
}

/**
 * 프로필 칭호. earned = 단 칭호(누구 프로필이든, 대표 칭호 representative 가 있으면 맨 앞), locked = 아직 못 단 칭호
 * 최대 3개(본인만, includeLocked). 같은 집계를 한 번만 한다. 실패하면 빈 목록(프로필 응답은 막지 않는다).
 */
export async function getProfileTitles(
  userId: number,
  { includeLocked, representative }: { includeLocked: boolean; representative?: string | null },
): Promise<{ earned: BreederTitleKey[]; locked: LockedTitle[] | null }> {
  try {
    const stats = await getLockedTitleStats(userId);
    const earned = unlockedTitleKeys(stats);
    const first = earned.find((key) => key === representative);
    return {
      earned: first ? [first, ...earned.filter((key) => key !== first)] : earned,
      locked: includeLocked ? pickLockedTitles(stats, 3) : null,
    };
  } catch (error) {
    console.error("[lockedTitles]", error);
    return { earned: [], locked: includeLocked ? [] : null };
  }
}
