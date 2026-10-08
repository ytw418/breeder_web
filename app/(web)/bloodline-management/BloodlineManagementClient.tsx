"use client";

/**
 * 혈통관리 — 기존 웹 톤(A안) 유지, 혈통 v2 용어만 맞춘다(설계 §4.4 WB-3: 혈통 / 출처 카드).
 * 원본: bredy_app design/mockups/bloodline-card/A-karrot.html, src/app/bloodline-management/index.tsx
 *
 * 헤더(뒤로/제목/검색) → 요약 행 → 8px 섹션 갭 → 리스트바(제목 + 이벤트 + 전체보기)
 * → 칩 4개 → 1열 카드 리스트(메타: 종 · 산지 · 받은 사람 N명) → 하단 고정 CTA "혈통 만들기".
 * 상태: 로딩(요약 회색 바 + 카드 스켈레톤 2장) / 오류 + 다시 시도 / 빈 / 비로그인 → 로그인 이동.
 */
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import useSWR from "swr";
import Layout from "@components/features/MainLayout";
import { FilterChip } from "@components/app/FilterChip";
import { EmptyState } from "@components/app/EmptyState";
import { QueryErrorState } from "@components/app/QueryErrorState";
import { BloodlineVisualCard } from "@components/features/bloodline/BloodlineVisualCard";
import {
  BloodlineBottomBar,
  BloodlineBottomBarSpacer,
  BloodlineHeader,
  BloodlinePrimaryButton,
  BloodlineSpinner,
  ChevronRightIcon,
  bloodlineRowMeta,
  bloodlineUserLabel,
  useBloodlineLoginRedirect,
} from "@components/features/bloodline/BloodlineScreenParts";
import useUser from "hooks/useUser";
import {
  bloodlineCardTypeLabel,
  bloodlineFilterFromFocus,
  cardsForBloodlineFilter,
  groupBloodlineCards,
  type BloodlineCardsResponse,
  type BloodlineManagementFilter,
} from "@libs/shared/bloodline-card";

const FILTERS: { key: BloodlineManagementFilter; label: string }[] = [
  { key: "all", label: "전체" },
  { key: "bloodline", label: "혈통" },
  { key: "line", label: "출처 카드" },
  { key: "received", label: "받은 카드" },
];

/** 리스트바 제목과 "전체보기" 목적지(시안 기본값 = 내 혈통) */
const LIST_META: Record<BloodlineManagementFilter, { title: string; href: string }> = {
  all: { title: "내 혈통", href: "/bloodline-management/my-bloodlines" },
  bloodline: { title: "내 혈통", href: "/bloodline-management/my-bloodlines" },
  line: { title: "내 출처 카드", href: "/bloodline-management/created-lines" },
  received: { title: "받은 카드", href: "/bloodline-management/received-cards" },
};

function CardSkeleton() {
  return (
    <div aria-hidden="true" className="overflow-hidden rounded-xl border border-app-border bg-app-bg">
      <div className="h-[186px] bg-app-placeholder" />
      <div className="p-3.5">
        <div className="h-5 w-[62%] rounded bg-app-surface" />
        <div className="mt-[9px] h-3.5 w-[44%] rounded bg-app-surface" />
        <div className="mt-4 h-3.5 w-full rounded bg-app-surface" />
        <div className="mt-2.5 h-3.5 w-full rounded bg-app-surface" />
      </div>
    </div>
  );
}

const linkClass =
  "inline-flex items-center gap-0.5 py-1.5 text-[13px] text-app-muted transition-colors hover:text-app-text";

export default function BloodlineManagementClient() {
  const { user, isLoading: userLoading } = useUser();
  const searchParams = useSearchParams();
  const focusFilter = bloodlineFilterFromFocus(searchParams?.get("focus"));
  const [filter, setFilter] = useState<BloodlineManagementFilter>(focusFilter ?? "all");
  // ?focus=<섹션> 딥링크(예전 섹션 화면 값 포함)로 들어오면 해당 칩을 고른다.
  useEffect(() => {
    if (focusFilter) setFilter(focusFilter);
  }, [focusFilter]);

  const { data, error, isLoading, mutate } = useSWR<BloodlineCardsResponse>(
    user?.id ? "/api/bloodline-cards" : null
  );

  const loggedOut = !user && !userLoading;
  useBloodlineLoginRedirect(loggedOut, "/bloodline-management");

  const groups = useMemo(() => groupBloodlineCards(data, user?.id), [data, user?.id]);
  const visibleCards = useMemo(() => cardsForBloodlineFilter(groups, filter), [groups, filter]);
  const listMeta = LIST_META[filter];
  const isBusy = userLoading || (Boolean(user) && isLoading);
  const isError = Boolean(error) && !data;

  if (loggedOut) {
    return (
      <Layout headerVariant="none" seoTitle="혈통관리">
        <BloodlineHeader title="혈통관리" />
        <div className="flex min-h-[60vh] items-center justify-center">
          <BloodlineSpinner />
        </div>
      </Layout>
    );
  }

  return (
    <Layout headerVariant="none" seoTitle="혈통관리">
      <BloodlineHeader title="혈통관리" searchHref="/search" />

      {/* 요약 텍스트 행 */}
      <div className="px-4 pb-4 pt-3.5">
        {isBusy ? (
          <div aria-label="요약 불러오는 중" className="h-5 w-[62%] rounded bg-app-surface" />
        ) : (
          <p className="text-[14px] tracking-[-0.2px] text-app-muted">
            내 혈통 <b className="font-semibold text-app-text">{groups.myBloodlines.length}</b>
            {" · "}내 출처 카드{" "}
            <b className="font-semibold text-app-text">{groups.createdLines.length}</b>
            {" · "}받은 카드{" "}
            <b className="font-semibold text-app-text">{groups.receivedCards.length}</b>
          </p>
        )}
      </div>

      <div className="h-2 bg-app-gap" />

      {/* 리스트바 */}
      <div className="flex items-center justify-between px-4 pb-2.5 pt-4">
        <h2 className="text-[16px] font-bold tracking-[-0.3px] text-app-text">{listMeta.title}</h2>
        <div className="flex items-center gap-3">
          <Link href="/bloodline-management/events" aria-label="혈통 이벤트" className={linkClass}>
            이벤트
            <ChevronRightIcon />
          </Link>
          <Link href={listMeta.href} aria-label={`${listMeta.title} 전체보기`} className={linkClass}>
            전체보기
            <ChevronRightIcon />
          </Link>
        </div>
      </div>

      {/* 칩 */}
      <div className="flex gap-1.5 px-4 pb-3.5">
        {FILTERS.map((item) => (
          <FilterChip
            key={item.key}
            label={item.label}
            selected={item.key === filter}
            onClick={() => setFilter(item.key)}
            className="px-3"
          />
        ))}
      </div>

      {/* 카드 리스트 */}
      <div className="flex flex-col gap-3 px-4 pb-6">
        {isBusy ? (
          <>
            <CardSkeleton />
            <CardSkeleton />
          </>
        ) : isError ? (
          <QueryErrorState onRetry={() => void mutate()} />
        ) : visibleCards.length === 0 ? (
          <EmptyState
            title="아직 혈통이 없어요"
            description="혈통을 만들면 여기에 쌓여요."
            className="py-10"
          />
        ) : (
          visibleCards.map((card) => (
            <Link
              key={card.id}
              href={`/bloodline-management/card/${card.id}`}
              aria-label={`${card.name} ${bloodlineCardTypeLabel(card.cardType)}`}
              className="block rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-app-text"
            >
              <BloodlineVisualCard
                cardId={card.id}
                name={card.name}
                subtitle={bloodlineRowMeta(card)}
                ownerName={bloodlineUserLabel(card.currentOwner)}
                typeLabel={bloodlineCardTypeLabel(card.cardType)}
                issuedAt={card.createdAt}
                image={card.image}
              />
            </Link>
          ))
        )}
      </div>

      <BloodlineBottomBarSpacer />
      <BloodlineBottomBar>
        <BloodlinePrimaryButton href="/bloodline-cards/create">혈통 만들기</BloodlinePrimaryButton>
      </BloodlineBottomBar>
    </Layout>
  );
}
