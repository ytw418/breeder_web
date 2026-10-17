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
}

export const EXPLORE_LIMIT = 6;
export const DEBATES_HREF = "/debates";

const key = (item: ExploreItem) => `${item.kind}:${item.id}`;

/**
 * 비슷한 글·인기 글을 6개씩 자른다. 인기 글에서는 지금 보는 글과 비슷한 글에 이미 나온 글을 뺀다.
 */
export function pickExploreItems({
  similar,
  popular,
  currentPostId,
  hotDebate,
}: {
  similar: ExploreItem[];
  popular: ExploreItem[];
  currentPostId: number | null;
  hotDebate: { id: number; title: string } | null;
}): ExploreMoreData {
  const shownSimilar = similar.slice(0, EXPLORE_LIMIT);
  const seen = new Set(shownSimilar.map(key));
  if (currentPostId !== null) seen.add(`post:${currentPostId}`);
  return {
    similar: shownSimilar,
    popular: popular.filter((item) => !seen.has(key(item))).slice(0, EXPLORE_LIMIT),
    debateHref: hotDebate ? toPostPath(hotDebate.id, hotDebate.title) : DEBATES_HREF,
  };
}
