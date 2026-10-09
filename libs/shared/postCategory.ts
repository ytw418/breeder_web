/**
 * 게시글 카테고리 공용 규칙(앱 constants/categories.ts REGION_POST_CATEGORY, PostCard postCategoryLabel 과 같음).
 * 서버(pages/api/posts)와 화면이 같이 쓴다.
 */

/** 동네 글 카테고리. 등록하면 서버가 작성자 동네를 글에 복사한다. 동네 미설정이면 400 REGION_REQUIRED. */
export const REGION_POST_CATEGORY = "동네";

/** 메타 첫 항목. '동네' 글은 카테고리 대신 작성자 시/군/구("강남구 · 닉네임"), 그 밖은 카테고리 그대로. */
export function postCategoryLabel(post: {
  category?: string | null;
  regionSigungu?: string | null;
}): string | null {
  if (post.category === REGION_POST_CATEGORY && post.regionSigungu) return post.regionSigungu;
  return post.category ?? null;
}
