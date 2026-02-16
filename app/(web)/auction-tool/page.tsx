import type { Metadata } from "next";
import Link from "next/link";
import { buttonVariants } from "@components/ui/button";

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
    label: "운영 시간",
    value: "-60%",
    desc: "수기 댓글 정리 감소",
  },
  {
    label: "분쟁 감소",
    value: "-70%",
    desc: "마감 임박 분쟁 완화",
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

export default function AuctionToolLandingPage() {
  return (
    <div className="app-page">
      <section className="app-section app-reveal border-b border-slate-100 bg-gradient-to-br from-white via-white to-rose-50/45 relative overflow-hidden">
        <div className="pointer-events-none absolute inset-x-0 -mt-12 h-32">
          <div className="mx-auto h-full w-[620px] rounded-full bg-[hsl(var(--accent))]/8 blur-3xl" />
        </div>
        <div className="mx-auto flex w-full max-w-[1020px] flex-col gap-8 px-4 py-10 sm:px-6 sm:py-12 lg:flex-row lg:items-end lg:justify-between lg:gap-10">
          <div className="max-w-[560px]">
            <p className="app-kicker">Bredy Auction Tool</p>
            <h1 className="mt-2 app-title-xl text-slate-900 dark:text-slate-50">
              링크 하나로 시작하는 경매 운영
            </h1>
            <p className="mt-4 app-body-md text-slate-600 dark:text-slate-300">
              카페와 밴드로 흩어진 경매 글을 하나의 흐름으로 묶어 입찰·마감·신고 운영까지
              한 번에 정리합니다.
            </p>
            <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-[hsl(var(--accent))]/10 px-3 py-1 text-[11px] font-semibold text-[hsl(var(--accent))]">
              30초로 시작, 실시간 운영까지
            </div>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/auth/login?next=%2Fauctions%2Fcreate"
                className={buttonVariants({
                  className:
                    "h-11 rounded-xl text-sm font-semibold bg-[hsl(var(--accent))] text-white hover:bg-[#ef6f2a] sm:min-w-[200px] sm:w-auto",
                })}
              >
                시작하기
              </Link>
              <Link
                href="/auctions"
                className={buttonVariants({
                  variant: "outline",
                  className:
                    "h-11 rounded-xl border-slate-300 text-sm font-semibold text-slate-700 hover:bg-[hsl(var(--accent))]/10 hover:border-[hsl(var(--accent))] sm:min-w-[200px] sm:w-auto",
                })}
              >
                진행중 경매 보기
              </Link>
            </div>
          </div>

          <div className="w-full max-w-[380px] space-y-2">
            <div className="relative rounded-xl border border-slate-200 bg-white overflow-hidden">
              <span className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-[hsl(var(--accent))] to-[#ffad58]" />
              {quickStats.map((item, idx) => (
                <article
                  key={item.label}
                  className={`pl-4 pr-4 py-3 ${idx === 0 ? "" : "border-t border-slate-100"}`}
                >
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
                    {item.label}
                  </p>
                  <p className="mt-1 text-2xl font-semibold text-slate-900 dark:text-slate-100">
                    {item.value}
                  </p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {item.desc}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="app-section app-reveal app-reveal-1 border-b border-slate-100 bg-slate-50/70">
        <div className="mx-auto w-full max-w-[1020px] px-4 py-10 sm:px-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 sm:text-3xl">
                핵심 기능
              </h2>
              <p className="mt-1 app-body-md text-slate-600 dark:text-slate-300">
                핵심만 정리한 경매 운영 포인트입니다.
              </p>
            </div>
            <span className="inline-flex shrink-0 rounded-full bg-[hsl(var(--accent))]/10 px-2 py-1 text-[11px] font-semibold text-[hsl(var(--accent))]">
              바로 시작
            </span>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {features.map((item) => (
              <article
                key={item.title}
                className="app-card p-4 border-slate-200 bg-white"
              >
                <span className="mb-2 inline-flex h-1.5 w-10 rounded-full bg-[hsl(var(--accent))]" />
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {item.title}
                </p>
                <p className="mt-2 app-body-sm text-slate-600 dark:text-slate-300">
                  {item.desc}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="app-section app-reveal app-reveal-2 border-b border-slate-100 bg-white">
        <div className="mx-auto w-full max-w-[1020px] px-4 py-10 sm:px-6">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 sm:text-3xl">
            4단계 운영 방식
          </h2>
          <div className="mt-4 grid gap-2 sm:grid-cols-4">
            {steps.map((step, idx) => (
              <div key={step} className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  Step {idx + 1}
                </p>
                <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {step}
                </p>
                <div className="mt-2 h-1 rounded-full bg-gradient-to-r from-[hsl(var(--accent))]/0 via-[hsl(var(--accent))] to-[hsl(var(--accent))]/0" />
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="app-section app-reveal app-reveal-3 bg-slate-50/70 border-b border-slate-100">
        <div className="mx-auto w-full max-w-[1020px] px-4 py-10 sm:px-6">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 sm:text-3xl">
            간단한 확인
          </h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {faqs.map((faq) => (
              <article
                key={faq.q}
                className="rounded-lg border border-slate-200 bg-white px-4 py-3"
              >
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[hsl(var(--accent))]/15 text-[11px] font-bold text-[hsl(var(--accent))]">
                  Q
                </span>
                <p className="text-[15px] font-semibold text-slate-900 dark:text-slate-100">
                  {faq.q}
                </p>
                <p className="mt-2 app-body-sm text-slate-600 dark:text-slate-300">
                  {faq.a}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="app-section app-reveal">
        <div className="mx-auto w-full max-w-[1020px] px-4 py-10 sm:px-6">
          <p className="app-kicker">마지막 한 번</p>
          <h3 className="mt-2 text-2xl font-semibold leading-tight text-slate-900 sm:text-3xl dark:text-slate-100">
            경매 운영을 더 깔끔하게 바꿔보세요.
          </h3>
          <p className="mt-2 max-w-2xl text-sm text-slate-600 dark:text-slate-300 sm:text-base">
            링크 하나로 경매를 등록하고, 운영하고, 낙찰을 정리할 수 있습니다.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/auth/login?next=%2Fauctions%2Fcreate"
              className={buttonVariants({
                className:
                  "h-11 rounded-xl text-sm font-semibold bg-[hsl(var(--accent))] text-white hover:bg-[#ef6f2a]",
              })}
            >
              무료로 시작하기
            </Link>
            <Link
              href="/auctions/rules"
              className={buttonVariants({
                variant: "outline",
                className:
                  "h-11 rounded-xl border-slate-300 text-sm font-semibold text-slate-700 hover:bg-slate-50",
              })}
            >
              운영 정책 보기
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
