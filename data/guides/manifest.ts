import { guideHref } from "@libs/shared/guides";

/**
 * 공개된 가이드의 종 이름 → 주소. 상품·경매 상세처럼 본문이 필요 없는 클라이언트 화면이 쓴다.
 * index.ts 의 published 가이드와 같아야 한다(__tests__/guides.test.ts 가 확인).
 */
export const PUBLISHED_GUIDE_SLUGS: Readonly<Record<string, string>> = {
  "크레스티드 게코": "크레스티드-게코",
};

export const publishedGuideHref = (species: string | null | undefined): string | null => {
  const slug = species ? PUBLISHED_GUIDE_SLUGS[species.trim()] : undefined;
  return slug ? guideHref(slug) : null;
};
