"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { Input } from "@components/ui/input";
import { Spinner } from "@components/atoms/Spinner";
import { BloodlineVisualCard } from "@components/features/bloodline/BloodlineVisualCard";
import useUser from "hooks/useUser";
import { BloodlineCardsResponse, BloodlineCardItem } from "@libs/shared/bloodline-card";

type SectionMode = "myBloodlines" | "createdLines" | "receivedCards";

interface BloodlineSectionListClientProps {
  mode: SectionMode;
}

const sectionMeta: Record<SectionMode, { title: string; sub: string; backLabel: string }> = {
  myBloodlines: {
    title: "내 혈통",
    sub: "원본 혈통카드",
    backLabel: "전체 보기",
  },
  createdLines: {
    title: "내 라인",
    sub: "내가 만든 라인카드",
    backLabel: "전체 보기",
  },
  receivedCards: {
    title: "받은 카드",
    sub: "받은 혈통/라인 목록",
    backLabel: "전체 보기",
  },
};

const cardTypeClassByKind =
  "inline-flex shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em]";

const toCardMetaLabel = (card: BloodlineCardItem) =>
  card.cardType === "BLOODLINE" ? "혈통" : "라인";

export default function BloodlineSectionListClient({ mode }: BloodlineSectionListClientProps) {
  const router = useRouter();
  const { user } = useUser();
  const {
    data: bloodlineData,
    isLoading,
  } = useSWR<BloodlineCardsResponse>(user?.id ? "/api/bloodline-cards" : null);

  const [query, setQuery] = useState("");

  const myBloodlines = useMemo(() => {
    if (!bloodlineData) return [];
    if (bloodlineData.myBloodlines?.length) return bloodlineData.myBloodlines;
    if (bloodlineData.myCreatedCards?.length) {
      return bloodlineData.myCreatedCards.filter((card) => card.cardType === "BLOODLINE");
    }
    return (bloodlineData.ownedCards || []).filter(
      (card) => card.creator.id === user?.id && card.cardType === "BLOODLINE"
    );
  }, [bloodlineData, user?.id]);

  const createdLines = useMemo(() => {
    if (!bloodlineData) return [];
    if (bloodlineData.createdLines?.length) return bloodlineData.createdLines;
    if (bloodlineData.myCreatedCards?.length) {
      return bloodlineData.myCreatedCards.filter((card) => card.cardType === "LINE");
    }
    return (bloodlineData.ownedCards || []).filter(
      (card) => card.creator.id === user?.id && card.cardType === "LINE"
    );
  }, [bloodlineData, user?.id]);

  const receivedBloodlines = useMemo(() => {
    if (!bloodlineData) return [];
    if (bloodlineData.receivedBloodlines?.length) return bloodlineData.receivedBloodlines;
    if (bloodlineData.receivedCards?.length) {
      return bloodlineData.receivedCards.filter((card) => card.cardType === "BLOODLINE");
    }
    return (bloodlineData.ownedCards || []).filter(
      (card) => card.creator.id !== user?.id && card.cardType === "BLOODLINE"
    );
  }, [bloodlineData, user?.id]);

  const receivedLines = useMemo(() => {
    if (!bloodlineData) return [];
    if (bloodlineData.receivedLines?.length) return bloodlineData.receivedLines;
    if (bloodlineData.receivedCards?.length) {
      return bloodlineData.receivedCards.filter((card) => card.cardType === "LINE");
    }
    return (bloodlineData.ownedCards || []).filter(
      (card) => card.creator.id !== user?.id && card.cardType === "LINE"
    );
  }, [bloodlineData, user?.id]);

  const cards = useMemo(() => {
    if (mode === "myBloodlines") return myBloodlines;
    if (mode === "createdLines") return createdLines;
    return [...receivedBloodlines, ...receivedLines];
  }, [mode, myBloodlines, createdLines, receivedBloodlines, receivedLines]);

  const filteredCards = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return cards;

    return cards.filter((card) => {
      return (
        card.name.toLowerCase().includes(normalized) ||
        card.description?.toLowerCase().includes(normalized) ||
        card.creator.name.toLowerCase().includes(normalized) ||
        card.currentOwner.name.toLowerCase().includes(normalized)
      );
    });
  }, [cards, query]);

  const handleCardClick = (cardId: number) => {
    router.push(`/bloodline-management/card/${cardId}`);
  };

  return (
    <section className="app-page min-h-screen">
      <div className="mx-auto flex w-full max-w-[680px] flex-col gap-3">
        <header className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            BLOODLINE MANAGEMENT
          </p>
          <div className="mt-1 flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <h1 className="app-title-md">{sectionMeta[mode].title}</h1>
              <p className="app-body-sm mt-1 text-slate-600">{sectionMeta[mode].sub}</p>
            </div>
            <Link
              href="/bloodline-management"
              className="inline-flex h-8 items-center rounded-full bg-slate-100 px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-200"
            >
              {sectionMeta[mode].backLabel}
            </Link>
          </div>
        </header>

        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="카드명/닉네임 검색"
          className="h-11 rounded-lg"
        />

        <p className="text-sm font-semibold text-slate-700">조회: {filteredCards.length}개</p>

        {isLoading ? (
          <div className="flex h-24 items-center justify-center">
            <Spinner />
          </div>
        ) : filteredCards.length ? (
          <>
          <div className="grid grid-cols-2 gap-2">
            {filteredCards.map((card) => (
              <article
                key={card.id}
                role="button"
                tabIndex={0}
                onClick={() => handleCardClick(card.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    handleCardClick(card.id);
                  }
                }}
                className="cursor-pointer rounded-lg border border-slate-200 bg-white p-3 transition duration-150 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300"
              >
                <BloodlineVisualCard
                  cardId={card.id}
                  name={card.name}
                  ownerName={card.currentOwner.name}
                  subtitle={card.description || "설명이 없습니다."}
                  image={card.image}
                  variant={card.visualStyle}
                  compact
                />
                <div className="mt-2 space-y-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="line-clamp-1 text-sm font-bold text-slate-900">{card.name}</p>
                    <span
                      className={`${cardTypeClassByKind} ${
                        card.cardType === "BLOODLINE"
                          ? "bg-blue-50 text-blue-700"
                          : "bg-emerald-50 text-emerald-700"
                      }`}
                    >
                      {toCardMetaLabel(card)}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">제작 {card.creator.name}</p>
                  <p className="text-xs text-slate-500">보유 {card.currentOwner.name}</p>
                </div>
              </article>
            ))}
          </div>
          <p className="text-xs text-slate-500">
            카드 상세에서 보내기 또는 라인 만들기 작업을 이어서 진행할 수 있습니다.
          </p>
          </>
        ) : (
          <p className="rounded-lg bg-slate-50 px-3 py-6 text-sm text-slate-600">
            조회 가능한 카드가 없습니다.
          </p>
        )}
      </div>
    </section>
  );
}
