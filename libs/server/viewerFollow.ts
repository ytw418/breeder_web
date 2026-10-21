import client from "@libs/server/client";

/**
 * 보는 사람(viewer)이 상대를 팔로우하는지. 상세·랭킹 행의 팔로우 버튼 초기 상태(앱 docs/prd/profile.md 2026-10-21).
 * 비로그인·본인이면 조회하지 않고 false.
 */
export async function viewerFollows(viewerId: number | null | undefined, targetId: number): Promise<boolean> {
  if (!viewerId || viewerId === targetId) return false;
  try {
    const row = await client.follow.findFirst({
      where: { followerId: viewerId, followingId: targetId },
      select: { id: true },
    });
    return Boolean(row);
  } catch (error) {
    // 곁가지 정보라 실패해도 상세는 그대로 준다(버튼은 '팔로우'로 보인다).
    console.error("[viewerFollow]", error);
    return false;
  }
}

/** 여러 사람(랭킹 50명 등) 중 viewer 가 팔로우하는 id 들. 한 번의 조회. */
export async function viewerFollowingSet(
  viewerId: number | null | undefined,
  targetIds: number[]
): Promise<Set<number>> {
  const ids = Array.from(new Set(targetIds.filter((id) => id !== viewerId)));
  if (!viewerId || ids.length === 0) return new Set();
  try {
    const rows = await client.follow.findMany({
      where: { followerId: viewerId, followingId: { in: ids } },
      select: { followingId: true },
    });
    return new Set(rows.map((row) => row.followingId));
  } catch (error) {
    console.error("[viewerFollow]", error);
    return new Set();
  }
}
