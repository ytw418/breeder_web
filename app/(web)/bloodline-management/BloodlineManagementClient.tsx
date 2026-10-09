"use client";

/**
 * 혈통 — 채택 시안 A2(당근 톤) `#S1`·`#S2` 1:1(앱 src/app/bloodline-management/index.tsx, PRD bloodline-v2.md S-1·S-2).
 *
 * - 비로그인 / 로그인 + 내 혈통 0 + 받은 출처 카드 0: S1 소개(로그인으로 보내지 않는다. CTA 가 로그인 → 만들기).
 * - 그 외 S2: 헤더 "혈통" → "내 혈통" 72 행 → 8 갭 → "받은 출처 카드" 72 행 → 8 갭
 *   → "혈통 안내 다시 보기" · "이력 전체 보기" 48 행 → 하단 CTA "혈통 만들기".
 * - 인증 확인·첫 조회 중: 섹션 제목 + 72 행 스켈레톤 2개씩. 조회 실패(받아 둔 목록 없음): 다시 시도, CTA 유지.
 */
import { Fragment, useMemo } from "react";
import Link from "next/link";
import useSWR from "swr";
import Layout from "@components/features/MainLayout";
import { QueryErrorState } from "@components/app/QueryErrorState";
import BloodlineIntro, { BLOODLINE_CREATE_CTA } from "@components/features/bloodline/BloodlineIntro";
import {
  BloodlineRow,
  BloodlineRowDivider,
  BloodlineRowSkeleton,
  BloodlineSectionTitle,
} from "@components/features/bloodline/BloodlineRow";
import {
  BloodlineBottomBar,
  BloodlineBottomBarSpacer,
  BloodlineHeader,
  BloodlinePrimaryButton,
  bloodlineRowMeta,
} from "@components/features/bloodline/BloodlineScreenParts";
import { toLoginHref } from "@components/features/MainLayout";
import useUser from "hooks/useUser";
import type { BloodlineCardItem, BloodlineCardsResponse } from "@libs/shared/bloodline-card";

const SCREEN_TITLE = "혈통";
const CREATE_PATH = "/bloodline-cards/create";

function uniqueById(cards: readonly BloodlineCardItem[]): BloodlineCardItem[] {
  const seen = new Set<number>();
  return cards.filter((card) => {
    if (seen.has(card.id)) return false;
    seen.add(card.id);
    return true;
  });
}

function SectionGap() {
  return <div className="mt-2 h-2 bg-app-gap" aria-hidden="true" />;
}

function CardSection({
  title,
  cards,
  emptyMessage,
}: {
  title: string;
  cards: readonly BloodlineCardItem[];
  emptyMessage: string;
}) {
  return (
    <section>
      <BloodlineSectionTitle title={title} />
      {cards.length === 0 ? (
        <p className="flex h-12 items-center px-4 text-[14px] text-app-muted">{emptyMessage}</p>
      ) : (
        cards.map((card, index) => (
          <Fragment key={card.id}>
            {index > 0 ? <BloodlineRowDivider /> : null}
            <BloodlineRow
              imageId={card.image}
              title={card.name}
              meta={bloodlineRowMeta(card)}
              href={`/bloodline-management/card/${card.id}`}
            />
          </Fragment>
        ))
      )}
    </section>
  );
}

function SkeletonSection({ title }: { title: string }) {
  return (
    <>
      <BloodlineSectionTitle title={title} />
      <BloodlineRowSkeleton />
      <BloodlineRowDivider />
      <BloodlineRowSkeleton />
    </>
  );
}

export default function BloodlineManagementClient() {
  const { user, isLoading: userLoading } = useUser();
  const { data, error, mutate } = useSWR<BloodlineCardsResponse>(user?.id ? "/api/bloodline-cards" : null);

  /** 내 혈통 = 지금 내가 보유한 뿌리 혈통(만든 사람 무관, 서버 분류). */
  const myBloodlines = useMemo(
    () => uniqueById((data?.myBloodlines ?? []).filter((card) => card.cardType === "BLOODLINE")),
    [data]
  );
  /** 받은 출처 카드 = 남이 만든 출처 카드 중 지금 내가 보유한 것. 내가 만든 레거시 출처 카드는 그리지 않는다. */
  const receivedLines = useMemo(
    () =>
      uniqueById(
        (data?.receivedLines ?? []).filter((card) => card.cardType === "LINE" && card.creator.id !== user?.id)
      ),
    [data, user?.id]
  );

  const loggedOut = !user && !userLoading;
  const createHref = loggedOut ? toLoginHref(CREATE_PATH) : CREATE_PATH;
  const isBusy = userLoading || (Boolean(user) && !data && !error);
  const showIntro = loggedOut || (Boolean(data) && myBloodlines.length === 0 && receivedLines.length === 0);

  if (showIntro) {
    return (
      <Layout headerVariant="none" seoTitle="혈통">
        <BloodlineHeader title={SCREEN_TITLE} />
        <BloodlineIntro createHref={createHref} />
      </Layout>
    );
  }

  return (
    <Layout headerVariant="none" seoTitle="혈통">
      <BloodlineHeader title={SCREEN_TITLE} />
      <div className="bg-app-bg pb-2">
        {isBusy ? (
          <>
            <SkeletonSection title="내 혈통" />
            <SectionGap />
            <SkeletonSection title="받은 출처 카드" />
          </>
        ) : error && !data ? (
          <QueryErrorState onRetry={() => void mutate()} />
        ) : (
          <>
            <CardSection title="내 혈통" cards={myBloodlines} emptyMessage="아직 만든 혈통이 없어요" />
            <SectionGap />
            <CardSection title="받은 출처 카드" cards={receivedLines} emptyMessage="아직 받은 카드가 없어요" />
            <SectionGap />
            <div className="mt-2">
              <Link
                href="/bloodline-management/intro"
                className="flex h-12 items-center justify-center text-[14px] text-app-muted hover:text-app-text"
              >
                혈통 안내 다시 보기
              </Link>
              <Link
                href="/bloodline-management/events"
                className="flex h-12 items-center justify-center text-[14px] text-app-muted hover:text-app-text"
              >
                이력 전체 보기
              </Link>
            </div>
          </>
        )}
      </div>
      <BloodlineBottomBarSpacer />
      <BloodlineBottomBar>
        <BloodlinePrimaryButton href={createHref}>{BLOODLINE_CREATE_CTA}</BloodlinePrimaryButton>
      </BloodlineBottomBar>
    </Layout>
  );
}
