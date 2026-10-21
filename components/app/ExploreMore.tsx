import type { ReactNode } from "react";
import Link from "next/link";
import NextImage from "next/image";
import { makeImageUrl } from "@libs/client/utils";
import type { ExploreItem, ExploreMoreData } from "@libs/shared/exploreMore";

/**
 * 공개 상세 페이지 맨 아래 '더 둘러보기'(서버 컴포넌트). 링크가 서버 HTML 에 들어가 검색엔진이 따라간다.
 * 비슷한 글 → 광고 → 인기 글 → 혈통·토론 바로가기 순서. 시간·좋아요 수 같은 실시간 값은 그리지 않는다.
 * 광고는 페이지가 고른다(게시글은 AdSense, 분양·경매는 쿠팡, 공지·숨김 글은 없음). 광고는 스스로 구분선을 둔다.
 */
export default function ExploreMore({
  data,
  similarTitle,
  ad,
}: {
  data: ExploreMoreData;
  /** '비슷한 글' / '비슷한 분양' / '진행 중인 비슷한 경매' */
  similarTitle: string;
  ad?: ReactNode;
}) {
  return (
    <div data-testid="explore-more">
      {data.similar.length ? <ExploreSection title={similarTitle} items={data.similar} /> : null}
      {ad}
      {data.popular.length ? <ExploreSection title="지금 인기 글" items={data.popular} /> : null}
      <div className="h-2 bg-app-gap" />
      <nav aria-label="브리디 더 둘러보기" className="flex flex-col gap-2 px-4 py-5">
        <Link
          href="/bloodline-cards/create"
          // 보조 버튼: 상세의 주 행동(입찰·채팅)과 다투지 않게 주황 채움 대신 회색 면(2026-10-21 디자인 리뷰).
          className="flex h-[52px] items-center justify-center rounded-md bg-app-surface text-[16px] font-semibold text-app-text"
        >
          내 개체 혈통 카드 만들기
        </Link>
        <Link
          href={data.debateHref}
          className="flex h-[52px] items-center justify-center rounded-md bg-app-surface text-[16px] font-semibold text-app-text"
        >
          지금 뜨거운 토론 참여하기
        </Link>
        <Link href="/" className="py-2 text-center text-[14px] text-app-muted underline underline-offset-[3px]">
          브리디 홈에서 더 보기
        </Link>
        <p className="text-center text-[12px] text-app-muted">
          <Link href="/privacy">개인정보처리방침</Link>
          <span aria-hidden> · </span>
          <Link href="/terms">이용약관</Link>
        </p>
      </nav>
    </div>
  );
}

function ExploreSection({ title, items }: { title: string; items: ExploreItem[] }) {
  return (
    <section>
      <div className="h-2 bg-app-gap" />
      <h2 className="px-4 pb-1 pt-5 text-[17px] font-bold text-app-text">{title}</h2>
      <ul className="px-4">
        {items.map((item, index) => (
          <li key={`${item.kind}-${item.id}`} className={index < items.length - 1 ? "border-b border-app-line" : ""}>
            <Link href={item.href} className="flex items-center gap-3 py-3">
              {item.image ? (
                <NextImage
                  src={makeImageUrl(item.image, "product")}
                  alt={item.title}
                  width={56}
                  height={56}
                  className="h-14 w-14 shrink-0 rounded-xl bg-app-placeholder object-cover"
                />
              ) : item.kind === "post" ? null : (
                // 분양글·경매는 사진 칸을 늘 둬 줄이 맞게 한다(글은 사진 없는 글이 많아 비운다).
                <span aria-hidden className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-app-surface text-app-caption">
                  <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                    <rect x="3" y="5" width="18" height="14" rx="2" />
                    <path d="m3 16 5-5 4 4 3-3 6 6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-semibold text-app-text">{item.title}</p>
                {item.meta ? <p className="mt-0.5 truncate text-[13px] text-app-muted">{item.meta}</p> : null}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
