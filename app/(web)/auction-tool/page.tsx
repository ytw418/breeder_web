import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "링크형 경매도구",
  description:
    "카페/밴드/오픈채팅에서 링크 하나로 바로 참여하는 경매도구. 카카오 로그인, 자동 연장, 신고/제재 처리, 판매자 신뢰 정보 공개를 한 번에 제공합니다.",
  openGraph: {
    title: "브리디 경매도구 | 30초면 만드는 경매 도구",
    description:
      "30초면 만드는 경매 도구를 활용해보세요. 카카오 로그인 기반 참여, 자동 연장, 신고/제재 처리까지.",
    type: "website",
    images: [
      {
        url: "/auction-tool/opengraph-image",
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
      "30초면 만드는 경매 도구를 활용해보세요. 카카오 로그인 기반 참여, 자동 연장, 신고/제재 처리까지.",
    images: ["/auction-tool/twitter-image"],
  },
};

const quickWins = [
  {
    label: "경매 생성 소요",
    value: "30초",
    desc: "상품 정보 입력 후 링크 즉시 발급",
  },
  {
    label: "운영 시간 절감",
    value: "2.3x",
    desc: "수기 댓글 정리 대비",
  },
  {
    label: "마감 공정성",
    value: "자동 연장",
    desc: "종료 임박 입찰 자동 반영",
  },
  {
    label: "계정 신뢰",
    value: "카카오 기반",
    desc: "부정행위 시 재참여 제한",
  },
];

const betaMetrics = [
  {
    label: "입찰 형식 오류",
    value: "-78%",
    desc: "호가 단위 검증 적용 후 감소",
  },
  {
    label: "마감 직전 분쟁",
    value: "-61%",
    desc: "자동 연장 정책 적용 기준",
  },
  {
    label: "경매 완료율",
    value: "96.2%",
    desc: "베타 운영 경매 중 정상 종료 비율",
  },
  {
    label: "평균 운영 시간",
    value: "18분",
    desc: "생성부터 낙찰 확정까지 운영자 개입 시간",
  },
];

const painToSolution = [
  {
    pain: "댓글로 금액 수기 입력",
    solution: "검증된 입찰 입력으로 오해 없는 로그",
    impact: "입찰 실수/해석 분쟁 감소",
  },
  {
    pain: "마감 직전 눈치싸움",
    solution: "종료 임박 자동 연장으로 공정성 확보",
    impact: "시간차 입찰 논란 최소화",
  },
  {
    pain: "신고 이후 처리 불투명",
    solution: "관리자 처리 상태/제재 결과를 명시",
    impact: "운영 신뢰도 상승",
  },
  {
    pain: "판매자 신뢰정보 분산",
    solution: "블로그/연락처/커뮤니티 닉을 경매 글에서 공개",
    impact: "거래 전 검증 시간 단축",
  },
];

const flowSteps = [
  {
    title: "1. 경매 생성",
    body: "상품 정보, 시작가, 최소 호가, 종료 시각만 입력하면 링크가 즉시 생성됩니다.",
  },
  {
    title: "2. 링크 공유",
    body: "카페·밴드·오픈채팅에 URL만 올리면 참여자가 같은 화면에서 바로 입찰합니다.",
  },
  {
    title: "3. 자동 운영",
    body: "순위 갱신, 자동 연장, 신고 처리, 낙찰 확정까지 운영 흐름을 한 화면에서 관리합니다.",
  },
];

const trustRules = [
  "카카오 로그인 계정 기반으로 참여 기록 추적",
  "부정행위/사기 신고 처리 시 계정 제재 및 재참여 제한",
  "판매자 연락처/이메일/블로그/카페닉/밴드닉 선택 공개",
  "신고된 경매 상태를 사용자와 관리자 모두에게 명시",
];

const faqs = [
  {
    q: "카페나 밴드를 대체해야 하나요?",
    a: "대체가 아니라 보완입니다. 기존 커뮤니티에 경매 링크를 공유하고, 입찰/마감/신고 처리만 도구에서 진행합니다.",
  },
  {
    q: "앱 설치가 필요한가요?",
    a: "아닙니다. 모바일 웹에서 바로 참여합니다. 로그인만 완료하면 즉시 입찰/등록 가능합니다.",
  },
  {
    q: "사기/부정행위가 발생하면 어떻게 되나요?",
    a: "신고 접수 후 관리자 처리 결과를 상태로 공개하고, 정책 위반 계정은 참여 제한 또는 영구 정지 처리됩니다.",
  },
  {
    q: "알림톡은 지원하나요?",
    a: "현재는 핵심 경매 흐름을 우선 제공하며, 알림톡은 확장 가능한 구조로 설계되어 단계적으로 적용 예정입니다.",
  },
];

export default function AuctionToolLandingPage() {
  return (
    <div className="min-h-screen bg-white">
      <section className="relative overflow-hidden bg-gradient-to-br from-[#0b1327] via-[#162446] to-[#1d4ed8] text-white">
        <div className="pointer-events-none absolute -left-14 top-6 h-52 w-52 rounded-full bg-sky-300/20 blur-3xl" />
        <div className="pointer-events-none absolute -right-12 bottom-[-46px] h-60 w-60 rounded-full bg-emerald-300/15 blur-3xl" />

        <div className="relative mx-auto w-full max-w-[1020px] px-4 pb-9 pt-6 sm:px-6 sm:pb-12 sm:pt-9">
          <div className="app-reveal">
            <h1 className="mt-6 text-[34px] font-black leading-tight tracking-[-0.03em] sm:text-[54px]">
              링크 하나로
              <br />
              공정한 경매 운영을 시작하세요
            </h1>
            <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-slate-200 sm:text-[19px]">
              카페/밴드/오픈채팅은 그대로 유지하고, 입찰과 마감, 신고 처리만 표준화합니다.
              가입 장벽은 낮고 운영 신뢰는 높은 경매 전용 경험입니다.
            </p>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/auth/login?next=%2Fauctions%2Fcreate"
                className="inline-flex h-16 w-full items-center justify-center rounded-2xl bg-[#fee500] px-7 text-[18px] font-black text-[#191919] shadow-[0_12px_30px_rgba(250,225,0,0.35)] transition hover:brightness-95 sm:h-[64px] sm:w-auto sm:min-w-[280px] sm:text-[20px]"
              >
                카카오 계정으로 시작하기
              </Link>
              <Link
                href="/auctions"
                className="inline-flex h-16 w-full items-center justify-center rounded-2xl border border-white/30 bg-white/10 px-7 text-[18px] font-bold text-white transition hover:bg-white/15 sm:h-[64px] sm:w-auto sm:min-w-[240px] sm:text-[20px]"
              >
                진행중 경매 보기
              </Link>
            </div>

            <div className="mt-3 inline-flex items-center rounded-lg bg-white/10 px-3 py-1.5 text-[12px] text-slate-200">
              로그인 완료 후 경매 등록 화면으로 자동 이동합니다.
            </div>

            <div className="mt-7 grid gap-2.5 sm:grid-cols-4">
              {quickWins.map((item) => (
                <article
                  key={item.label}
                  className="rounded-xl border border-white/20 bg-white/10 px-4 py-3"
                >
                  <p className="text-[11px] text-slate-200">{item.label}</p>
                  <p className="mt-1 text-[20px] font-black">{item.value}</p>
                  <p className="text-[11px] text-slate-200/90">{item.desc}</p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-slate-200 bg-white">
        <div className="mx-auto w-full max-w-[1020px] px-4 py-8 sm:px-6 sm:py-10">
          <div className="app-reveal app-reveal-1">
            <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-[23px] font-black tracking-[-0.02em] text-slate-900 sm:text-[30px]">
                  베타 운영 지표
                </h2>
                <p className="text-[12px] text-slate-500">
                  최근 30일 내부 운영 샘플 기준 (n=47)
                </p>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {betaMetrics.map((metric) => (
                  <article key={metric.label} className="rounded-xl border border-slate-200 bg-white p-3.5">
                    <p className="text-[11px] font-semibold text-slate-500">{metric.label}</p>
                    <p className="mt-1 text-[24px] font-black text-slate-900">{metric.value}</p>
                    <p className="mt-1 text-[12px] leading-relaxed text-slate-600">{metric.desc}</p>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-slate-200 bg-[#f8fafc]">
        <div className="mx-auto w-full max-w-[1020px] px-4 py-8 sm:px-6 sm:py-10">
          <div className="app-reveal app-reveal-2">
            <h2 className="text-[26px] font-black tracking-[-0.02em] text-slate-900 sm:text-[34px]">
              주먹구구 경매의 약점을
              <br />
              구조적으로 커버합니다
            </h2>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {painToSolution.map((item) => (
                <article key={item.pain} className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                    기존 방식
                  </p>
                  <p className="mt-1 text-[17px] font-black text-slate-900">{item.pain}</p>
                  <p className="mt-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#2563eb]">
                    도구 개선
                  </p>
                  <p className="mt-1 text-[14px] font-semibold leading-relaxed text-slate-700">
                    {item.solution}
                  </p>
                  <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-[12px] font-medium text-slate-600">
                    효과: {item.impact}
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-slate-200 bg-white">
        <div className="mx-auto w-full max-w-[1020px] px-4 py-8 sm:px-6 sm:py-10">
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="app-reveal app-reveal-2 rounded-2xl border border-slate-200 bg-slate-50/70 p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                TRUST SYSTEM
              </p>
              <h3 className="mt-2 text-[24px] font-black tracking-[-0.02em] text-slate-900">
                신뢰 장치
              </h3>
              <ul className="mt-4 space-y-2 text-[14px] text-slate-700">
                {trustRules.map((rule) => (
                  <li key={rule}>• {rule}</li>
                ))}
              </ul>
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-[12px] leading-relaxed text-amber-900">
                신고 처리 시 관리자 승인 액션과 결과 상태가 남아, 운영 근거를 명확히 기록할 수 있습니다.
              </div>
            </div>

            <div className="app-reveal app-reveal-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                OPERATION FLOW
              </p>
              <h3 className="mt-2 text-[24px] font-black tracking-[-0.02em] text-slate-900">
                실제 운영 흐름
              </h3>
              <div className="mt-4 space-y-3">
                {flowSteps.map((step) => (
                  <article key={step.title} className="rounded-xl border border-slate-200 bg-white p-3">
                    <p className="text-sm font-bold text-slate-900">{step.title}</p>
                    <p className="mt-1 text-[13px] leading-relaxed text-slate-600">{step.body}</p>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-slate-200 bg-[#f8fafc]">
        <div className="mx-auto w-full max-w-[1020px] px-4 py-8 sm:px-6 sm:py-10">
          <div className="app-reveal app-reveal-3">
            <h2 className="text-[24px] font-black tracking-[-0.02em] text-slate-900 sm:text-[30px]">
              자주 묻는 질문
            </h2>
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {faqs.map((faq) => (
                <article key={faq.q} className="rounded-xl border border-slate-200 bg-white p-4">
                  <p className="text-[14px] font-bold text-slate-900">{faq.q}</p>
                  <p className="mt-2 text-[13px] leading-relaxed text-slate-600">{faq.a}</p>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="border-t border-slate-200 bg-[#0f172a] text-white">
        <div className="mx-auto w-full max-w-[1020px] px-4 py-8 sm:px-6 sm:py-12">
          <div className="app-reveal app-reveal-fade">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-200/90">
              SHARE FIRST STRATEGY
            </p>
            <h2 className="mt-3 text-[28px] font-black leading-tight tracking-[-0.02em] sm:text-[38px]">
              커뮤니티를 바꾸지 말고
              <br />
              경매 경험만 업그레이드하세요
            </h2>
            <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-slate-200">
              링크 공유형 도구로 사용성을 먼저 확보하고, 이후 알림/자동화 기능을 단계적으로 확장하는 성장 시나리오에 맞춰 설계했습니다.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Link
                href="/auth/login?next=%2Fauctions%2Fcreate"
                className="inline-flex h-12 items-center justify-center rounded-xl bg-[#fee500] px-5 text-sm font-black text-[#191919] transition hover:brightness-95"
              >
                카카오 로그인 후 경매 등록
              </Link>
              <Link
                href="/auctions/rules"
                className="inline-flex h-12 items-center justify-center rounded-xl border border-white/30 bg-white/10 px-5 text-sm font-bold text-white transition hover:bg-white/15"
              >
                운영 정책 확인
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
