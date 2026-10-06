"use client";

/**
 * 혈통 하위 목록(내 혈통 / 내 라인 / 받은 카드) — 당근 톤(A안) 1:1
 * 원본: bredy_app src/components/features/bloodline/BloodlineSectionListScreen.tsx
 *
 * 헤더(뒤로 + 제목 18/700) → 설명 13/muted → 검색 인풋 → 1열 카드 리스트(gap 12)
 * → (내 혈통만) 하단 고정 CTA "새 혈통 만들기".
 */
import { useMemo, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import Layout from "@components/features/MainLayout";
import { Input } from "@components/ui/input";
import { QueryErrorState } from "@components/app/QueryErrorState";
import { BloodlineVisualCard } from "@components/features/bloodline/BloodlineVisualCard";
import {
  BloodlineBottomBar,
  BloodlineBottomBarSpacer,
  BloodlineHeader,
  BloodlinePrimaryButton,
  BloodlineSpinner,
  bloodlineInputClass,
  useBloodlineLoginRedirect,
} from "@components/features/bloodline/BloodlineScreenParts";
import useUser from "hooks/useUser";
import {
  bloodlineCardMeta,
  bloodlineCardTypeLabel,
  groupBloodlineCards,
  searchBloodlineCards,
  type BloodlineCardsResponse,
} from "@libs/shared/bloodline-card";

type SectionMode = "myBloodlines" | "createdLines" | "receivedCards";

const sectionMeta: Record<
  SectionMode,
  { title: string; sub: string; path: string; cta?: string }
> = {
  myBloodlines: {
    title: "내 혈통",
    sub: "내가 만든 원본 혈통카드예요.",
    path: "/bloodline-management/my-bloodlines",
    cta: "새 혈통 만들기",
  },
  createdLines: {
    title: "내 라인",
    sub: "혈통에서 파생한 라인카드예요.",
    path: "/bloodline-management/created-lines",
  },
  receivedCards: {
    title: "받은 카드",
    sub: "다른 브리더에게 받은 혈통·라인카드예요.",
    path: "/bloodline-management/received-cards",
  },
};

export default function BloodlineSectionListClient({ mode }: { mode: SectionMode }) {
  const meta = sectionMeta[mode];
  const { user, isLoading: userLoading } = useUser();
  const { data, error, isLoading, mutate } = useSWR<BloodlineCardsResponse>(
    user?.id ? "/api/bloodline-cards" : null
  );
  const [query, setQuery] = useState("");

  const loggedOut = !user && !userLoading;
  useBloodlineLoginRedirect(loggedOut, meta.path);

  const cards = useMemo(() => {
    const groups = groupBloodlineCards(data, user?.id);
    if (mode === "myBloodlines") return groups.myBloodlines;
    if (mode === "createdLines") return groups.createdLines;
    return groups.receivedCards;
  }, [data, mode, user?.id]);
  const filteredCards = useMemo(() => searchBloodlineCards(cards, query), [cards, query]);

  if (userLoading || loggedOut) {
    return (
      <Layout headerVariant="none" seoTitle={meta.title}>
        <BloodlineHeader title={meta.title} />
        <div className="flex min-h-[60vh] items-center justify-center">
          <BloodlineSpinner />
        </div>
      </Layout>
    );
  }

  return (
    <Layout headerVariant="none" seoTitle={meta.title}>
      <BloodlineHeader title={meta.title} />

      <p className="truncate px-4 pt-3 text-[13px] tracking-[-0.2px] text-app-muted">{meta.sub}</p>

      <div className="px-4 pt-3">
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="카드명 · 닉네임 검색"
          aria-label="카드명 · 닉네임 검색"
          autoComplete="off"
          className={bloodlineInputClass}
        />
      </div>

      <div className="flex flex-col gap-3 px-4 pb-6 pt-4">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <BloodlineSpinner />
          </div>
        ) : error && !data ? (
          <QueryErrorState onRetry={() => void mutate()} />
        ) : filteredCards.length > 0 ? (
          filteredCards.map((card) => (
            <Link
              key={card.id}
              href={`/bloodline-management/card/${card.id}`}
              aria-label={`${card.name} 카드`}
              className="block rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-app-text"
            >
              <BloodlineVisualCard
                cardId={card.id}
                name={card.name}
                subtitle={bloodlineCardMeta(card)}
                ownerName={card.currentOwner.name}
                typeLabel={bloodlineCardTypeLabel(card.cardType)}
                issuedAt={card.createdAt}
                image={card.image}
              />
            </Link>
          ))
        ) : (
          <p className="py-12 text-center text-[14px] tracking-[-0.2px] text-app-muted">
            {query.trim() ? "검색 결과가 없어요." : "아직 카드가 없어요."}
          </p>
        )}
      </div>

      {meta.cta ? (
        <>
          <BloodlineBottomBarSpacer />
          <BloodlineBottomBar>
            <BloodlinePrimaryButton href="/bloodline-cards/create">{meta.cta}</BloodlinePrimaryButton>
          </BloodlineBottomBar>
        </>
      ) : null}
    </Layout>
  );
}
