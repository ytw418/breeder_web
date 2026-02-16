"use client";

import { KeyboardEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import useSWR from "swr";
import { Spinner } from "@components/atoms/Spinner";
import useUser from "hooks/useUser";
import {
  BloodlineCardItem,
  BloodlineCardsResponse,
} from "@libs/shared/bloodline-card";
import { BloodlineVisualCard } from "@components/features/bloodline/BloodlineVisualCard";

type SectionKey = "myBloodlines" | "createdLines" | "receivedCards";

const PREVIEW_LIMIT = 4;
const RECEIVED_PREVIEW_LIMIT = 10;

const sectionTitle: Record<SectionKey, string> = {
  myBloodlines: "내 혈통",
  createdLines: "내 라인",
  receivedCards: "받은 혈통/라인",
};

const sectionPagePath: Record<SectionKey, string> = {
  myBloodlines: "/bloodline-management/my-bloodlines",
  createdLines: "/bloodline-management/created-lines",
  receivedCards: "/bloodline-management/received-cards",
};

const getSectionId = (key: SectionKey) => {
  if (key === "myBloodlines") return "section-my-bloodlines";
  if (key === "createdLines") return "section-created-lines";
  return "section-received-cards";
};

const cardTypeBadgeClass =
  "inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em]";

const SECTION_KEYS: SectionKey[] = ["myBloodlines", "createdLines", "receivedCards"];

export default function BloodlineManagementClient() {
  const { user } = useUser();
  const searchParams = useSearchParams();
  const router = useRouter();

  const { data: bloodlineData, isLoading: isBloodlineLoading } = useSWR<BloodlineCardsResponse>(
    user?.id ? "/api/bloodline-cards" : null
  );

  const [expandedSections, setExpandedSections] = useState<Record<SectionKey, boolean>>({
    myBloodlines: false,
    createdLines: false,
    receivedCards: false,
  });

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

  const receivedCards = useMemo(
    () => [...receivedBloodlines, ...receivedLines],
    [receivedBloodlines, receivedLines]
  );

  const directCards = myBloodlines.length + createdLines.length;
  const totalCards = directCards + receivedCards.length;

  useEffect(() => {
    const section = searchParams?.get("focus") as SectionKey | null;
    if (!section || !SECTION_KEYS.includes(section)) return;

    setExpandedSections((prev) => {
      if (prev[section]) return prev;
      return {
        ...prev,
        [section]: true,
      };
    });

    const sectionId = getSectionId(section);
    requestAnimationFrame(() => {
      document.getElementById(sectionId)?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }, [searchParams]);

  const toggleSection = (key: SectionKey) => {
    setExpandedSections((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleCardClick = (cardId: number) => {
    router.push(`/bloodline-management/card/${cardId}`);
  };

  const handleCardKeyDown = (event: KeyboardEvent<HTMLElement>, cardId: number) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handleCardClick(cardId);
    }
  };

  const renderSection = (key: SectionKey, cards: BloodlineCardItem[]) => {
    const open = expandedSections[key];
    const previewLimit = key === "receivedCards" ? RECEIVED_PREVIEW_LIMIT : PREVIEW_LIMIT;
    const visibleCards = open ? cards : cards.slice(0, previewLimit);
    const hasMore = cards.length > previewLimit;

    return (
      <section id={getSectionId(key)} className="space-y-3 rounded-xl bg-white p-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="app-title-md">{sectionTitle[key]}</h2>
            <p className="mt-1 text-xs font-semibold text-slate-500">총 {cards.length}개</p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={sectionPagePath[key]}
              className="inline-flex h-8 items-center rounded-full bg-slate-100 px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-200"
            >
              목록 이동
            </Link>
            {hasMore ? (
              <button
                type="button"
                onClick={() => toggleSection(key)}
                className="inline-flex h-8 items-center rounded-full bg-white px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                {open ? "접기" : "모두 보기"}
              </button>
            ) : null}
          </div>
        </div>

        {cards.length ? (
          <div className="grid grid-cols-2 gap-2">
            {visibleCards.map((card) => (
              <article
                key={card.id}
                role="button"
                tabIndex={0}
                onClick={() => handleCardClick(card.id)}
                onKeyDown={(event) => handleCardKeyDown(event, card.id)}
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
                      className={`${cardTypeBadgeClass} ${
                        card.cardType === "BLOODLINE" ? "bg-blue-50 text-blue-700" : "bg-emerald-50 text-emerald-700"
                      }`}
                    >
                      {card.cardType === "BLOODLINE" ? "혈통" : "라인"}
                    </span>
                  </div>
                  <p className="line-clamp-1 text-xs text-slate-500">
                    보유자 {card.currentOwner.name}
                  </p>
                  <p className="line-clamp-1 text-[11px] text-slate-400">
                    최근 전송 {card.transfers.length}회
                  </p>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="rounded-none bg-slate-50 p-4 text-sm text-slate-600">해당 항목의 카드가 없습니다.</p>
        )}
      </section>
    );
  };

  return (
    <div className="app-page min-h-screen">
      <div className="mx-auto flex w-full max-w-[680px] flex-col gap-4">
        <header className="space-y-3">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              BLOODLINE MANAGEMENT
            </p>
            <div className="mt-2 flex items-center justify-between gap-2">
              <h1 className="app-title-lg">혈통관리</h1>
              <Link
                href="/bloodline-cards/create"
                className="inline-flex h-9 items-center justify-center rounded-full bg-orange-500 px-3 text-xs font-semibold text-white shadow-sm transition hover:bg-orange-600"
              >
                새 혈통 만들기
              </Link>
            </div>
            <p className="mt-1 text-sm text-slate-600">
              카드를 선택하면 상세에서 보내기와 라인 만들기를 바로 이어서 진행할 수 있습니다.
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-lg bg-slate-50 px-3 py-2">
                <p className="text-[11px] font-semibold text-slate-500">총 자산</p>
                <p className="mt-1 text-lg font-bold text-slate-900">{totalCards}개</p>
              </div>
              <div className="rounded-lg bg-slate-50 px-3 py-2">
                <p className="text-[11px] font-semibold text-slate-500">내 구성</p>
                <p className="mt-1 text-lg font-bold text-slate-900">{directCards}개</p>
              </div>
            </div>
          </div>
        </header>

        {isBloodlineLoading ? (
          <div className="flex h-20 items-center justify-center">
            <Spinner />
          </div>
        ) : (
          <>
            {renderSection("myBloodlines", myBloodlines)}
            {renderSection("createdLines", createdLines)}
            {renderSection("receivedCards", receivedCards)}
          </>
        )}
      </div>
    </div>
  );
}
