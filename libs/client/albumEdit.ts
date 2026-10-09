/** 앨범 편집 규칙(앱 albums/edit.tsx). 고른 순서가 곧 앨범 순서다. */
import { ALBUM_POST_MAX, ALBUM_TITLE_MAX } from "@libs/shared/profile";

export type AlbumToggleResult = { selected: number[]; limited: boolean };

/** 사진을 고르거나 푼다. 이미 고른 것이면 빼고, 상한(30)이면 그대로 두고 limited 를 알린다. */
export function toggleAlbumPost(selected: readonly number[], postId: number): AlbumToggleResult {
  if (selected.includes(postId)) return { selected: selected.filter((id) => id !== postId), limited: false };
  if (selected.length >= ALBUM_POST_MAX) return { selected: [...selected], limited: true };
  return { selected: [...selected, postId], limited: false };
}

/** 앨범 이름 입력: 코드포인트 기준 12자를 넘으면 자른다. */
export const clampAlbumTitle = (value: string) =>
  Array.from(value).length > ALBUM_TITLE_MAX ? Array.from(value).slice(0, ALBUM_TITLE_MAX).join("") : value;

/** 편집 화면 목록: 앨범에 든 글을 앞에 두고(첫 페이지 밖의 글도 풀 수 있게) 내 사진 글을 잇되 같은 글은 한 번만. */
export function mergeAlbumCandidates<T extends { id: number }>(albumPosts: readonly T[], myPhotos: readonly T[]) {
  const seen = new Set<number>();
  return [...albumPosts, ...myPhotos].filter((post) => {
    if (seen.has(post.id)) return false;
    seen.add(post.id);
    return true;
  });
}
