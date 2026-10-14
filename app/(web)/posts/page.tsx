import { redirect } from "next/navigation";

type SearchParams = Record<string, string | string[] | undefined>;

/**
 * 옛 반려생활 탭(/posts). 2026-10-15 홈 구성 A안(docs/prd/home-ia.md)으로 반려생활 내용이 홈이 됐다.
 * 알림·공유·검색 결과의 /posts?category=동네 같은 주소는 쿼리를 그대로 홈으로 넘긴다(홈이 칩을 고르고 목록으로 스크롤한다).
 * 글 상세(/posts/[id])·글쓰기(/posts/upload)·공지(/posts/notices)는 그대로다.
 */
export default async function PostsRedirect({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string") query.set(key, value);
    else if (Array.isArray(value)) value.forEach((v) => query.append(key, v));
  }
  const qs = query.toString();
  redirect(qs ? `/?${qs}` : "/");
}
