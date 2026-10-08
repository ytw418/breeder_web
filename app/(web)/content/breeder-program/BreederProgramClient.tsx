"use client";

import Link from "next/link";

import Layout from "@components/features/MainLayout";
import { FOUNDING_BREEDER_LIMIT } from "@libs/shared/breeder-program";

// 앱 src/app/content/breeder-program.tsx 와 같은 구성(당근 톤, 중립 pill, 하단 CTA).

const PROFILE_FEATURES = [
  {
    title: "프레임",
    description: "프로필 사진 주변에 브리더 등급별 전용 프레임이 표시됩니다.",
  },
  {
    title: "배지",
    description:
      "이름 아래에서 창립·파트너·인증 브리더 여부를 바로 확인할 수 있습니다.",
  },
  {
    title: "혜택",
    description: "창립 브리더는 경매 수수료 혜택까지 계정에 함께 연결됩니다.",
  },
];

const PROGRAM_TIERS = [
  {
    title: "창립 브리더",
    label: "신규 가입 선착순",
    benefit: "평생 경매 수수료 무료",
    description: "처음 100명에게만 자동 부여되는 초기 멤버십입니다.",
  },
  {
    title: "파트너 브리더",
    label: "운영팀 선정",
    benefit: "협업 할인 혜택",
    description: "외부 협의나 브랜드 협업이 필요한 브리더에게 수동 부여됩니다.",
  },
  {
    title: "인증 브리더",
    label: "인증 플로우 예정",
    benefit: "신뢰 배지 제공",
    description: "본인 인증 기반으로 프로필 신뢰도를 높이는 등급입니다.",
  },
];

const CARD_CLASS = "rounded-xl border border-app-border bg-app-elevated p-4";

function Pill({ children }: { children: string }) {
  return (
    <span className="inline-flex self-start rounded-md bg-app-surface px-2 py-1 text-[12px] font-semibold text-app-muted">
      {children}
    </span>
  );
}

function SectionTitle({ children }: { children: string }) {
  return (
    <h2 className="mb-3 text-[17px] font-bold text-app-text">{children}</h2>
  );
}

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
  const selectedFoundingCount = foundingBreederCount ?? 0;
  const foundingStatusLabel = hasFoundingBreederCount
    ? isSoldOut
      ? "창립 브리더 100인 마감"
      : `창립 브리더 잔여 ${remainingSlots}석`
    : "창립 브리더 현황 집계 중";
  const foundingCountLabel = hasFoundingBreederCount
    ? `${selectedFoundingCount}/${FOUNDING_BREEDER_LIMIT}`
    : "--/100";
  const remainingSlotLabel = hasFoundingBreederCount
    ? isSoldOut
      ? "마감"
      : `${remainingSlots}석`
    : "집계 중";
  const foundingProgressPercent = hasFoundingBreederCount
    ? Math.min(
        100,
        Math.max(0, (selectedFoundingCount / FOUNDING_BREEDER_LIMIT) * 100),
      )
    : 0;

  return (
    <Layout canGoBack title="브리더 프로그램" seoTitle="브리더 프로그램">
      <main className="min-h-full bg-app-bg px-4 pb-10 pt-4">
        {/* 소개 */}
        <h1 className="text-[22px] font-bold text-app-text">
          브리더라면, 프로필부터 다르게
        </h1>
        <p className="mt-2.5 text-[16px] leading-6 text-app-muted">
          브리더 프로그램은 좋은 분양 이력을 더 잘 보이게 만드는 멤버십입니다.
          처음 100명에게는 전용 프레임과 평생 경매 수수료 0원 혜택을 함께
          제공합니다.
        </p>
        <div className="mt-3 flex">
          <Pill>{foundingStatusLabel}</Pill>
        </div>

        {/* 창립 브리더 현황 */}
        <section className={`${CARD_CLASS} mt-5`} aria-label="창립 브리더 현황">
          <div className="flex items-center justify-between">
            <span className="text-[16px] text-app-muted">선정 현황</span>
            <span className="text-[16px] font-bold text-app-text">
              {foundingCountLabel}
            </span>
          </div>
          <div
            className="mt-3 h-1.5 overflow-hidden rounded-[3px] bg-app-surface"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={FOUNDING_BREEDER_LIMIT}
            aria-valuenow={selectedFoundingCount}
          >
            <div
              className="h-1.5 rounded-[3px] bg-app-brand"
              style={{ width: `${foundingProgressPercent}%` }}
            />
          </div>
          <div className="mt-3 flex items-center justify-between">
            <span className="text-[16px] text-app-muted">남은 자리</span>
            <span className="text-[16px] font-bold text-app-text">
              {remainingSlotLabel}
            </span>
          </div>
        </section>

        {/* 프로필 혜택 */}
        <section className="mt-7">
          <SectionTitle>프로필에서 바로 보이는 혜택</SectionTitle>
          <ul className={CARD_CLASS}>
            {PROFILE_FEATURES.map((feature, index) => {
              const isLast = index === PROFILE_FEATURES.length - 1;
              return (
                <li
                  key={feature.title}
                  className={`${index === 0 ? "" : "pt-3.5"} ${
                    isLast ? "" : "border-b border-app-line pb-3.5"
                  }`}
                >
                  <h3 className="text-[16px] font-semibold text-app-text">
                    {feature.title}
                  </h3>
                  <p className="mt-1 text-[16px] leading-6 text-app-muted">
                    {feature.description}
                  </p>
                </li>
              );
            })}
          </ul>
        </section>

        {/* 등급 */}
        <section className="mt-7">
          <SectionTitle>등급은 이렇게 나뉩니다</SectionTitle>
          <p className="-mt-1 mb-3 text-[16px] leading-6 text-app-muted">
            자동 선정, 운영팀 선정, 인증 기반 등급을 분리해 프로필 신뢰도를
            단계적으로 보여줍니다.
          </p>
          <div className="flex flex-col gap-2.5">
            {PROGRAM_TIERS.map((tier) => (
              <div key={tier.title} className={CARD_CLASS}>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-[16px] font-semibold text-app-text">
                    {tier.title}
                  </h3>
                  <Pill>{tier.label}</Pill>
                </div>
                <p className="mt-2 text-[16px] font-semibold leading-6 text-app-text">
                  {tier.benefit}
                </p>
                <p className="mt-0.5 text-[16px] leading-6 text-app-muted">
                  {tier.description}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* 창립 브리더 안내 */}
        <section className="mt-7">
          <SectionTitle>처음 100명에게만 평생 수수료 0원</SectionTitle>
          <p className="text-[16px] leading-6 text-app-text">
            {`출시 이후 새로 가입한 유저 중 처음 ${FOUNDING_BREEDER_LIMIT}명만 자동 선정됩니다. 선정된 계정은 프로필에서 가장 강한 프레임과 배지를 받습니다.`}
          </p>
        </section>

        {/* CTA */}
        <Link
          href="/auth/login"
          className="mt-6 flex h-[52px] items-center justify-center rounded-md bg-app-brand text-[16px] font-semibold text-white"
        >
          지금 시작하기
        </Link>
        <Link
          href="/support"
          className="mt-2 flex h-[52px] items-center justify-center rounded-md bg-app-surface text-[16px] font-semibold text-app-text"
        >
          문의하기
        </Link>
      </main>
    </Layout>
  );
};

export default BreederProgramClient;
