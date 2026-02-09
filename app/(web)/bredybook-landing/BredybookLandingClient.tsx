"use client";

import Link from "next/link";
import Layout from "@components/features/MainLayout";

export default function BredybookLandingClient() {
  return (
    <Layout title="브리디북" seoTitle="브리디북" icon>
      <div className="relative overflow-hidden bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-white">
        <div className="pointer-events-none absolute -top-24 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-amber-400/30 blur-3xl" />
        <div className="pointer-events-none absolute -right-20 top-48 h-80 w-80 rounded-full bg-emerald-400/20 blur-3xl" />
        <div className="pointer-events-none absolute -left-24 top-80 h-96 w-96 rounded-full bg-orange-500/10 blur-[120px]" />

        <section className="relative mx-auto max-w-5xl px-6 pb-16 pt-14">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-white/80">
            Bredybook
            <span className="h-1 w-1 rounded-full bg-amber-300" />
            Official Records
          </div>

          <h1 className="mt-6 text-3xl font-bold leading-tight sm:text-4xl">
            당신의 브리딩 실력을 기록하세요!
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-slate-200 sm:text-lg">
            이제 더이상 카더라 기네스는 그만.
            당신의 기록을 새로운 스탠다드로 정의해서 기록하고 증명하세요.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/guinness/apply"
              className="inline-flex h-12 items-center justify-center rounded-xl bg-amber-400 px-6 text-sm font-semibold text-slate-950 shadow-lg shadow-amber-400/30 transition hover:translate-y-[-1px]"
            >
              브리디북 기록하러 가기
            </Link>
            <Link
              href="/guinness"
              className="inline-flex h-12 items-center justify-center rounded-xl border border-white/20 bg-white/5 px-6 text-sm font-semibold text-white/90 transition hover:bg-white/10"
            >
              브리디북 기록 보기
            </Link>
            <Link
              href="/"
              className="inline-flex h-12 items-center justify-center rounded-xl border border-white/15 bg-white/5 px-6 text-sm font-semibold text-white/90 transition hover:bg-white/10"
            >
              브리디 서비스 구경하기
            </Link>
          </div>

          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            {[
              {
                title: "공식 검증 프로세스",
                body: "사진/측정 기준을 통과한 기록만 브리디북에 등록됩니다.",
              },
              {
                title: "종별 체장 랭킹",
                body: "종마다 최고 기록을 명확히 보여줘 비교가 쉬워집니다.",
              },
              {
                title: "신뢰 가능한 증명",
                body: "브리디의 명성을 숫자로 쌓고, 기록으로 증명합니다.",
              },
            ].map((item) => (
              <div
                key={item.title}
                className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur"
              >
                <h3 className="text-base font-semibold text-white">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-200">
                  {item.body}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="relative mx-auto max-w-5xl px-6 pb-20">
          <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-white/10 to-white/5 p-6 sm:p-8">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-200/90">
                  New Standard
                </p>
                <h2 className="mt-3 text-2xl font-bold text-white">
                  당신의 기록이 기준이 됩니다
                </h2>
                <p className="mt-2 text-sm text-slate-200">
                  측정 기록을 남기고, 브리디북에서 공식 인증을 받아보세요.
                </p>
              </div>
              <Link
                href="/guinness/apply"
                className="inline-flex h-12 items-center justify-center rounded-xl bg-white px-6 text-sm font-semibold text-slate-950"
              >
                지금 기록 등록
              </Link>
            </div>
          </div>
        </section>
      </div>
    </Layout>
  );
}
