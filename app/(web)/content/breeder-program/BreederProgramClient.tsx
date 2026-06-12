"use client";

import Link from "next/link";

import Layout from "@components/features/MainLayout";
import { FOUNDING_BREEDER_LIMIT } from "@libs/shared/breeder-program";

const HERO_POINTS = [
  { value: "0원", label: "경매 수수료" },
  { value: "전용", label: "프로필 프레임" },
  { value: "배지", label: "등급 노출" },
];

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
    markerClassName: "bg-primary",
    panelClassName: "border-primary/20 bg-primary/5",
    labelClassName: "bg-white text-primary",
  },
  {
    title: "파트너 브리더",
    label: "운영팀 선정",
    benefit: "협업 할인 혜택",
    description: "외부 협의나 브랜드 협업이 필요한 브리더에게 수동 부여됩니다.",
    markerClassName: "bg-slate-900",
    panelClassName: "border-slate-200 bg-white",
    labelClassName: "bg-slate-100 text-slate-700",
  },
  {
    title: "인증 브리더",
    label: "인증 플로우 예정",
    benefit: "신뢰 배지 제공",
    description: "본인 인증 기반으로 프로필 신뢰도를 높이는 등급입니다.",
    markerClassName: "bg-slate-400",
    panelClassName: "border-slate-200 bg-white",
    labelClassName: "bg-slate-100 text-slate-700",
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
      <main className="tracking-normal text-slate-950">
        <section className="bg-white px-5 pb-7 pt-6">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-bold text-primary">브리디 브리더 클럽</p>
            <span className="rounded-md bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-600">
              {foundingStatusLabel}
            </span>
          </div>

          <h1 className="mt-5 text-[30px] font-extrabold leading-[1.18] tracking-normal text-slate-950">
            브리더라면,
            <br />
            프로필부터 다르게.
          </h1>
          <p className="mt-3 text-[15px] font-medium leading-[1.65] tracking-normal text-slate-600">
            브리더 프로그램은 좋은 분양 이력을 더 잘 보이게 만드는 멤버십입니다.
            처음 100명에게는 전용 프레임과 평생 경매 수수료 0원 혜택을 함께
            제공합니다.
          </p>

          <div className="mt-5 grid grid-cols-3 overflow-hidden rounded-lg border border-slate-200 bg-white">
            {HERO_POINTS.map((point) => (
              <div
                key={point.label}
                className="border-r border-slate-100 px-3 py-3 text-center last:border-r-0"
              >
                <p className="text-[16px] font-black leading-none tracking-normal text-slate-950">
                  {point.value}
                </p>
                <p className="mt-1.5 text-[10px] font-semibold leading-[1.3] tracking-normal text-slate-500">
                  {point.label}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-5 flex gap-2">
            <Link
              href="/auth/login"
              className="inline-flex h-11 flex-1 items-center justify-center rounded-lg bg-slate-950 px-4 text-sm font-bold text-white transition hover:bg-slate-800"
            >
              로그인하고 확인
            </Link>
            <Link
              href="/support"
              className="inline-flex h-11 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
            >
              문의
            </Link>
          </div>
        </section>

        <section className="px-5 pb-7">
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-950 text-white shadow-sm">
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
              <span className="text-xs font-semibold text-white/70">
                프로필 미리보기
              </span>
              <span className="rounded-md bg-primary px-2 py-1 text-[11px] font-bold text-white">
                창립
              </span>
            </div>

            <div className="px-4 py-5">
              <div className="flex items-center gap-4">
                <div className="grid h-[76px] w-[76px] shrink-0 place-items-center rounded-xl bg-primary p-1">
                  <div className="grid h-full w-full place-items-center rounded-lg bg-white text-xl font-black text-slate-950">
                    B
                  </div>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-lg font-extrabold tracking-normal">
                    브리디 켄넬
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <span className="rounded-md bg-white px-2 py-1 text-[11px] font-bold text-slate-950">
                      창립 브리더 No.001
                    </span>
                    <span className="rounded-md bg-white/10 px-2 py-1 text-[11px] font-semibold text-white/80">
                      수수료 0원
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-5 h-1.5 overflow-hidden rounded-sm bg-white/10">
                <div
                  className="h-full rounded-sm bg-primary"
                  style={{ width: `${foundingProgressPercent}%` }}
                />
              </div>

              <div className="mt-5 grid grid-cols-2 gap-2">
                <div className="rounded-lg bg-white/10 px-3 py-3">
                  <p className="text-[11px] font-semibold text-white/55">
                    선정 현황
                  </p>
                  <p className="mt-1 text-xl font-black tracking-normal">
                    {foundingCountLabel}
                  </p>
                </div>
                <div className="rounded-lg bg-white/10 px-3 py-3">
                  <p className="text-[11px] font-semibold text-white/55">
                    남은 자리
                  </p>
                  <p className="mt-1 text-xl font-black tracking-normal">
                    {remainingSlotLabel}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-y border-slate-100 bg-slate-50 px-5 py-7">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-xs font-bold text-primary">혜택</p>
              <h2 className="mt-2 text-xl font-extrabold tracking-normal text-slate-950">
                프로필에서 바로 보이는 혜택
              </h2>
            </div>
            <span className="text-xs font-semibold text-slate-400">3가지</span>
          </div>

          <ul className="mt-5 divide-y divide-slate-200 border-y border-slate-200">
            {PROFILE_FEATURES.map((feature, index) => (
              <li key={feature.title} className="flex gap-3 py-4">
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-white text-xs font-black text-primary ring-1 ring-slate-200">
                  {index + 1}
                </span>
                <div>
                  <h3 className="text-sm font-bold tracking-normal text-slate-950">
                    {feature.title}
                  </h3>
                  <p className="mt-1 text-sm font-medium leading-[1.55] tracking-normal text-slate-600">
                    {feature.description}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="bg-white px-5 py-7">
          <p className="text-xs font-bold text-primary">멤버십</p>
          <h2 className="mt-2 text-xl font-extrabold tracking-normal text-slate-950">
            등급은 이렇게 나뉩니다
          </h2>
          <p className="mt-2 text-sm font-medium leading-[1.6] tracking-normal text-slate-500">
            자동 선정, 운영팀 선정, 인증 기반 등급을 분리해 프로필 신뢰도를
            단계적으로 보여줍니다.
          </p>

          <div className="mt-5 space-y-3">
            {PROGRAM_TIERS.map((tier) => (
              <section
                key={tier.title}
                className={`rounded-lg border p-4 ${tier.panelClassName}`}
              >
                <div className="flex items-start gap-3">
                  <span
                    className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-sm ${tier.markerClassName}`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-extrabold tracking-normal text-slate-950">
                        {tier.title}
                      </h3>
                      <span
                        className={`rounded-md px-2 py-1 text-[11px] font-bold ${tier.labelClassName}`}
                      >
                        {tier.label}
                      </span>
                    </div>
                    <p className="mt-2 text-sm font-bold tracking-normal text-slate-800">
                      {tier.benefit}
                    </p>
                    <p className="mt-1 text-sm font-medium leading-[1.55] tracking-normal text-slate-600">
                      {tier.description}
                    </p>
                  </div>
                </div>
              </section>
            ))}
          </div>
        </section>

        <section className="bg-slate-950 px-5 py-7 text-white">
          <p className="text-xs font-bold text-primary">창립 브리더 100</p>
          <h2 className="mt-2 text-2xl font-extrabold leading-[1.25] tracking-normal">
            처음 100명에게만
            <br />
            평생 수수료 0원
          </h2>
          <p className="mt-3 text-sm font-medium leading-[1.65] tracking-normal text-white/70">
            출시 이후 새로 가입한 유저 중 처음 {FOUNDING_BREEDER_LIMIT}명만 자동
            선정됩니다. 선정된 계정은 프로필에서 가장 강한 프레임과 배지를
            받습니다.
          </p>

          <div className="mt-5 rounded-lg border border-white/10 bg-white/5 px-4 py-4">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-semibold text-white/65">
                현재 상태
              </span>
              <span className="text-sm font-extrabold text-white">
                {foundingStatusLabel}
              </span>
            </div>
          </div>

          <div className="mt-5 flex gap-2">
            <Link
              href="/auth/login"
              className="inline-flex h-11 flex-1 items-center justify-center rounded-lg bg-white px-4 text-sm font-bold text-slate-950 transition hover:bg-slate-100"
            >
              지금 시작하기
            </Link>
            <Link
              href="/support"
              className="inline-flex h-11 items-center justify-center rounded-lg border border-white/20 px-4 text-sm font-bold text-white transition hover:bg-white/10"
            >
              문의
            </Link>
          </div>
        </section>
      </main>
    </Layout>
  );
};

export default BreederProgramClient;
