"use client";

import type { ReactNode } from "react";
import Toggle from "@components/app/Toggle";
import { cn } from "@libs/client/utils";
import {
  FOSTER_PERIOD_OPTIONS,
  FOSTER_SUPPORT_OPTIONS,
  NO_PRICE_CATEGORIES,
  PET_AGE_MAX_LENGTH,
  PET_HEALTH_OPTIONS,
  PET_POST_KINDS,
  PET_REASON_OPTIONS,
  PET_SEX_OPTIONS,
  fosterPeriodLabel,
  kstToday,
  showsPetRegion,
  togglePetHealth,
  type PetInfo,
  type PetPostKind,
} from "@libs/shared/petSpace";

function Label({ children, multi }: { children: ReactNode; multi?: boolean }) {
  return (
    <p className="mb-2 text-[15px] font-semibold text-app-text">
      {children}
      {multi ? <span className="font-normal text-app-muted"> · 여러 개</span> : null}
    </p>
  );
}

/** 누르는 칸을 위아래 4씩 늘린다(보이는 36 + 8 = 44, 2026-10-23 코덱스 디자인 리뷰). 줄 간격 8 이라 칸끼리 겹치지 않는다. */
const TOUCH_44 = "relative after:absolute after:inset-x-0 after:-inset-y-1";

/** 시안 .op: 높이 36 r8, 14/500 채움 칩. 고르면 검정 채움 + 흰 글자 600. */
function OptionChip({
  label,
  selected,
  disabled,
  onClick,
}: {
  label: string;
  selected: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "h-9 shrink-0 whitespace-nowrap rounded-lg px-3 text-[15px] transition-colors disabled:opacity-50",
        TOUCH_44,
        selected ? "bg-app-text font-semibold text-app-bg" : "bg-app-gap font-medium text-app-text"
      )}
    >
      {label}
    </button>
  );
}

function ChipWrap({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap gap-x-1.5 gap-y-2">{children}</div>;
}

/**
 * 한 줄 입력칸. 기본은 테두리 칸, filled 는 단계 글쓰기의 채움 칸(시안 pet-space/B-toss.html ④ — 회색 면, 누르면 테두리).
 * 앱 Input filled 와 같다.
 */
export function petInputClassName({ filled, error }: { filled?: boolean; error?: boolean } = {}) {
  return cn(
    "h-12 w-full rounded-lg border px-3.5 text-[16px] text-app-text placeholder:text-app-caption focus:border-app-text focus:outline-none focus:ring-0 disabled:opacity-50",
    filled ? "bg-app-gap" : "bg-app-bg",
    error ? "border-app-danger" : filled ? "border-transparent" : "border-app-border"
  );
}

const toggleIn = <T extends string>(list: readonly T[] | undefined, id: T): T[] =>
  (list ?? []).includes(id) ? (list ?? []).filter((item) => item !== id) : [...(list ?? []), id];

/**
 * 가족 찾아요·임보 구해요 '내 동네 보이기'(앱 docs/prd/pet-space.md §5.9). 프로필 동네가 있으면 스위치(새 글은 켬)와
 * "서울 마포구 · 가까운 분이 찾기 쉬워요", 없으면 설정 안내 한 줄. 끄면 글에 동네를 남기지 않는다.
 */
export function PetRegionRow({
  region,
  on,
  onChange,
  disabled,
}: {
  region: string | null;
  on: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
}) {
  if (!region) {
    return (
      <p className="break-keep text-[13px] leading-[18px] text-app-muted">
        설정 › 내 동네를 정하면 글에 동네를 보일 수 있어요
      </p>
    );
  }
  return (
    <div className="flex items-center justify-between" data-testid="pet-region-row">
      <div className="min-w-0">
        <p className="text-[15px] font-semibold text-app-text">내 동네 보이기</p>
        <p className="mt-0.5 break-keep text-[13px] leading-[18px] text-app-muted">
          {region} · 가까운 분이 찾기 쉬워요
        </p>
      </div>
      <Toggle checked={on} disabled={disabled} onChange={() => onChange(!on)} label="내 동네 보이기" />
    </div>
  );
}

/**
 * '어떤 글인가요?' 3칸(분양해요·가족 찾아요·임보 구해요) + 안내 한 줄. 강아지·고양이 글로 연 글쓰기는 폼이 이 칸을
 * 맨 위(사진 위)에 따로 두고, 그 밖엔 PetPostFields 첫 칸으로 둔다(시안 ⑤, 2026-10-23 코덱스 디자인 리뷰 결정 A).
 */
export function PetKindField({
  kind,
  onKindChange,
  disabled,
}: {
  kind: PetPostKind;
  onKindChange: (kind: PetPostKind) => void;
  disabled?: boolean;
}) {
  const hint = PET_POST_KINDS.find((item) => item.id === kind)?.hint ?? "";
  return (
    <div data-testid="pet-kind-field">
      <Label>어떤 글인가요?</Label>
      <div className="flex gap-1 rounded-lg bg-app-surface p-1" role="radiogroup" aria-label="어떤 글인가요?">
        {PET_POST_KINDS.map((item) => {
          const active = item.id === kind;
          return (
            <button
              key={item.id}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={disabled}
              onClick={() => onKindChange(item.id)}
              className={cn(
                "h-9 flex-1 rounded-md text-[15px] transition-colors",
                TOUCH_44,
                active
                  ? "bg-app-elevated font-semibold text-app-text shadow-card"
                  : "font-medium text-app-muted"
              )}
            >
              {item.label}
            </button>
          );
        })}
      </div>
      <p className="mt-1.5 text-[13px] leading-[18px] text-app-muted">{hint}</p>
    </div>
  );
}

/**
 * 강아지·고양이 분양글 칸(앱 docs/prd/pet-space.md §5.5, 시안 pet-space/A-karrot.html ⑤).
 * '어떤 글인가요?'(showKind 일 때, PetKindField), 나이(짧은 글), 성별, 건강(여러 개),
 * 가족 찾아요면 보내는 이유, 임보 구해요면 임보 기간(날짜까지 → 날짜 칸)·지원(여러 개). 임보 기간만 꼭 고르고(fosterError 가
 * 칸 아래 빨간 글자, 폼이 petInfoError 로 정한다) 나머지는 선택 칸이다.
 * 가족 찾아요·임보 구해요는 맨 끝에 '내 동네 보이기'(region = 프로필 동네 "서울 마포구", 없으면 null).
 * 가격 칸은 없다(폼이 가격·거래 유형·혈통 칸을 숨긴다).
 */
export function PetPostFields({
  kind,
  onKindChange,
  showKind = true,
  showRegionRow = true,
  filled,
  info,
  onInfoChange,
  fosterError,
  region,
  showRegion,
  onShowRegionChange,
  disabled,
}: {
  kind: PetPostKind;
  onKindChange: (kind: PetPostKind) => void;
  /** false 면 '어떤 글인가요?'를 빼고 그린다(폼이 맨 위에 PetKindField 를 따로 둘 때). */
  showKind?: boolean;
  /** false 면 '내 동네 보이기'를 빼고 그린다(단계 글쓰기는 ③에 따로 둔다). */
  showRegionRow?: boolean;
  /** 단계 글쓰기의 채움 입력칸(petInputClassName). */
  filled?: boolean;
  info: PetInfo;
  onInfoChange: (info: PetInfo) => void;
  /** 임보 기간·날짜 오류(petInfoError). 있으면 기간 칸 아래 빨간 글자. */
  fosterError?: string;
  region: string | null;
  showRegion: boolean;
  onShowRegionChange: (next: boolean) => void;
  disabled?: boolean;
}) {
  const update = (patch: Partial<PetInfo>) => onInfoChange({ ...info, ...patch });
  const dateLabel =
    info.fosterPeriod === "date" && info.fosterUntil ? fosterPeriodLabel(info) : null;

  return (
    <div className="flex flex-col gap-5" data-testid="pet-post-fields">
      {showKind ? <PetKindField kind={kind} onKindChange={onKindChange} disabled={disabled} /> : null}

      <div>
        <Label>나이</Label>
        <input
          value={info.age ?? ""}
          disabled={disabled}
          maxLength={PET_AGE_MAX_LENGTH}
          onChange={(event) => update({ age: event.target.value })}
          placeholder="예: 4개월쯤, 2살 추정"
          aria-label="나이"
          className={petInputClassName({ filled })}
        />
      </div>

      <div>
        <Label>성별</Label>
        <ChipWrap>
          {PET_SEX_OPTIONS.map((option) => (
            <OptionChip
              key={option.id}
              label={option.label}
              selected={info.sex === option.id}
              disabled={disabled}
              onClick={() => update({ sex: info.sex === option.id ? undefined : option.id })}
            />
          ))}
        </ChipWrap>
      </div>

      <div>
        <Label multi>건강</Label>
        <ChipWrap>
          {PET_HEALTH_OPTIONS.map((option) => (
            <OptionChip
              key={option.id}
              label={option.label}
              selected={(info.health ?? []).includes(option.id)}
              disabled={disabled}
              onClick={() => update({ health: togglePetHealth(info.health, option.id) })}
            />
          ))}
        </ChipWrap>
      </div>

      {kind === "rehoming" ? (
        <div>
          <Label>보내는 이유</Label>
          <ChipWrap>
            {PET_REASON_OPTIONS.map((option) => (
              <OptionChip
                key={option.id}
                label={option.label}
                selected={info.reason === option.id}
                disabled={disabled}
                onClick={() => update({ reason: info.reason === option.id ? undefined : option.id })}
              />
            ))}
          </ChipWrap>
        </div>
      ) : null}

      {kind === "foster" ? (
        <>
          <div data-field="petInfo">
            <Label>임보 기간</Label>
            <ChipWrap>
              {FOSTER_PERIOD_OPTIONS.map((option) => (
                <OptionChip
                  key={option.id}
                  label={option.id === "date" && dateLabel ? `날짜 고르기 · ${dateLabel}` : option.id === "date" ? "날짜 고르기" : option.label}
                  selected={info.fosterPeriod === option.id}
                  disabled={disabled}
                  onClick={() =>
                    update({
                      fosterPeriod: info.fosterPeriod === option.id ? undefined : option.id,
                      fosterUntil: option.id === "date" ? info.fosterUntil : undefined,
                    })
                  }
                />
              ))}
            </ChipWrap>
            {info.fosterPeriod === "date" ? (
              <input
                type="date"
                value={info.fosterUntil ?? ""}
                // 오늘(한국 시간)부터. 저장 검사(petInfoError)와 같은 날을 쓴다.
                min={kstToday()}
                disabled={disabled}
                onChange={(event) => update({ fosterUntil: event.target.value || undefined })}
                aria-label="임보 끝나는 날"
                aria-invalid={Boolean(fosterError)}
                className={cn(
                  "mt-2 h-12 w-full rounded-lg border bg-app-bg px-3.5 text-[16px] text-app-text focus:border-app-text focus:outline-none focus:ring-0 disabled:opacity-50",
                  fosterError ? "border-app-danger" : "border-app-border"
                )}
              />
            ) : null}
            {fosterError ? <p className="mt-1.5 text-[13px] text-app-danger">{fosterError}</p> : null}
          </div>
          <div>
            <Label multi>지원</Label>
            <ChipWrap>
              {FOSTER_SUPPORT_OPTIONS.map((option) => (
                <OptionChip
                  key={option.id}
                  label={option.label}
                  selected={(info.fosterSupport ?? []).includes(option.id)}
                  disabled={disabled}
                  onClick={() => update({ fosterSupport: toggleIn(info.fosterSupport, option.id) })}
                />
              ))}
            </ChipWrap>
          </div>
        </>
      ) : null}

      {showRegionRow && showsPetRegion(kind) ? (
        <PetRegionRow region={region} on={showRegion} onChange={onShowRegionChange} disabled={disabled} />
      ) : null}
    </div>
  );
}

/**
 * 단계 글쓰기 ②의 종 고르기(강아지·고양이 둘만). 입양 쪽에서 종을 정하지 않고 들어왔거나, 접힌 '카테고리 강아지 ›'를 눌러
 * 바꿀 때 보인다. 다른 종은 고를 수 없다 — 이 흐름은 강아지·고양이 글만 쓴다. 앱 PetPostFields.tsx 와 같다.
 */
export function PetSpeciesField({
  value,
  onChange,
  error,
  disabled,
}: {
  value: string;
  onChange: (species: (typeof NO_PRICE_CATEGORIES)[number]) => void;
  error?: string;
  disabled?: boolean;
}) {
  return (
    <div>
      <Label>카테고리</Label>
      <div role="radiogroup" aria-label="카테고리">
        <ChipWrap>
          {NO_PRICE_CATEGORIES.map((species) => (
            <OptionChip
              key={species}
              label={species}
              selected={value === species}
              disabled={disabled}
              onClick={() => onChange(species)}
            />
          ))}
        </ChipWrap>
      </div>
      {error ? <p className="mt-1.5 text-[13px] text-app-danger">{error}</p> : null}
    </div>
  );
}

export default PetPostFields;
