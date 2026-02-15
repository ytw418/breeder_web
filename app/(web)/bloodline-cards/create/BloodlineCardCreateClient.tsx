"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import Layout from "@components/features/MainLayout";
import { Spinner } from "@components/atoms/Spinner";
import { Button } from "@components/ui/button";
import { Input } from "@components/ui/input";
import { Textarea } from "@components/ui/textarea";
import useUser from "hooks/useUser";
import useSWR from "swr";
import type { BloodlineCardsResponse } from "@libs/shared/bloodline-card";

const formatCardNo = (id: number | null) =>
  id ? `BC-${String(id).padStart(6, "0")}` : "BC-NEW";

function BloodlinePhotoCard({
  cardId,
  name,
  ownerName,
  subtitle,
}: {
  cardId: number | null;
  name: string;
  ownerName: string;
  subtitle: string;
}) {
  return (
    <div className="relative mx-auto w-full max-w-[360px]">
      <div className="absolute -inset-[1px] rounded-[30px] bg-gradient-to-br from-amber-300/55 via-yellow-200/20 to-orange-300/45 blur-md" />
      <div className="relative aspect-square overflow-hidden rounded-3xl border border-amber-200/65 bg-gradient-to-br from-[#0b0701] via-[#2b1a05] to-[#6d4308] p-5 text-amber-50 shadow-[0_24px_70px_rgba(70,39,4,0.55)]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_16%_10%,rgba(255,244,214,0.6),transparent_35%),radial-gradient(circle_at_80%_8%,rgba(245,158,11,0.35),transparent_38%)]" />
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,transparent_12%,rgba(255,255,255,0.26)_34%,transparent_52%)] motion-safe:animate-pulse" />
        <div className="pointer-events-none absolute inset-x-5 top-[74px] h-px bg-gradient-to-r from-transparent via-amber-100/70 to-transparent" />

        <div className="relative z-10 flex h-full flex-col justify-between">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] font-semibold tracking-[0.18em] text-amber-100/80">BREDY SIGNATURE</p>
              <p className="mt-1 text-[10px] font-semibold text-amber-100/70">{formatCardNo(cardId)}</p>
            </div>
            <span className="rounded-full border border-amber-100/45 bg-amber-100/10 px-2.5 py-1 text-[10px] font-semibold text-amber-100">
              VERIFIED
            </span>
          </div>

          <div>
            <p className="line-clamp-2 bg-gradient-to-r from-amber-50 via-yellow-100 to-amber-200 bg-clip-text text-[30px] font-black leading-[1.1] tracking-tight text-transparent">
              {name}
            </p>
            <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-amber-100/90">{subtitle}</p>
          </div>

          <div className="rounded-xl border border-amber-100/25 bg-black/25 px-3 py-2 backdrop-blur-sm">
            <p className="text-[10px] uppercase tracking-[0.16em] text-amber-100/70">Owner</p>
            <p className="mt-1 text-sm font-semibold text-amber-50">{ownerName}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function BloodlineCardCreateClient() {
  const { user, isLoading: isUserLoading } = useUser();
  const {
    data: bloodlineData,
    isLoading: isBloodlineLoading,
    error: bloodlineLoadError,
    mutate: mutateBloodline,
  } = useSWR<BloodlineCardsResponse>(user?.id ? "/api/bloodline-cards" : null);

  const [cardName, setCardName] = useState("");
  const [cardDescription, setCardDescription] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [creatingCard, setCreatingCard] = useState(false);

  const previewName = useMemo(
    () => (cardName.trim() || `${user?.name || "브리더"} 혈통`).slice(0, 40),
    [cardName, user?.name]
  );
  const previewDescription = useMemo(
    () =>
      (cardDescription.trim() ||
        bloodlineData?.createdCard?.description ||
        "한 줄 소개를 입력하면 카드 미리보기에 반영됩니다.").slice(0, 120),
    [bloodlineData?.createdCard?.description, cardDescription]
  );

  const handleCreateBloodlineCard = async (event: FormEvent) => {
    event.preventDefault();
    setMessage("");
    setError("");

    const nextName = (cardName.trim() || `${user?.name || "브리더"} 혈통`).slice(0, 40);
    const nextDescription = cardDescription.trim().slice(0, 300);

    try {
      setCreatingCard(true);
      const res = await fetch("/api/bloodline-cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: nextName,
          description: nextDescription,
        }),
      });

      const result = (await res.json()) as BloodlineCardsResponse;
      if (!res.ok || !result.success) {
        throw new Error(result.error || "혈통카드 생성에 실패했습니다.");
      }

      setCardName("");
      setCardDescription("");
      setMessage("대표 혈통카드를 생성했습니다.");
      await mutateBloodline();
    } catch (createError) {
      setError(
        createError instanceof Error
          ? createError.message
          : "요청 처리 중 오류가 발생했습니다."
      );
    } finally {
      setCreatingCard(false);
    }
  };

  return (
    <Layout canGoBack showHome title="혈통카드 만들기" seoTitle="혈통카드 만들기">
      <div className="space-y-4 px-4 py-4 pb-12">
        <section className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-relaxed text-amber-900">
          혈통카드는 이용자 생성 기반 기능이며, 브리디는 혈통/적법성/품질을 보증하지 않습니다.
        </section>

        <section className="rounded-2xl border border-amber-200/80 bg-gradient-to-b from-[#fff8e9] to-white p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold tracking-wide text-amber-900">대표 카드 미리보기</p>
            <span className="text-[11px] font-medium text-amber-700">캡처 추천 영역</span>
          </div>
          <div className="mt-3 rounded-2xl bg-[#120a02] p-4 sm:p-5">
            <BloodlinePhotoCard
              cardId={bloodlineData?.createdCard?.id ?? null}
              name={previewName}
              ownerName={user?.name || "브리더"}
              subtitle={previewDescription}
            />
          </div>
        </section>

        {isUserLoading ? (
          <div className="flex h-28 items-center justify-center">
            <Spinner />
          </div>
        ) : null}

        {!isUserLoading && !user ? (
          <section className="rounded-xl border border-slate-200 bg-white p-5 text-center">
            <p className="text-sm text-slate-700">혈통카드는 로그인 후 생성할 수 있습니다.</p>
            <Link
              href="/auth/login?next=%2Fbloodline-cards%2Fcreate"
              className="mt-3 inline-flex h-10 items-center justify-center rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white"
            >
              로그인하고 시작하기
            </Link>
          </section>
        ) : null}

        {user ? (
          <>
            {bloodlineLoadError ? (
              <section className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
                혈통카드 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.
              </section>
            ) : null}

            {message ? (
              <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">
                {message}
              </p>
            ) : null}
            {error ? (
              <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700">
                {error}
              </p>
            ) : null}

            {!isBloodlineLoading && !bloodlineData?.createdCard ? (
              <form
                onSubmit={handleCreateBloodlineCard}
                className="space-y-3 rounded-xl border border-slate-200 bg-white p-4"
              >
                <h2 className="text-base font-bold text-slate-900">대표 혈통카드 생성</h2>
                <Input
                  value={cardName}
                  onChange={(event) => setCardName(event.target.value)}
                  placeholder={`${user?.name || "브리더"} 혈통`}
                />
                <Textarea
                  rows={4}
                  value={cardDescription}
                  onChange={(event) => setCardDescription(event.target.value)}
                  placeholder="이 혈통카드의 소개를 적어주세요 (선택)"
                />
                <Button type="submit" disabled={creatingCard}>
                  {creatingCard ? "생성 중..." : "대표 혈통카드 생성"}
                </Button>
              </form>
            ) : null}

            {bloodlineData?.createdCard ? (
              <section className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="text-xs font-semibold tracking-wide text-slate-500">내 대표 카드</p>
                <p className="mt-1 text-lg font-bold text-slate-900">{bloodlineData.createdCard.name}</p>
                {bloodlineData.createdCard.description ? (
                  <p className="mt-1 text-sm text-slate-600">{bloodlineData.createdCard.description}</p>
                ) : null}
                <p className="mt-2 text-xs text-slate-500">
                  현재 보유자: {bloodlineData.createdCard.currentOwner.name}
                </p>
              </section>
            ) : null}

            <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
              <h3 className="text-sm font-semibold text-slate-900">내 혈통카드 페이지 이동</h3>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <Link
                  href="/bloodline-cards/my"
                  className="inline-flex h-10 items-center justify-center rounded-lg border border-amber-200 bg-amber-50 text-sm font-semibold text-amber-900"
                >
                  내 혈통 상세
                </Link>
                <Link
                  href="/bloodline-cards/owned"
                  className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-sm font-semibold text-slate-800"
                >
                  보유 혈통 리스트
                </Link>
                <Link
                  href={
                    bloodlineData?.createdCard
                      ? `/bloodline-cards/${bloodlineData.createdCard.id}`
                      : "/bloodline-cards/my"
                  }
                  className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-sm font-semibold text-slate-800"
                >
                  대표 카드 상세 링크
                </Link>
              </div>
            </section>
          </>
        ) : null}
      </div>
    </Layout>
  );
}
