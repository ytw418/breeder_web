"use client";

import { useMemo, useState, type ReactNode } from "react";
import useSWR from "swr";

import BottomSheet from "@components/app/BottomSheet";
import { cn } from "@libs/client/utils";
import type { ProductsResponse } from "@libs/shared/home";
import {
  SHELTER_SIZES,
  SHELTER_SORTS,
  shelterFiltersToQuery,
  type ShelterCategory,
  type ShelterFacetsResponse,
  type ShelterFilters,
  type ShelterSizeId,
  type ShelterSortId,
} from "@libs/shared/shelterFilters";

/**
 * 보호소 아이들 필터 시트 넷: 지역 · 품종 · 크기 · 정렬(앱 design/mockups/adoption-v2/A-karrot.html (b)(c)).
 * 시트마다 지금 값에서 시작하는 '초안'을 들고 있다가 'N마리 보기'를 눌러야 목록에 들어가고, 그냥 닫으면 버린다(정렬만 누르면 바로 적용).
 * 'N마리'는 초안 조건으로 목록 API 를 한 번 불러 얻은 total 이다(다른 필터와 겹친 조건도 정확하다).
 * 숫자 칩(시/도·시·군·구·품종)은 shelter-facets 의 공고 수다.
 */

const fmt = (n: number) => n.toLocaleString("ko-KR");

/** 필터 시트 숫자용 집계 주소. */
export function shelterFacetsUrl(options: { category?: ShelterCategory; sido?: string } = {}): string {
  const params = new URLSearchParams();
  if (options.category) params.set("category", options.category);
  if (options.sido) params.set("sido", options.sido);
  const query = params.toString();
  return `/api/products/shelter-facets${query ? `?${query}` : ""}`;
}

/** 보호소 목록 API 쿼리(주소의 필터 + 범위). 쪽 크기는 size, 크기 필터는 dogSize. */
export function shelterListParams(filters: ShelterFilters, categoryPath: string, extra: Record<string, string>) {
  return new URLSearchParams({ categoryPath, source: "shelter", ...extra, ...shelterFiltersToQuery(filters) });
}

/** 초안 조건에 맞는 아이 수. 모르는 동안은 undefined(이전 값을 붙들고 있는다). */
function useShelterCount(draft: ShelterFilters, categoryPath: string): number | undefined {
  const key = `/api/products?${shelterListParams({ ...draft, sort: undefined }, categoryPath, { page: "1", size: "1" }).toString()}`;
  const { data } = useSWR<ProductsResponse>(key, { revalidateOnFocus: false, keepPreviousData: true });
  return data?.total;
}

function SheetHeader({ title, sub, onClose }: { title: ReactNode; sub?: string; onClose: () => void }) {
  return (
    <div className="flex shrink-0 items-center justify-between pb-2 pl-4 pr-2 pt-1">
      <div className="min-w-0">
        <h2 className="text-[18px] font-bold leading-[26px] tracking-[-0.4px] text-app-text">{title}</h2>
        {sub ? <p className="mt-px text-[13px] leading-[18px] text-app-muted">{sub}</p> : null}
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="닫기"
        className="flex h-10 w-10 shrink-0 items-center justify-center text-app-text"
      >
        <svg width={24} height={24} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}

/** 아래 줄: 회색 '초기화' 96 + 주황 'N마리 보기'(52, 16/600). */
function SheetActions({ count, onReset, onApply }: { count: number | undefined; onReset: () => void; onApply: () => void }) {
  return (
    <div className="flex gap-2">
      <button
        type="button"
        onClick={onReset}
        className="h-[52px] w-24 shrink-0 whitespace-nowrap rounded-lg bg-app-surface text-[16px] font-semibold text-app-text"
      >
        초기화
      </button>
      <button
        type="button"
        onClick={onApply}
        className="h-[52px] flex-1 whitespace-nowrap rounded-lg bg-app-brand text-[16px] font-semibold text-white"
      >
        {count === undefined ? "보기" : `${fmt(count)}마리 보기`}
      </button>
    </div>
  );
}

const FOOTER_CLASS = "border-t border-app-line px-4 pb-4 pt-2";

function Check({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "ml-auto grid h-[22px] w-[22px] shrink-0 place-items-center rounded-md border-[1.5px]",
        on ? "border-app-brand bg-app-brand text-white" : "border-app-caption"
      )}
    >
      {on ? (
        <svg width={14} height={14} viewBox="0 0 24 24" fill="none">
          <path d="m6 12.5 4 4 8-9" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : null}
    </span>
  );
}

// ── 지역 ─────────────────────────────────────────────────────────

/** 왼쪽 시/도(공고 많은 순, 숫자는 공고 수, 고른 시/도는 주황 점) · 오른쪽 시·군·구는 여러 곳 선택. */
export function ShelterRegionSheet({
  category,
  filters,
  categoryPath,
  onApply,
  onClose,
}: {
  category?: ShelterCategory;
  filters: ShelterFilters;
  categoryPath: string;
  onApply: (next: Pick<ShelterFilters, "sido" | "sigungu">) => void;
  onClose: () => void;
}) {
  const [sido, setSido] = useState<string | null>(filters.sido?.[0] ?? null);
  const [sigungu, setSigungu] = useState<string[]>(filters.sigungu ?? []);
  const base = useSWR<ShelterFacetsResponse>(shelterFacetsUrl({ category }), { revalidateOnFocus: false });
  const detail = useSWR<ShelterFacetsResponse>(sido ? shelterFacetsUrl({ category, sido }) : null, {
    revalidateOnFocus: false,
  });
  const count = useShelterCount(
    { ...filters, sido: sido ? [sido] : undefined, sigungu: sido && sigungu.length ? sigungu : undefined },
    categoryPath
  );
  const sidoItem = base.data?.sido.find((item) => item.name === sido);
  const detailReady = Boolean(sido) && detail.data !== undefined;

  const pickSido = (next: string | null) => {
    if (next === sido) return;
    setSido(next);
    setSigungu([]);
  };
  const toggleSigungu = (name: string) =>
    setSigungu((prev) => (prev.includes(name) ? prev.filter((item) => item !== name) : [...prev, name]));

  return (
    <BottomSheet
      open
      onClose={onClose}
      ariaLabel="지역"
      className="h-[min(700px,85vh)]"
      footerClassName={FOOTER_CLASS}
      footer={
        <SheetActions
          count={count}
          onReset={() => pickSido(null)}
          onApply={() => {
            onApply({ sido: sido ? [sido] : undefined, sigungu: sido && sigungu.length ? sigungu : undefined });
            onClose();
          }}
        />
      }
    >
      <div className="flex h-full min-h-0 flex-col">
        <SheetHeader title="지역" sub="공고가 많은 시/도부터 보여요 · 시·군·구는 여러 곳 선택" onClose={onClose} />
        <div className="flex min-h-0 flex-1 overflow-hidden border-t border-app-line">
          <div className="w-[136px] shrink-0 overflow-y-auto bg-app-gap" role="listbox" aria-label="시/도">
            <button
              type="button"
              role="option"
              aria-selected={!sido}
              onClick={() => pickSido(null)}
              className={cn(
                "flex h-12 w-full items-center justify-between px-3.5 text-left text-[15px]",
                !sido ? "bg-app-bg font-bold text-app-text" : "font-medium text-app-sub"
              )}
            >
              <span>전국</span>
              <small className="text-[12px] font-medium text-app-muted">{base.data ? fmt(base.data.total) : ""}</small>
            </button>
            {(base.data?.sido ?? []).map((item) => {
              const on = item.name === sido;
              return (
                <button
                  key={item.name}
                  type="button"
                  role="option"
                  aria-selected={on}
                  onClick={() => pickSido(item.name)}
                  className={cn(
                    "flex h-12 w-full items-center justify-between px-3.5 text-left text-[15px]",
                    on ? "bg-app-bg font-bold text-app-text" : "font-medium text-app-sub"
                  )}
                >
                  <span className="flex items-center gap-[5px]">
                    {item.short}
                    {on ? <i aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-app-brand" /> : null}
                  </span>
                  <small className="text-[12px] font-medium text-app-muted">{fmt(item.count)}</small>
                </button>
              );
            })}
          </div>
          <div className="min-w-0 flex-1 overflow-y-auto">
            {sido ? (
              <>
                <button
                  type="button"
                  aria-pressed={sigungu.length === 0}
                  onClick={() => setSigungu([])}
                  className="flex h-12 w-full items-center gap-1.5 border-b border-app-gap px-4 text-left text-[15px] font-semibold text-app-text"
                >
                  {sidoItem?.short ?? sido} 전체
                  {sidoItem ? <small className="text-[13px] font-normal text-app-muted">{fmt(sidoItem.count)}</small> : null}
                  <Check on={sigungu.length === 0} />
                </button>
                {detailReady
                  ? detail.data!.sigungu.map((item) => {
                      const on = sigungu.includes(item.name);
                      return (
                        <button
                          key={item.name}
                          type="button"
                          role="checkbox"
                          aria-checked={on}
                          onClick={() => toggleSigungu(item.name)}
                          className="flex h-12 w-full items-center gap-1.5 border-b border-app-gap px-4 text-left text-[15px] text-app-text"
                        >
                          {item.name}
                          <small className="text-[13px] text-app-muted">{fmt(item.count)}</small>
                          <Check on={on} />
                        </button>
                      );
                    })
                  : [0, 1, 2, 3, 4].map((i) => (
                      <div key={i} className="m-3 h-5 animate-pulse rounded bg-app-placeholder" aria-hidden="true" />
                    ))}
              </>
            ) : (
              <p className="px-4 py-6 text-[14px] leading-5 text-app-muted">
                전국의 공고를 모두 보여 드려요. 지역을 좁히려면 왼쪽에서 시/도를 골라 주세요.
              </p>
            )}
          </div>
        </div>
      </div>
    </BottomSheet>
  );
}

// ── 품종 ─────────────────────────────────────────────────────────

const SPECIES: ShelterCategory[] = ["강아지", "고양이"];

/**
 * 칩 여러 개 선택(숫자는 공고 수) + 품종 이름 검색. 전체 칩일 때만 위에 강아지/고양이 전환이 있다
 * (한 종 칩이면 그 종 품종만 — 다른 종 품종을 골라도 결과가 없어서).
 */
export function ShelterBreedSheet({
  category,
  filters,
  categoryPath,
  onApply,
  onClose,
}: {
  category?: ShelterCategory;
  filters: ShelterFilters;
  categoryPath: string;
  onApply: (next: Pick<ShelterFilters, "breed">) => void;
  onClose: () => void;
}) {
  const [segment, setSegment] = useState<ShelterCategory>(category ?? "강아지");
  const [draft, setDraft] = useState<string[]>(filters.breed ?? []);
  const [query, setQuery] = useState("");
  const dog = useSWR<ShelterFacetsResponse>(
    !category || category === "강아지" ? shelterFacetsUrl({ category: "강아지" }) : null,
    { revalidateOnFocus: false }
  );
  const cat = useSWR<ShelterFacetsResponse>(
    !category || category === "고양이" ? shelterFacetsUrl({ category: "고양이" }) : null,
    { revalidateOnFocus: false }
  );
  const active = (category ?? segment) === "강아지" ? dog : cat;
  const count = useShelterCount({ ...filters, breed: draft.length ? draft : undefined }, categoryPath);
  const visible = useMemo(() => {
    const needle = query.trim().replace(/\s+/g, "");
    const list = active.data?.breed ?? [];
    return needle ? list.filter((item) => item.name.replace(/\s+/g, "").includes(needle)) : list;
  }, [active.data, query]);
  const toggle = (name: string) =>
    setDraft((prev) => (prev.includes(name) ? prev.filter((item) => item !== name) : [...prev, name]));

  return (
    <BottomSheet
      open
      onClose={onClose}
      ariaLabel="품종"
      className="h-[min(640px,85vh)]"
      footerClassName={FOOTER_CLASS}
      footer={
        <SheetActions
          count={count}
          onReset={() => setDraft([])}
          onApply={() => {
            onApply({ breed: draft.length ? draft : undefined });
            onClose();
          }}
        />
      }
    >
      <div className="flex h-full min-h-0 flex-col">
        <SheetHeader
          title={
            <>
              품종
              {draft.length ? (
                <span className="ml-1.5 text-[13px] font-medium tracking-[-0.2px] text-app-muted">{draft.length}개 선택</span>
              ) : null}
            </>
          }
          onClose={onClose}
        />
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-5 pt-1">
          {!category ? (
            <div role="tablist" aria-label="종" className="flex rounded-[10px] bg-app-surface p-[3px]">
              {SPECIES.map((species) => {
                const on = segment === species;
                const total = (species === "강아지" ? dog : cat).data?.total;
                return (
                  <button
                    key={species}
                    type="button"
                    role="tab"
                    aria-selected={on}
                    onClick={() => setSegment(species)}
                    className={cn(
                      "flex h-9 flex-1 items-center justify-center gap-1 rounded-lg border text-[14px]",
                      on
                        ? "border-app-border bg-app-bg font-bold text-app-text"
                        : "border-transparent font-medium text-app-muted"
                    )}
                  >
                    {species}
                    {total !== undefined ? <small className="text-[13px] font-medium">{fmt(total)}</small> : null}
                  </button>
                );
              })}
            </div>
          ) : null}
          <label className="mt-2.5 flex h-10 items-center gap-2 rounded-lg bg-app-surface px-3 text-[14px] text-app-muted">
            <svg width={18} height={18} viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="11" cy="11" r="6" stroke="currentColor" strokeWidth={1.5} />
              <path d="m20 20-4.5-4.5" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" />
            </svg>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="품종 이름으로 찾기"
              aria-label="품종 이름으로 찾기"
              className="min-w-0 flex-1 bg-transparent text-[14px] text-app-text outline-none placeholder:text-app-muted"
            />
          </label>
          <div className="mt-4 flex flex-wrap gap-2">
            {active.data
              ? visible.map((item) => {
                  const on = draft.includes(item.name);
                  return (
                    <button
                      key={item.name}
                      type="button"
                      aria-pressed={on}
                      onClick={() => toggle(item.name)}
                      className={cn(
                        "flex h-9 items-center gap-[5px] rounded-full border px-3.5 text-[15px]",
                        on
                          ? "border-app-text bg-app-text font-semibold text-app-bg"
                          : "border-app-border bg-app-bg font-medium text-app-text"
                      )}
                    >
                      {item.name}
                      <i className={cn("text-[13px] font-medium not-italic", on ? "opacity-70" : "text-app-muted")}>
                        {fmt(item.count)}
                      </i>
                    </button>
                  );
                })
              : [0, 1, 2, 3, 4, 5].map((i) => (
                  <span key={i} className="h-9 w-20 animate-pulse rounded-full bg-app-placeholder" aria-hidden="true" />
                ))}
          </div>
          {active.data && visible.length === 0 ? (
            <p className="py-8 text-center text-[14px] text-app-muted">
              {query.trim() ? "찾는 품종이 없어요" : "품종 정보가 있는 아이가 아직 없어요"}
            </p>
          ) : null}
        </div>
      </div>
    </BottomSheet>
  );
}

// ── 크기 ─────────────────────────────────────────────────────────

const SIZE_HINT: Record<ShelterSizeId, string> = { small: "7kg 이하", medium: "7kg 초과 15kg 이하", large: "15kg 초과" };

/** 소형·중형·대형 중 하나(강아지만). 한 번 더 누르면 풀린다. */
export function ShelterSizeSheet({
  filters,
  categoryPath,
  onApply,
  onClose,
}: {
  filters: ShelterFilters;
  categoryPath: string;
  onApply: (next: Pick<ShelterFilters, "size">) => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<ShelterSizeId | undefined>(filters.size);
  const count = useShelterCount({ ...filters, size: draft }, categoryPath);
  return (
    <BottomSheet
      open
      onClose={onClose}
      ariaLabel="크기"
      footerClassName={FOOTER_CLASS}
      footer={
        <SheetActions
          count={count}
          onReset={() => setDraft(undefined)}
          onApply={() => {
            onApply({ size: draft });
            onClose();
          }}
        />
      }
    >
      <SheetHeader title="크기" sub="몸무게로 나눠요 · 강아지만 있어요" onClose={onClose} />
      <div role="radiogroup" aria-label="크기" className="px-4 pb-2">
        {SHELTER_SIZES.map((size) => {
          const on = draft === size.id;
          return (
            <button
              key={size.id}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => setDraft(on ? undefined : size.id)}
              className="flex h-14 w-full items-center justify-between text-left"
            >
              <span className={cn("text-[16px] leading-[22px] text-app-text", on ? "font-semibold" : "font-normal")}>
                {size.label}
                <small className="ml-2 text-[13px] font-normal text-app-muted">{SIZE_HINT[size.id]}</small>
              </span>
              {on ? <Tick /> : null}
            </button>
          );
        })}
      </div>
    </BottomSheet>
  );
}

function Tick() {
  return (
    <svg width={22} height={22} viewBox="0 0 24 24" fill="none" aria-hidden="true" className="text-app-brand">
      <path d="m6 12.5 4 4 8-9" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ── 정렬 ─────────────────────────────────────────────────────────

/** 최신 공고 · 마감 임박. 누르면 바로 적용하고 닫는다. */
export function ShelterSortSheet({
  sort,
  onApply,
  onClose,
}: {
  sort: ShelterSortId;
  onApply: (next: ShelterSortId) => void;
  onClose: () => void;
}) {
  return (
    <BottomSheet open onClose={onClose} ariaLabel="정렬">
      <SheetHeader title="정렬" onClose={onClose} />
      <div role="radiogroup" aria-label="정렬 기준" className="px-4 pb-4">
        {SHELTER_SORTS.map((item) => {
          const on = sort === item.id;
          return (
            <button
              key={item.id}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => {
                onApply(item.id);
                onClose();
              }}
              className={cn(
                "flex h-14 w-full items-center justify-between text-left text-[16px] leading-[22px] text-app-text",
                on ? "font-semibold" : "font-normal"
              )}
            >
              {item.label}
              {on ? <Tick /> : null}
            </button>
          );
        })}
      </div>
    </BottomSheet>
  );
}
