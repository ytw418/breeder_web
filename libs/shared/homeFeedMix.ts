/**
 * 홈 쓰레드식 피드에 분양글을 섞는 규칙(앱 docs/prd/home-v2.md S-1, 2026-10-22 사용자 결정).
 * 웹 breeder_web libs/shared/homeFeedMix.ts = 앱 src/lib/homeFeedMix.ts 사본이라 함께 고치고
 * 앱 `npm run test:home-feed-mix`·웹 jest 로 확인한다.
 */

/** 홈 칩 '분양': 게시글 대신 분양글만 같은 모양으로 보인다(게시글 카테고리가 아니라 피드 필터). */
export const HOME_SALE_FILTER = "분양";

/** 게시글 몇 개마다 분양글 하나를 끼우는지. */
export const HOME_PRODUCT_EVERY = 3;

export type HomeFeedRow<P, Q> = { kind: "post"; post: P } | { kind: "product"; product: Q };

/**
 * 게시글 every 개 뒤마다 분양글 하나를 끼운다(첫 분양글은 게시글 every 개 뒤).
 * 게시글이 아직 더 올 수 있으면(postsDone=false) 쓰고 남은 분양글은 다음 페이지를 위해 아껴 둔다.
 * 게시글이 끝났으면 남은 분양글을 뒤에 차례로 붙인다(게시글이 0개여도 분양글은 보인다).
 * 같은 입력엔 늘 같은 순서라 다음 페이지가 붙어도 앞 행의 위치가 바뀌지 않는다.
 */
export function mixHomeFeed<P, Q>(
  posts: readonly P[],
  products: readonly Q[],
  { postsDone, every = HOME_PRODUCT_EVERY }: { postsDone: boolean; every?: number }
): HomeFeedRow<P, Q>[] {
  const rows: HomeFeedRow<P, Q>[] = [];
  let used = 0;
  posts.forEach((post, index) => {
    rows.push({ kind: "post", post });
    if ((index + 1) % every === 0 && used < products.length) {
      rows.push({ kind: "product", product: products[used] });
      used += 1;
    }
  });
  if (postsDone) {
    for (; used < products.length; used += 1) rows.push({ kind: "product", product: products[used] });
  }
  return rows;
}

/** 지금 행을 다 채우려면 분양글이 몇 개 필요한지. 받은 분양글이 이보다 적으면 다음 페이지를 받는다. */
export function productsNeeded(postCount: number, every = HOME_PRODUCT_EVERY): number {
  return Math.floor(postCount / every);
}
