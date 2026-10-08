import type { Prisma, PrismaClient } from "@prisma/client";
import client from "@libs/server/client";
import { withPostImages } from "@libs/postImages";
import { photoPostWhere } from "@libs/server/profileSpecies";
import { ALBUM_POST_MAX } from "@libs/shared/profile";

/**
 * 사용자 앨범(앱 docs/prd/profile.md F-9, AC-22~25).
 * 앨범은 `ProfileAlbum.postIds`(고른 순서)로 사진 글을 가리킨다. 지워졌거나 숨겨졌거나 사진이 없어진 글은
 * 읽을 때 걸러 내고 따로 정리하지 않는다(편집 저장 때 자연히 빠진다).
 */

type Tx = Prisma.TransactionClient | PrismaClient;

/** 최근 만든 순. 새 앨범이 앨범 줄 맨 앞에 온다. */
export const ALBUM_ORDER: Prisma.ProfileAlbumOrderByWithRelationInput[] = [
  { createdAt: "desc" },
  { id: "desc" },
];

/** 그리드·앨범 보기에 쓰는 글 필드(GET /api/users/:id/posts 와 같다). */
export const albumPostSelect = {
  id: true,
  title: true,
  description: true,
  image: true,
  images: true,
  category: true,
  type: true,
  createdAt: true,
  profilePinnedAt: true,
  isHidden: true,
  _count: { select: { comments: true, Likes: true } },
} satisfies Prisma.PostSelect;

/** ids 가 모두 이 사람의 사진 글(공지 아님, 숨김 허용)인지. 개수로 확인한다. */
export async function areOwnedPhotoPosts(tx: Tx, userId: number, ids: number[]) {
  if (ids.length === 0 || ids.length > ALBUM_POST_MAX) return false;
  const count = await tx.post.count({
    where: { ...photoPostWhere(userId, true), id: { in: ids } },
  });
  return count === ids.length;
}

/** 여러 앨범에 든 글 중 보이는 사진 글을 한 번에 받아 id → 글로 돌려준다. */
async function visiblePostMap(ownerId: number, ids: number[], canSeeHidden: boolean) {
  if (!ids.length) return new Map<number, Prisma.PostGetPayload<{ select: typeof albumPostSelect }>>();
  const posts = await client.post.findMany({
    where: { ...photoPostWhere(ownerId, canSeeHidden), id: { in: ids } },
    select: albumPostSelect,
  });
  return new Map(posts.map((post) => [post.id, post]));
}

export interface AlbumSummary {
  id: number;
  title: string;
  /** 넣은 순서 첫 사진(Cloudflare 이미지 id). 보이는 글이 없으면 "". */
  cover: string;
  count: number;
}

/** 프로필 앨범 줄용 요약. 남이 볼 때는 사진 0장 앨범을 뺀다. */
export async function getAlbumSummaries(ownerId: number, canSeeHidden: boolean, isOwner: boolean) {
  const albums = await client.profileAlbum.findMany({
    where: { userId: ownerId },
    orderBy: ALBUM_ORDER,
    select: { id: true, title: true, postIds: true },
  });
  const map = await visiblePostMap(ownerId, Array.from(new Set(albums.flatMap((a) => a.postIds))), canSeeHidden);
  const summaries: AlbumSummary[] = albums.map((album) => {
    const posts = album.postIds.map((id) => map.get(id)).filter((post): post is NonNullable<typeof post> => !!post);
    const first = posts[0] ? withPostImages(posts[0]) : null;
    return {
      id: album.id,
      title: album.title,
      cover: first?.images[0] || first?.image || "",
      count: posts.length,
    };
  });
  return isOwner ? summaries : summaries.filter((album) => album.count > 0);
}

/** 앨범 보기: 넣은 순서대로 보이는 사진 글. */
export async function getAlbumPosts(ownerId: number, postIds: number[], canSeeHidden: boolean) {
  const map = await visiblePostMap(ownerId, postIds, canSeeHidden);
  return postIds
    .map((id) => map.get(id))
    .filter((post): post is NonNullable<typeof post> => !!post)
    .map(withPostImages);
}
