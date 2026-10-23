import { toPostPath } from "@libs/post-route";

/** 상세 아래 '더 둘러보기' 한 칸. ISR 캐시 HTML 에 들어가므로 정적 문구(meta)만 싣는다. */
export interface ExploreItem {
  kind: "post" | "product" | "auction";
  id: number;
  href: string;
  title: string;
  /** Cloudflare 이미지 id(또는 주소). 없으면 null. */
  image: string | null;
  /** "질문", "크레스티드 게코 · 60,000원 · 분양중" 같은 정적 문구 */
  meta: string;
}

export interface ExploreMoreData {
  similar: ExploreItem[];
  popular: ExploreItem[];
  /** '지금 뜨거운 토론 참여하기' 링크. 진행 중 토론이 없으면 토론 모아보기. */
  debateHref: string;
  /** '내 개체 혈통 카드 만들기' 버튼. 강아지·고양이 글엔 없다(파충류 쪽 기능). */
  bloodlineCta: boolean;
}

export const EXPLORE_LIMIT = 6;
/** 강아지·고양이 글의 '지금 인기 글'은 같은 공간 글로만 채우고, 이보다 적으면 섹션을 숨긴다. */
export const EXPLORE_PET_POPULAR_MIN = 3;
export const DEBATES_HREF = "/debates";

const key = (item: ExploreItem) => `${item.kind}:${item.id}`;

/**
 * 비슷한 글·인기 글을 6개씩 자른다. 인기 글에서는 지금 보는 글과 비슷한 글에 이미 나온 글을 뺀다.
 * 강아지·고양이 글(petSpace)은 인기 글·토론을 같은 공간에서 받아 오고(서버), 인기 글이 3개보다 적으면 섹션을 숨기며
 * 혈통 카드 버튼을 뺀다(2026-10-23 토스 디자인 리뷰 — 강아지 글 아래 파충류·곤충 글과 혈통 카드가 나왔다).
 */
export function pickExploreItems({
  similar,
  popular,
  currentPostId,
  hotDebate,
  petSpace = false,
}: {
  similar: ExploreItem[];
  popular: ExploreItem[];
  currentPostId: number | null;
  hotDebate: { id: number; title: string } | null;
  petSpace?: boolean;
}): ExploreMoreData {
  const shownSimilar = similar.slice(0, EXPLORE_LIMIT);
  const seen = new Set(shownSimilar.map(key));
  if (currentPostId !== null) seen.add(`post:${currentPostId}`);
  const shownPopular = popular.filter((item) => !seen.has(key(item))).slice(0, EXPLORE_LIMIT);
  return {
    similar: shownSimilar,
    popular: petSpace && shownPopular.length < EXPLORE_PET_POPULAR_MIN ? [] : shownPopular,
    debateHref: hotDebate ? toPostPath(hotDebate.id, hotDebate.title) : DEBATES_HREF,
    bloodlineCta: !petSpace,
  };
}
