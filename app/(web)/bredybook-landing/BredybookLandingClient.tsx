"use client";

import Link from "next/link";
import Layout from "@components/features/MainLayout";

// 플랫 토큰(design/mockups/REFERENCE.md): 그라데이션·글로우·blur·영문 장식 라벨 없음, 주황은 주 CTA 에만.

const FEATURES = [
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
];

const PRIMARY_CTA =
  "inline-flex h-[52px] items-center justify-center rounded-md bg-app-brand px-6 text-[16px] font-semibold text-white";
const SECONDARY_CTA =
  "inline-flex h-[52px] items-center justify-center rounded-md bg-app-surface px-6 text-[16px] font-semibold text-app-text";

export default function BredybookLandingClient() {
  return (
    <Layout title="브리디북" seoTitle="브리디북" icon>
      <div className="min-h-full bg-app-bg">
        <section className="mx-auto max-w-5xl px-4 pb-8 pt-6">
          <span className="inline-flex rounded-md bg-app-surface px-2 py-1 text-[12px] font-semibold text-app-muted">
            브리디북 공식 기록
          </span>

          <h1 className="mt-4 text-[24px] font-bold leading-[1.3] text-app-text sm:text-[28px]">
            당신의 브리딩 실력을 기록하세요
          </h1>
          <p className="mt-3 max-w-2xl text-[16px] leading-6 text-app-sub">
            이제 더이상 카더라 기네스는 그만. 당신의 기록을 새로운 스탠다드로
            정의해서 기록하고 증명하세요.
          </p>

          <div className="mt-6 flex flex-col gap-2 sm:flex-row">
            <Link href="/guinness/apply" className={PRIMARY_CTA}>
              브리디북 기록하러 가기
            </Link>
            <Link href="/guinness" className={SECONDARY_CTA}>
              브리디북 기록 보기
            </Link>
            <Link
              href="/"
              className="inline-flex h-11 items-center justify-center px-4 text-[14px] text-app-muted"
            >
              브리디 서비스 구경하기
            </Link>
          </div>
        </section>

        <div className="app-section-gap" />

        <section className="mx-auto max-w-5xl px-4 py-7">
          <ul className="grid gap-2.5 sm:grid-cols-3">
            {FEATURES.map((item) => (
              <li
                key={item.title}
                className="rounded-xl border border-app-border bg-app-elevated p-4"
              >
                <h3 className="text-[16px] font-semibold text-app-text">
                  {item.title}
                </h3>
                <p className="mt-1 text-[14px] leading-[21px] text-app-muted">
                  {item.body}
                </p>
              </li>
            ))}
          </ul>
        </section>

        <div className="app-section-gap" />

        <section className="mx-auto max-w-5xl px-4 pb-12 pt-7">
          <h2 className="text-[17px] font-bold text-app-text">
            당신의 기록이 기준이 됩니다
          </h2>
          <p className="mt-1.5 text-[15px] leading-[22px] text-app-muted">
            측정 기록을 남기고, 브리디북에서 공식 인증을 받아보세요.
          </p>
          <Link
            href="/guinness/apply"
            className={`${SECONDARY_CTA} mt-4 w-full sm:w-auto`}
          >
            지금 기록 등록
          </Link>
        </section>
      </div>
    </Layout>
  );
}
