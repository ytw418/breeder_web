"use client";

import type { ReactNode } from "react";
import Toggle from "@components/app/Toggle";
import { cn } from "@libs/client/utils";
import {
  FOSTER_PERIOD_OPTIONS,
  FOSTER_SUPPORT_OPTIONS,
  PET_AGE_MAX_LENGTH,
  PET_HEALTH_OPTIONS,
  PET_POST_KINDS,
  PET_REASON_OPTIONS,
  PET_SEX_OPTIONS,
  fosterPeriodLabel,
  showsPetRegion,
  togglePetHealth,
  type PetInfo,
  type PetPostKind,
} from "@libs/shared/petSpace";

/** 오늘 날짜 'YYYY-MM-DD'(임보 날짜 고르기 최솟값). */
const todayIso = () => {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
};

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
        "h-9 shrink-0 whitespace-nowrap rounded-lg px-3 text-[14px] transition-colors disabled:opacity-50",
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

const toggleIn = <T extends string>(list: readonly T[] | undefined, id: T): T[] =>
  (list ?? []).includes(id) ? (list ?? []).filter((item) => item !== id) : [...(list ?? []), id];

/**
 * 가족 찾아요·임보 구해요 '내 동네 보이기'(앱 docs/prd/pet-space.md §5.9). 프로필 동네가 있으면 스위치(새 글은 켬)와
 * "서울 마포구 · 가까운 분이 찾기 쉬워요", 없으면 설정 안내 한 줄. 끄면 글에 동네를 남기지 않는다.
 */
function PetRegionRow({
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
 * 강아지·고양이 분양글 칸(앱 docs/prd/pet-space.md §5.5, 시안 pet-space/A-karrot.html ⑤).
 * '어떤 글인가요?' 3칸(분양해요·가족 찾아요·임보 구해요) + 안내 한 줄, 나이(짧은 글), 성별, 건강(여러 개),
 * 가족 찾아요면 보내는 이유, 임보 구해요면 임보 기간(날짜까지 → 날짜 칸)·지원(여러 개). 모두 선택 칸이다.
 * 가족 찾아요·임보 구해요는 맨 끝에 '내 동네 보이기'(region = 프로필 동네 "서울 마포구", 없으면 null).
 * 가격 칸은 없다(폼이 가격·거래 유형·혈통 칸을 숨긴다).
 */
export function PetPostFields({
  kind,
  onKindChange,
  info,
  onInfoChange,
  region,
  showRegion,
  onShowRegionChange,
  disabled,
}: {
  kind: PetPostKind;
  onKindChange: (kind: PetPostKind) => void;
  info: PetInfo;
  onInfoChange: (info: PetInfo) => void;
  region: string | null;
  showRegion: boolean;
  onShowRegionChange: (next: boolean) => void;
  disabled?: boolean;
}) {
  const update = (patch: Partial<PetInfo>) => onInfoChange({ ...info, ...patch });
  const hint = PET_POST_KINDS.find((item) => item.id === kind)?.hint ?? "";
  const dateLabel =
    info.fosterPeriod === "date" && info.fosterUntil ? fosterPeriodLabel(info) : null;

  return (
    <div className="flex flex-col gap-5" data-testid="pet-post-fields">
      <div>
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
                  "h-9 flex-1 rounded-md text-[14px] transition-colors",
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

      <div>
        <Label>나이</Label>
        <input
          value={info.age ?? ""}
          disabled={disabled}
          maxLength={PET_AGE_MAX_LENGTH}
          onChange={(event) => update({ age: event.target.value })}
          placeholder="예: 4개월쯤, 2살 추정"
          aria-label="나이"
          className="h-12 w-full rounded-lg border border-app-border bg-app-bg px-3.5 text-[16px] text-app-text placeholder:text-app-caption focus:border-app-text focus:outline-none focus:ring-0 disabled:opacity-50"
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
          <div>
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
                min={todayIso()}
                disabled={disabled}
                onChange={(event) => update({ fosterUntil: event.target.value || undefined })}
                aria-label="임보 끝나는 날"
                className="mt-2 h-12 w-full rounded-lg border border-app-border bg-app-bg px-3.5 text-[16px] text-app-text focus:border-app-text focus:outline-none focus:ring-0 disabled:opacity-50"
              />
            ) : null}
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

      {showsPetRegion(kind) ? (
        <PetRegionRow region={region} on={showRegion} onChange={onShowRegionChange} disabled={disabled} />
      ) : null}
    </div>
  );
}

export default PetPostFields;
