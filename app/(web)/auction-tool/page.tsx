import type { Metadata } from "next";
import Link from "next/link";

const AUCTION_TOOL_OG_IMAGE = "/auction-tool/opengraph-image";
const AUCTION_TOOL_TWITTER_IMAGE = "/auction-tool/twitter-image";

export const metadata: Metadata = {
  title: "링크형 경매도구",
  description:
    "카페·밴드·오픈채팅에서 링크 하나로 바로 입찰하고 마감할 수 있는 경매도구를 소개합니다.",
  openGraph: {
    title: "브리디 경매도구 | 30초면 만드는 경매 도구",
    description:
      "30초면 경매 링크를 만들고, 신고/신뢰 설정까지 한 번에 운영하세요.",
    type: "website",
    images: [
      {
        url: AUCTION_TOOL_OG_IMAGE,
        width: 1200,
        height: 630,
        alt: "브리디 경매도구 공유 이미지",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "브리디 경매도구 | 30초면 만드는 경매 도구",
    description:
      "30초면 경매 링크를 만들고, 신고/신뢰 설정까지 한 번에 운영하세요.",
    images: [AUCTION_TOOL_TWITTER_IMAGE],
  },
};

const quickStats = [
  {
    label: "경매 시작",
    value: "30초",
    desc: "등록 후 링크 생성",
  },
  {
    label: "마감 연장",
    value: "+5분",
    desc: "종료 3분 전 입찰 시 자동",
  },
  {
    label: "호가 단위",
    value: "직접 설정",
    desc: "판매자가 정한 입찰 단위로 검증",
  },
];

const features = [
  {
    title: "입찰/마감 자동화",
    desc: "호가 검증, 종료 임박 연장, 순위 갱신을 자동 처리합니다.",
  },
  {
    title: "신뢰 표시",
    desc: "판매자 연락처와 처리 이력을 한 화면에서 공개합니다.",
  },
  {
    title: "이동 최소화",
    desc: "공유 링크 하나로 참여, 입찰, 낙찰 확인이 끝납니다.",
  },
];

const steps = [
  "상품 등록", "링크 공유", "자동 운영", "낙찰 공개",
];

const faqs = [
  {
    q: "카페나 밴드를 바꿔야 하나요?",
    a: "바꾸지 마세요. 기존 채널은 유지한 채 링크만 올려 경매를 운영합니다.",
  },
  {
    q: "사기 대응은 어떻게 되나요?",
    a: "신고 접수 시 제재 및 처리 상태를 사용자와 관리자 모두에게 노출합니다.",
  },
];

const PRIMARY_CTA =
  "inline-flex h-[52px] w-full items-center justify-center rounded-md bg-app-brand px-6 text-[16px] font-semibold text-white sm:w-auto sm:min-w-[200px]";
const SECONDARY_CTA =
  "inline-flex h-[52px] w-full items-center justify-center rounded-md bg-app-surface px-6 text-[16px] font-semibold text-app-text sm:w-auto sm:min-w-[200px]";
const NEUTRAL_PILL =
  "inline-flex shrink-0 items-center rounded-md bg-app-surface px-2 py-1 text-[12px] font-semibold text-app-muted";
const SECTION_TITLE = "text-[20px] font-bold text-app-text sm:text-[24px]";

// 플랫 토큰(design/mockups/REFERENCE.md): 그라데이션·글로우·영문 장식 라벨 없음, 주황은 주 CTA 에만.
export default function AuctionToolLandingPage() {
  return (
    <div className="min-h-screen bg-app-bg text-app-text">
      <section className="border-b border-app-line bg-app-bg">
        <div className="mx-auto flex w-full max-w-[1020px] flex-col gap-8 px-4 py-10 sm:px-6 sm:py-12 lg:flex-row lg:items-end lg:justify-between lg:gap-10">
          <div className="max-w-[560px]">
            <p className="text-[13px] font-semibold text-app-muted">
              브리디 경매도구
            </p>
            <h1 className="mt-2 text-[24px] font-bold leading-[1.3] text-app-text sm:text-[28px]">
              링크 하나로 시작하는 경매 운영
            </h1>
            <p className="mt-3 text-[16px] leading-6 text-app-sub">
              카페와 밴드로 흩어진 경매 글을 하나의 흐름으로 묶어 입찰·마감·신고 운영까지
              한 번에 정리합니다.
            </p>
            <div className="mt-4">
              <span className={NEUTRAL_PILL}>30초로 시작, 실시간 운영까지</span>
            </div>
            <div className="mt-6 flex flex-col gap-2 sm:flex-row">
              <Link href="/auth/login?next=%2Fauctions%2Fcreate" className={PRIMARY_CTA}>
                시작하기
              </Link>
              <Link href="/auctions" className={SECONDARY_CTA}>
                진행중 경매 보기
              </Link>
            </div>
          </div>

          <div className="w-full max-w-[380px]">
            <div className="overflow-hidden rounded-xl border border-app-border bg-app-elevated">
              {quickStats.map((item, idx) => (
                <article
                  key={item.label}
                  className={`px-4 py-3 ${idx === 0 ? "" : "border-t border-app-line"}`}
                >
                  <p className="text-[13px] font-semibold text-app-muted">{item.label}</p>
                  <p className="mt-1 text-[22px] font-bold text-app-text">{item.value}</p>
                  <p className="mt-0.5 text-[13px] text-app-muted">{item.desc}</p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="app-section-gap" />

      <section className="bg-app-bg">
        <div className="mx-auto w-full max-w-[1020px] px-4 py-10 sm:px-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className={SECTION_TITLE}>핵심 기능</h2>
              <p className="mt-1 text-[15px] text-app-muted">
                핵심만 정리한 경매 운영 포인트입니다.
              </p>
            </div>
            <span className={NEUTRAL_PILL}>바로 시작</span>
          </div>
          <div className="mt-5 grid gap-2.5 sm:grid-cols-3">
            {features.map((item) => (
              <article
                key={item.title}
                className="rounded-xl border border-app-border bg-app-elevated p-4"
              >
                <p className="text-[16px] font-semibold text-app-text">{item.title}</p>
                <p className="mt-1.5 text-[14px] leading-[21px] text-app-muted">{item.desc}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <div className="app-section-gap" />

      <section className="bg-app-bg">
        <div className="mx-auto w-full max-w-[1020px] px-4 py-10 sm:px-6">
          <h2 className={SECTION_TITLE}>4단계 운영 방식</h2>
          <ol className="mt-4 grid gap-2 sm:grid-cols-4">
            {steps.map((step, idx) => (
              <li
                key={step}
                className="flex items-center gap-3 rounded-xl border border-app-border bg-app-elevated px-4 py-3 sm:flex-col sm:items-start sm:gap-1"
              >
                <span className="text-[13px] font-semibold text-app-muted">
                  {idx + 1}단계
                </span>
                <span className="text-[16px] font-semibold text-app-text">{step}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <div className="app-section-gap" />

      <section className="bg-app-bg">
        <div className="mx-auto w-full max-w-[1020px] px-4 py-10 sm:px-6">
          <h2 className={SECTION_TITLE}>간단한 확인</h2>
          <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
            {faqs.map((faq) => (
              <article
                key={faq.q}
                className="rounded-xl border border-app-border bg-app-elevated px-4 py-3.5"
              >
                <p className="text-[16px] font-semibold text-app-text">{faq.q}</p>
                <p className="mt-1.5 text-[14px] leading-[21px] text-app-muted">{faq.a}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <div className="app-section-gap" />

      <section className="bg-app-bg">
        <div className="mx-auto w-full max-w-[1020px] px-4 pb-12 pt-10 sm:px-6">
          <h2 className={SECTION_TITLE}>경매 운영을 더 깔끔하게 바꿔보세요</h2>
          <p className="mt-2 max-w-2xl text-[15px] leading-[22px] text-app-muted">
            링크 하나로 경매를 등록하고, 운영하고, 낙찰을 정리할 수 있습니다.
          </p>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row">
            <Link href="/auth/login?next=%2Fauctions%2Fcreate" className={PRIMARY_CTA}>
              무료로 시작하기
            </Link>
            <Link href="/auctions/rules" className={SECONDARY_CTA}>
              운영 정책 보기
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
