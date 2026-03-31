"use client";

import Link from "next/link";

import Layout from "@components/features/MainLayout";
import { FOUNDING_BREEDER_LIMIT } from "@libs/shared/breeder-program";

const PROGRAM_CARDS = [
  {
    title: "창립 브리더",
    summary: "출시 후 신규 가입 선착순 100명 자동 부여",
    badge: "평생 경매 수수료 무료",
    frame: "골드 프레임",
    tone: "from-amber-50 via-white to-slate-50",
    border: "border-amber-200",
    text: "창립 멤버만 받을 수 있는 가장 높은 프레스티지 자격입니다.",
  },
  {
    title: "파트너 브리더",
    summary: "DM 섭외나 외부 협의를 거쳐 어드민에서 수동 설정",
    badge: "협업 할인",
    frame: "프리미엄 프레임",
    tone: "from-cyan-50 via-white to-slate-50",
    border: "border-cyan-200",
    text: "브랜드/브리더 협업용 등급으로, 개별 할인율을 운영자가 지정합니다.",
  },
  {
    title: "인증 브리더",
    summary: "나중에 본인 인증 플로우가 생기면 부여",
    badge: "신뢰 배지",
    frame: "실버 프레임",
    tone: "from-slate-50 via-white to-white",
    border: "border-slate-200",
    text: "본인 인증 기반의 신뢰 등급으로, 프로필 신뢰도를 올려줍니다.",
  },
];

type BreederProgramClientProps = {
  foundingBreederCount: number | null;
};

const BreederProgramClient = ({
  foundingBreederCount,
}: BreederProgramClientProps) => {
  const hasFoundingBreederCount = foundingBreederCount !== null;
  const remainingSlots = hasFoundingBreederCount
    ? Math.max(0, FOUNDING_BREEDER_LIMIT - foundingBreederCount)
    : null;
  const isSoldOut = remainingSlots === 0;

  return (
    <Layout canGoBack title="브리더 프로그램" seoTitle="브리더 프로그램">
      <div className="mx-auto max-w-3xl px-4 py-6">
        <article className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="relative overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(245,158,11,0.24),_transparent_34%),linear-gradient(135deg,#0f172a,#111827_56%,#1f2937)] px-5 py-6 text-white">
            <p className="text-[11px] font-black uppercase tracking-[0.22em] text-amber-300">
              breeder program
            </p>
            <h1 className="mt-2 text-2xl font-black tracking-tight">
              브리디의 브리더 프레스티지 프로그램
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/75">
              창립 브리더 100인, 파트너 브리더, 인증 브리더를 각각 다른 방식으로
              운영합니다. 프로필에는 프레임과 배지를 더해 신뢰와 희소성을 함께
              보여줍니다.
            </p>

            <div className="mt-4 flex flex-wrap gap-2">
              <span className="rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold text-white">
                {hasFoundingBreederCount
                  ? isSoldOut
                    ? "창립 브리더 100인 마감"
                    : `창립 브리더 잔여 ${remainingSlots}석`
                  : "창립 브리더 현황 집계 중"}
              </span>
              <span className="rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold text-white">
                평생 경매 수수료 무료
              </span>
              <span className="rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold text-white">
                프로필 전용 프레임
              </span>
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <Link
                href="/auth/login"
                className="inline-flex h-10 items-center justify-center rounded-full bg-white px-4 text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
              >
                로그인하러 가기
              </Link>
              <Link
                href="/support"
                className="inline-flex h-10 items-center justify-center rounded-full border border-white/20 px-4 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                문의 남기기
              </Link>
            </div>
          </div>

          <div className="space-y-4 p-5">
            <section className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <h2 className="text-base font-bold text-slate-900">
                프로필에서 보이는 것
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-700">
                브리더 자격이 있으면 프로필 사진에 전용 프레임이 붙고, 이름
                아래에 전용 뱃지가 노출됩니다. 창립 브리더는 번호까지 표시해
                희소성을 더하고, 파트너와 인증 브리더는 다른 색감으로 구분합니다.
              </p>
            </section>

            <div className="grid gap-3 md:grid-cols-3">
              {PROGRAM_CARDS.map((card) => (
                <section
                  key={card.title}
                  className={`rounded-2xl border ${card.border} bg-gradient-to-br ${card.tone} p-4 shadow-sm`}
                >
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                    {card.title}
                  </p>
                  <h3 className="mt-1 text-lg font-bold text-slate-900">
                    {card.badge}
                  </h3>
                  <p className="mt-1 text-xs font-semibold text-slate-500">
                    {card.summary}
                  </p>
                  <p className="mt-3 text-sm leading-relaxed text-slate-700">
                    {card.text}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 shadow-sm">
                      {card.frame}
                    </span>
                  </div>
                </section>
              ))}
            </div>

            <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm font-bold text-amber-900">
                창립 브리더 100인
              </p>
              <p className="mt-2 text-sm leading-relaxed text-amber-800">
                출시 이후 새로 가입한 유저 중 처음 100명만 자동 선정됩니다.
                선정된 계정은 평생 경매 수수료 무료 혜택을 받고, 프로필에서 가장
                강한 프레임과 뱃지를 받습니다.
              </p>
              <p className="mt-2 text-sm font-semibold text-amber-900">
                {hasFoundingBreederCount
                  ? isSoldOut
                    ? "현재 100인 모집이 마감되었습니다."
                    : `현재 ${foundingBreederCount}명 선정 · 잔여 ${remainingSlots}석`
                  : "현재 창립 브리더 현황을 확인하는 중입니다."}
              </p>
            </section>

            <section className="rounded-2xl border border-slate-200 p-4">
              <p className="text-sm font-bold text-slate-900">다음 단계</p>
              <p className="mt-2 text-sm leading-relaxed text-slate-700">
                창립 브리더는 자동 100명, 파트너 브리더는 어드민 수동 설정, 인증
                브리더는 추후 본인 인증 기능과 연결됩니다. 지금은 프로필과 로그인
                흐름에서 먼저 노출하고, 이후 수수료 시스템이 생기면 혜택만
                연결하면 됩니다.
              </p>
            </section>
          </div>
        </article>
      </div>
    </Layout>
  );
};

export default BreederProgramClient;
