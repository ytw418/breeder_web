"use client";

import Link from "next/link";
import Layout from "@components/features/MainLayout";
import { Spinner } from "@components/atoms/Spinner";
import { Button } from "@components/ui/button";
import useUser from "hooks/useUser";
import useSWR from "swr";
import type { BloodlineCardsResponse } from "@libs/shared/bloodline-card";

const formatCardNo = (id: number) => `BC-${String(id).padStart(6, "0")}`;

export default function OwnedBloodlineCardsClient() {
  const { user, isLoading: isUserLoading } = useUser();
  const { data, isLoading, error } = useSWR<BloodlineCardsResponse>(
    user?.id ? "/api/bloodline-cards" : null
  );

  return (
    <Layout canGoBack showHome title="보유 혈통 리스트" seoTitle="보유 혈통 리스트">
      <div className="space-y-4 px-4 py-4 pb-12">
        {isUserLoading || isLoading ? (
          <div className="flex h-28 items-center justify-center">
            <Spinner />
          </div>
        ) : null}

        {!isUserLoading && !user ? (
          <section className="rounded-xl border border-slate-200 bg-white p-5 text-center">
            <p className="text-sm text-slate-700">로그인 후 보유 혈통 리스트를 볼 수 있습니다.</p>
            <Link
              href="/auth/login?next=%2Fbloodline-cards%2Fowned"
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

        {(data?.ownedCards || []).map((card) => (
          <section key={card.id} className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900">{card.name}</h2>
              <span className="text-xs text-slate-500">{formatCardNo(card.id)}</span>
            </div>
            <p className="mt-1 text-sm text-slate-600">
              {card.description || "등록된 카드 소개가 없습니다."}
            </p>
            <p className="mt-2 text-xs text-slate-500">
              제작자 {card.creator.name} · 보유자 {card.currentOwner.name}
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <Button asChild variant="outline" className="h-8 rounded-full px-3 text-xs">
                <Link href={`/bloodline-cards/${card.id}`}>상세 보기</Link>
              </Button>
              <Button asChild variant="outline" className="h-8 rounded-full px-3 text-xs">
                <Link href="/bloodline-cards/create">전달/공유 하러가기</Link>
              </Button>
            </div>
          </section>
        ))}

        {!isLoading && (data?.ownedCards?.length || 0) === 0 ? (
          <section className="rounded-xl border border-dashed border-slate-300 bg-white p-5 text-center text-sm text-slate-500">
            아직 보유 중인 혈통카드가 없습니다.
          </section>
        ) : null}
      </div>
    </Layout>
  );
}
