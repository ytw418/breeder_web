"use client";

import Link from "next/link";
import useSWR from "swr";
import Layout from "@components/features/MainLayout";
import Image from "@components/atoms/Image";
import { cn, makeImageUrl } from "@libs/client/utils";
import { RankingResponse } from "pages/api/ranking";
import { GuinnessSpeciesListResponse } from "pages/api/guinness/species";
import { useEffect, useMemo, useState } from "react";

const PERIOD_TABS = [
  { id: "all", name: "역대" },
  { id: "monthly", name: "이번 달" },
  { id: "yearly", name: "올해" },
] as const;

const getMedalClass = (rank: number) => {
  if (rank === 1) return "bg-yellow-400 text-white";
  if (rank === 2) return "bg-gray-400 text-white";
  if (rank === 3) return "bg-amber-700 text-white";
  return "bg-gray-100 text-gray-600";
};

export default function GuinnessClient() {
  const [period, setPeriod] = useState<(typeof PERIOD_TABS)[number]["id"]>("all");
  const [species, setSpecies] = useState("");

  const apiUrl = useMemo(() => {
    if (!species) return null;
    const query = new URLSearchParams({ tab: "guinness", period, species });
    return `/api/ranking?${query.toString()}`;
  }, [period, species]);

  const { data } = useSWR<RankingResponse>(apiUrl);
  const { data: speciesData } =
    useSWR<GuinnessSpeciesListResponse>("/api/guinness/species?limit=100");

  const speciesOptions = useMemo(
    () => (speciesData?.species || []).map((item) => item.name),
    [speciesData?.species]
  );

  useEffect(() => {
    if (!species && speciesOptions.length > 0) {
      setSpecies(speciesOptions[0]);
    }
  }, [species, speciesOptions]);

  const records = data?.records || [];
  const sizeRecords = records.filter((record) => record.recordType === "size");

  return (
    <Layout canGoBack title="브리더북" seoTitle="브리더북" showHome>
      <div className="app-page pb-20">
        <section className="px-4 pt-5 app-reveal">
          <div className="app-card bg-gradient-to-r from-amber-500 to-orange-500 p-5 text-white border-transparent">
            <p className="text-xs font-semibold text-white/80">Breeder Records</p>
            <h1 className="mt-1 text-2xl font-bold">브리더북 체장 랭킹</h1>
            <p className="mt-2 text-sm leading-relaxed text-white/95">
              당신의 체장 기록을 등록하세요. 본 페이지의 기록은 심사 절차를 통과한
              데이터만 노출되며 공식적으로 인정된 기록입니다.
            </p>
            <Link
              href="/guinness/apply"
              className="app-card-interactive mt-4 inline-flex h-10 items-center rounded-lg bg-white px-4 text-sm font-semibold text-amber-700"
            >
              브리더북 등록하기
            </Link>
          </div>
        </section>

        <section className="px-4 pt-5 space-y-3 app-reveal app-reveal-1">
          <div className="app-card p-2.5 space-y-2.5">
          <div className="flex gap-2">
            {PERIOD_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setPeriod(tab.id)}
                className={cn(
                  "app-chip rounded-full px-3 py-1.5 text-xs",
                  period === tab.id
                    ? "app-chip-active"
                    : "app-chip-muted bg-white"
                )}
              >
                {tab.name}
              </button>
            ))}
          </div>

          <div className="app-rail flex gap-2 snap-none">
            {speciesOptions.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setSpecies(item)}
                className={cn(
                  "app-chip shrink-0 rounded-full px-3 py-1.5 text-xs",
                  species === item
                    ? "border-primary bg-primary text-white"
                    : "app-chip-muted bg-white"
                )}
              >
                {item}
              </button>
            ))}
          </div>
          </div>
        </section>

        <section className="px-4 pt-4 app-reveal app-reveal-2">
          {data ? (
            sizeRecords.length > 0 ? (
              <div className="space-y-2">
                {sizeRecords.map((record, index) => (
                  <div
                    key={record.id}
                    className="app-card app-card-interactive p-3"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`w-7 h-7 rounded-full text-xs font-bold flex items-center justify-center ${getMedalClass(
                          index + 1
                        )}`}
                      >
                        {index + 1}
                      </span>
                      <div className="h-12 w-12 overflow-hidden rounded-lg bg-slate-100">
                        <Image
                          src={makeImageUrl(record.photo, "avatar")}
                          className="h-full w-full object-cover"
                          width={48}
                          height={48}
                          alt=""
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-slate-900">{record.species}</p>
                        <p className="text-xs text-slate-500">{record.user.name}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-primary leading-none">
                          {record.value}
                          <span className="ml-1 text-xs font-normal text-slate-400">mm</span>
                        </p>
                        <p className="mt-1 text-xs text-slate-400">
                          체장
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="app-card border-dashed px-4 py-12 text-center">
                <p className="text-sm font-medium text-slate-600">
                  조건에 맞는 공식 기록이 아직 없습니다.
                </p>
                <Link
                  href="/guinness/apply"
                  className="mt-3 inline-flex h-9 items-center rounded-md bg-primary px-3 text-xs font-semibold text-white"
                >
                  첫 체장 기록 등록하기
                </Link>
              </div>
            )
          ) : (
            <div className="space-y-2">
              {[...Array(6)].map((_, index) => (
                <div
                  key={index}
                  className="rounded-xl border border-gray-100 bg-white p-3 shadow-sm animate-pulse"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-7 w-7 rounded-full bg-gray-200" />
                    <div className="h-12 w-12 rounded-lg bg-gray-200" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3 w-24 rounded bg-gray-200" />
                      <div className="h-3 w-16 rounded bg-gray-200" />
                    </div>
                    <div className="space-y-1.5 text-right">
                      <div className="h-4 w-12 rounded bg-gray-200" />
                      <div className="h-3 w-8 rounded bg-gray-200" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <div className="fixed bottom-[88px] left-1/2 z-20 w-full max-w-screen-sm -translate-x-1/2 px-4">
          <Link
            href="/guinness/apply"
            className="app-card-interactive flex h-12 w-full items-center justify-center rounded-xl bg-slate-900 text-sm font-semibold text-white shadow-lg"
          >
            브리더북 등록하기
          </Link>
        </div>
      </div>
    </Layout>
  );
}
