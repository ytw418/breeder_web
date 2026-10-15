import { toJsonLdHtml } from "@libs/shared/seo";

/**
 * 구조화 데이터 태그. next/script 로 넣으면 HTML 에 태그가 남지 않고 JS 데이터 안에만 들어가
 * JS 를 실행하지 않는 크롤러(대부분의 AI 검색 봇)가 읽지 못한다. 그래서 일반 script 태그로 그린다.
 */
export default function JsonLd({ id, data }: { id: string; data: unknown }) {
  if (!data) return null;
  return (
    <script
      id={id}
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: toJsonLdHtml(data) }}
    />
  );
}
