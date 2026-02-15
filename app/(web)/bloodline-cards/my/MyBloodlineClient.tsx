"use client";

import Link from "next/link";
import Layout from "@components/features/MainLayout";
import { Spinner } from "@components/atoms/Spinner";
import useUser from "hooks/useUser";
import useSWR from "swr";
import type { BloodlineCardsResponse } from "@libs/shared/bloodline-card";

const formatCardNo = (id: number | null) =>
  id ? `BC-${String(id).padStart(6, "0")}` : "BC-NEW";

export default function MyBloodlineClient() {
  const { user, isLoading: isUserLoading } = useUser();
  const { data, isLoading, error } = useSWR<BloodlineCardsResponse>(
    user?.id ? "/api/bloodline-cards" : null
  );

  const myCard = data?.createdCard;

  return (
    <Layout canGoBack showHome title="내 혈통 상세" seoTitle="내 혈통 상세">
      <div className="space-y-4 px-4 py-4 pb-12">
        {isUserLoading || isLoading ? (
          <div className="flex h-28 items-center justify-center">
            <Spinner />
          </div>
        ) : null}

        {!isUserLoading && !user ? (
          <section className="rounded-xl border border-slate-200 bg-white p-5 text-center">
            <p className="text-sm text-slate-700">로그인 후 내 혈통 상세를 확인할 수 있습니다.</p>
            <Link
              href="/auth/login?next=%2Fbloodline-cards%2Fmy"
              className="mt-3 inline-flex h-10 items-center justify-center rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white"
            >
              로그인
            </Link>
          </section>
        ) : null}

        {error ? (
          <section className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
            혈통카드 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.
          </section>
        ) : null}

        {user && myCard ? (
          <section className="rounded-2xl border border-amber-200 bg-gradient-to-br from-[#120b02] via-[#2a1a05] to-[#674008] p-5 text-amber-50 shadow-[0_20px_60px_rgba(71,42,5,0.45)]">
            <p className="text-[11px] font-semibold tracking-[0.18em] text-amber-100/80">MY BLOODLINE</p>
            <p className="mt-1 text-xs text-amber-100/70">{formatCardNo(myCard.id)}</p>
            <h1 className="mt-2 text-2xl font-black tracking-tight">{myCard.name}</h1>
            <p className="mt-3 text-sm leading-relaxed text-amber-100/90">
              {myCard.description || "등록된 소개가 없습니다."}
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
              <p className="rounded-lg bg-black/20 px-3 py-2">보유자: {myCard.currentOwner.name}</p>
              <p className="rounded-lg bg-black/20 px-3 py-2">제작자: {myCard.creator.name}</p>
            </div>
            <Link
              href={`/bloodline-cards/${myCard.id}`}
              className="mt-4 inline-flex h-10 items-center justify-center rounded-lg border border-amber-100/40 bg-amber-100/10 px-4 text-sm font-semibold text-amber-100"
            >
              혈통 상세 페이지 보기
            </Link>
          </section>
        ) : null}

        {user && !isLoading && !myCard ? (
          <section className="rounded-xl border border-dashed border-slate-300 bg-white p-5 text-center">
            <p className="text-sm text-slate-600">아직 대표 혈통카드가 없습니다.</p>
            <Link
              href="/bloodline-cards/create"
              className="mt-3 inline-flex h-10 items-center justify-center rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white"
            >
              내 혈통 만들기
            </Link>
          </section>
        ) : null}
      </div>
    </Layout>
  );
}
