"use client";

/**
 * 브리디북 — 당근 톤
 * 원본: bredy_app src/app/guinness/index.tsx
 *
 * 헤더(뒤로·홈 + 가운데 제목) → 설명 13 muted → 기간 칩 → 종 칩 → 72px 기록 행(순위·사진 44·종/브리더·값 mm)
 * → 하단 고정 CTA "기록 등록하기". 종 목록·기록 조회 실패는 빈 상태와 구분해 오류 + 다시 시도.
 */
import { useMemo, useState } from "react";
import useSWR from "swr";
import Layout from "@components/features/MainLayout";
import Image from "@components/atoms/Image";
import { FilterChip } from "@components/app/FilterChip";
import { QueryErrorState } from "@components/app/QueryErrorState";
import {
  BloodlineBottomBar,
  BloodlineBottomBarSpacer,
  BloodlinePrimaryButton,
} from "@components/features/bloodline/BloodlineScreenParts";
import { cn, makeImageUrl } from "@libs/client/utils";
import { formatRecordValue } from "@libs/shared/guinness-record";
import type { RankingResponse } from "pages/api/ranking";
import type { GuinnessSpeciesListResponse } from "pages/api/guinness/species";

const PERIOD_TABS = [
  { id: "all", name: "역대" },
  { id: "monthly", name: "이번 달" },
  { id: "yearly", name: "올해" },
] as const;

type Period = (typeof PERIOD_TABS)[number]["id"];

const rowClass = "flex h-[72px] items-center border-b border-app-line bg-app-bg px-4";

function SkeletonRows() {
  return (
    <div aria-hidden="true">
      {[0, 1, 2, 3, 4, 5].map((item) => (
        <div key={item} className={rowClass}>
          <div className="h-4 w-6 rounded bg-app-surface" />
          <div className="ml-3 h-11 w-11 rounded-lg bg-app-surface" />
          <div className="ml-3 flex-1">
            <div className="h-3.5 w-1/2 rounded bg-app-surface" />
            <div className="mt-2 h-3 w-[35%] rounded bg-app-surface" />
          </div>
        </div>
      ))}
    </div>
  );
}

function RecordRow({
  rank,
  photo,
  species,
  breeder,
  value,
}: {
  rank: number;
  photo: string | null;
  species: string;
  breeder: string;
  value: number;
}) {
  return (
    <div className={rowClass}>
      <span
        className={cn(
          "w-6 text-[20px] font-bold",
          rank <= 3 ? "text-app-brand" : "text-app-text"
        )}
      >
        {rank}
      </span>
      <div className="relative ml-3 h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-app-surface">
        {photo ? (
          <Image
            src={makeImageUrl(photo, "avatar")}
            alt=""
            width={44}
            height={44}
            className="h-11 w-11 object-cover"
          />
        ) : null}
      </div>
      <div className="ml-3 min-w-0 flex-1">
        <p className="truncate text-[16px] font-semibold text-app-text">{species}</p>
        <p className="mt-0.5 truncate text-[13px] text-app-muted">{breeder}</p>
      </div>
      <span className="ml-2 shrink-0 text-[15px] font-semibold text-app-text">
        {formatRecordValue(value)} mm
      </span>
    </div>
  );
}

export default function GuinnessClient() {
  const [period, setPeriod] = useState<Period>("all");
  const [species, setSpecies] = useState("");

  const speciesQuery = useSWR<GuinnessSpeciesListResponse>("/api/guinness/species?limit=100");
  const speciesOptions = useMemo(
    () => (speciesQuery.data?.species || []).map((item) => item.name),
    [speciesQuery.data?.species]
  );
  const selectedSpecies = species || speciesOptions[0] || "";
  const speciesError = Boolean(speciesQuery.error) && !speciesQuery.data;

  const rankingUrl = selectedSpecies
    ? `/api/ranking?${new URLSearchParams({ tab: "guinness", period, species: selectedSpecies })}`
    : null;
  const rankingQuery = useSWR<RankingResponse>(rankingUrl);
  const records = (rankingQuery.data?.records || []).filter((record) => record.recordType === "size");

  const isLoading = speciesQuery.isLoading || (Boolean(selectedSpecies) && rankingQuery.isLoading);

  return (
    <Layout canGoBack showHome title="브리디북" seoTitle="브리디북">
      <p className="truncate px-4 pt-3 text-[13px] text-app-muted">
        심사를 통과한 공식 체장 기록만 올라갑니다
      </p>

      <div className="flex gap-2 overflow-x-auto px-4 pt-3 scrollbar-hide">
        {PERIOD_TABS.map((tab) => (
          <FilterChip
            key={tab.id}
            label={tab.name}
            selected={period === tab.id}
            onClick={() => setPeriod(tab.id)}
          />
        ))}
      </div>

      <div className="flex gap-2 overflow-x-auto px-4 pb-3 pt-2 scrollbar-hide">
        {speciesOptions.map((item) => (
          <FilterChip
            key={item}
            label={item}
            selected={selectedSpecies === item}
            onClick={() => setSpecies(item)}
          />
        ))}
        {!speciesQuery.isLoading && !speciesError && speciesOptions.length === 0 ? (
          <p className="text-[13px] leading-8 text-app-muted">표시할 공식 종이 없습니다.</p>
        ) : null}
      </div>

      {isLoading ? (
        <SkeletonRows />
      ) : speciesError ? (
        <QueryErrorState
          title="브리디북 종 목록을 불러오지 못했어요"
          onRetry={() => void speciesQuery.mutate()}
          className="py-14"
        />
      ) : rankingQuery.error && !rankingQuery.data ? (
        <QueryErrorState
          title="브리디북 기록을 불러오지 못했어요"
          onRetry={() => void rankingQuery.mutate()}
          className="py-14"
        />
      ) : records.length > 0 ? (
        <div>
          {records.map((record, index) => (
            <RecordRow
              key={record.id}
              rank={index + 1}
              photo={record.photo}
              species={record.species}
              breeder={record.user.name}
              value={record.value}
            />
          ))}
        </div>
      ) : (
        <div className="px-4 py-14 text-center">
          <p className="text-[16px] font-semibold text-app-text">등록된 공식 기록이 없습니다</p>
          <p className="mt-1.5 text-[14px] text-app-muted">첫 체장 기록을 등록해보세요.</p>
        </div>
      )}

      <BloodlineBottomBarSpacer />
      <BloodlineBottomBar>
        <BloodlinePrimaryButton href="/guinness/apply">기록 등록하기</BloodlinePrimaryButton>
      </BloodlineBottomBar>
    </Layout>
  );
}
