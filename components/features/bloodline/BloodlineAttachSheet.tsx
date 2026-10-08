"use client";

/**
 * 상품·경매 등록·수정의 "혈통 붙이기" 시트(시안 A2 #S5-attach, PRD S-7).
 * 제목 → 안내 13 muted → "내가 만든 혈통"(relation mine) / "받은 출처 카드"(relation received) 라디오 행 64
 * → 부모·누대 3칸 → "상세에 이렇게 보여요" 미리보기(BloodlineLinkRow preview) → "붙이기".
 * - 데이터: GET /api/bloodline-cards?mode=attach 의 attachable[](시트가 열려 있을 때만 부른다).
 * - 빈 상태: 만든 혈통이 없으면 "아직 만든 혈통이 없어요 / 혈통 만들기 ›" 행, 받은 출처 카드가 없으면 그 그룹을 그리지 않는다.
 * - 혈통을 고르기 전에는 3칸과 "붙이기"를 막는다. 칸 값이 규칙에 안 맞아도 "붙이기"를 막는다.
 * - 해제: 이미 붙인 값이 있으면 보조 버튼 "연결 안 함"을 둔다. 고른 행을 다시 누르면 선택이 풀린다.
 * - 수정 화면(current): 지금 붙은 혈통이 붙이기 목록에 없으면(그 뒤 혈통을 넘겼거나 출처 카드를 보냄) "지금 연결된 혈통"
 *   행으로 남겨 부모·누대를 고칠 수 있게 한다(같은 혈통 id 를 다시 보내면 서버는 권한을 다시 보지 않는다, 경매 currentRootId 와 같다).
 * - 열 때마다 바깥 값(value)으로 새로 시작한다(닫혀 있으면 아무것도 그리지 않는다).
 */
import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import useSWR from "swr";
import useUser from "hooks/useUser";
import { BottomSheet } from "@components/app/BottomSheet";
import { QueryErrorState } from "@components/app/QueryErrorState";
import {
  BloodlinePrimaryButton,
  BloodlineSecondaryButton,
  ChevronRightIcon,
} from "@components/features/bloodline/BloodlineScreenParts";
import { BloodlineLinkRow } from "@components/features/bloodline/BloodlineLinkRow";
import {
  PedigreeNoteFields,
  readPedigreeNoteInput,
} from "@components/features/bloodline/PedigreeNoteFields";
import {
  bloodlineUserPhrase,
  type AttachableBloodline,
  type BloodlineCardsResponse,
  type BloodlineLinkSummary,
} from "@libs/shared/bloodline-card";
import { pedigreeGenerationLabel, type PedigreeNote } from "@libs/shared/pedigree-note";
import { cn, makeImageUrl } from "@libs/client/utils";

export const BLOODLINE_ATTACH_KEY = "/api/bloodline-cards?mode=attach";
export const BLOODLINE_ATTACH_TITLE = "혈통 붙이기";
export const BLOODLINE_ATTACH_HELP = "내가 만들었거나 출처 카드를 받은 혈통만 붙일 수 있어요.";
export const BLOODLINE_CREATE_HREF = "/bloodline-cards/create";

/** 시트에 들고 들어오는 값. 붙이지 않았으면 rootId null, note {}. */
export interface BloodlineAttachValue {
  rootId: number | null;
  note: PedigreeNote;
}

/** "붙이기"/"연결 안 함" 결과. note 는 규칙으로 정리한 값({} 면 메모 없음), bloodline 은 고른 혈통(해제면 null). */
export interface BloodlineAttachResult extends BloodlineAttachValue {
  bloodline: AttachableBloodline | null;
}

/** 서버가 썸네일 이미지를 함께 줄 때를 대비한다(없으면 이미지 자리 아이콘). */
type AttachableRow = AttachableBloodline & { image?: string | null };

/** 행 부제: mine "왕사슴벌레" / received "왕사슴벌레 · 강산님에게서 받음". */
export function attachableSubtitle(
  item: Pick<AttachableBloodline, "speciesType" | "relation" | "receivedFrom" | "creator">
) {
  const species = item.speciesType?.trim() || "";
  if (item.relation !== "received") return species;
  const from = `${bloodlineUserPhrase(item.receivedFrom ?? item.creator)}에게서 받음`;
  return species ? `${species} · ${from}` : from;
}

/**
 * 고른 혈통 → 상세 혈통 행 요약(미리보기). mine 은 내가 만든 혈통이면 creator, 넘겨받은 혈통이면 holder 다.
 */
export function attachableToLinkSummary(
  item: AttachableBloodline,
  viewerId?: number | null
): BloodlineLinkSummary {
  const sellerRelation: BloodlineLinkSummary["sellerRelation"] =
    item.relation === "received"
      ? "received"
      : viewerId != null && item.creator.id === viewerId
        ? "creator"
        : "holder";
  return {
    id: item.rootId,
    name: item.name,
    speciesType: item.speciesType,
    originLabel: item.originLabel,
    creator: item.creator,
    sellerRelation,
    receivedAt: item.relation === "received" ? item.receivedAt ?? null : null,
  };
}

const formatMm = (value: number) => String(Math.round(value * 10) / 10);

/**
 * 등록 폼 "혈통" 행 오른쪽 값: "강산 라인 · F3 · 부 81.2mm · 모 47.5mm"(있는 값만, 누대 → 부 → 모).
 */
export function formatBloodlineAttachValue(name: string, note?: PedigreeNote | null) {
  const parts = [name];
  if (note?.generation) parts.push(pedigreeGenerationLabel(note.generation));
  if (typeof note?.sireMm === "number") parts.push(`부 ${formatMm(note.sireMm)}mm`);
  if (typeof note?.damMm === "number") parts.push(`모 ${formatMm(note.damMm)}mm`);
  return parts.join(" · ");
}

function ImagePlaceholderIcon() {
  return (
    <svg width={20} height={20} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x={3.5} y={4.5} width={17} height={15} rx={2.5} stroke="currentColor" strokeWidth={1.5} />
      <circle cx={9} cy={10} r={1.6} stroke="currentColor" strokeWidth={1.5} />
      <path
        d="M4 17l4.5-4.5 4 3.5 3-2.5L20 17"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** 라디오 22: 1.5px muted 테두리, 고르면 text 테두리 + 안쪽 10 점. */
function RadioMark({ checked }: { checked: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "grid h-[22px] w-[22px] shrink-0 place-items-center rounded-full border-[1.5px]",
        checked ? "border-app-text" : "border-app-muted"
      )}
    >
      {checked ? <span className="h-2.5 w-2.5 rounded-full bg-app-text" /> : null}
    </span>
  );
}

function AttachableRowButton({
  item,
  checked,
  onToggle,
}: {
  item: AttachableRow;
  checked: boolean;
  onToggle: () => void;
}) {
  const subtitle = attachableSubtitle(item);
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      onClick={onToggle}
      className="flex h-16 w-full items-center gap-3 px-4 text-left transition-colors hover:bg-app-surface"
    >
      <span className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-[10px] bg-app-placeholder text-app-caption">
        {item.image ? (
          <Image
            src={makeImageUrl(item.image, "product")}
            alt=""
            width={44}
            height={44}
            className="h-full w-full object-cover"
          />
        ) : (
          <ImagePlaceholderIcon />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[16px] leading-[22px] tracking-[-0.3px] text-app-text">
          {item.name}
        </span>
        {subtitle ? (
          <span className="block truncate text-[13px] leading-[18px] text-app-muted">{subtitle}</span>
        ) : null}
      </span>
      <RadioMark checked={checked} />
    </button>
  );
}

function GroupLabel({ children, className }: { children: string; className?: string }) {
  return (
    <p className={cn("px-4 text-[13px] leading-[18px] text-app-muted", className)}>{children}</p>
  );
}

function SkeletonRows() {
  return (
    <div aria-hidden="true" data-testid="bloodline-attach-skeleton">
      {[0, 1].map((key) => (
        <div key={key} className="flex h-16 items-center gap-3 px-4">
          <span className="h-11 w-11 shrink-0 animate-pulse rounded-[10px] bg-app-placeholder" />
          <span className="flex min-w-0 flex-1 flex-col gap-1.5">
            <span className="h-4 w-32 animate-pulse rounded bg-app-placeholder" />
            <span className="h-3 w-44 animate-pulse rounded bg-app-placeholder" />
          </span>
        </div>
      ))}
    </div>
  );
}

export interface BloodlineAttachSheetProps {
  open: boolean;
  onClose: () => void;
  value: BloodlineAttachValue;
  /** "붙이기" 또는 "연결 안 함". 시트를 닫는 것은 부모가 한다. */
  onApply: (result: BloodlineAttachResult) => void;
  /** 수정 화면: 지금 붙어 있는 혈통의 서버 요약(상세 응답 bloodline). 붙이기 목록에 없으면 행으로 남긴다. */
  current?: BloodlineLinkSummary | null;
}

/** 지금 붙은 혈통 요약 → 시트 행. 판매자 관계는 미리보기에서 요약 값을 그대로 쓴다. */
const currentToAttachable = (current: BloodlineLinkSummary): AttachableRow => ({
  rootId: current.id,
  name: current.name,
  speciesType: current.speciesType,
  originLabel: current.originLabel,
  creator: current.creator,
  relation: "mine",
});

export function BloodlineAttachSheet(props: BloodlineAttachSheetProps) {
  // 닫혀 있으면 상태째 내려 둬서, 다시 열 때 바깥 값으로 새로 시작한다.
  if (!props.open) return null;
  return <BloodlineAttachSheetBody {...props} />;
}

function BloodlineAttachSheetBody({
  open,
  onClose,
  value,
  onApply,
  current,
}: BloodlineAttachSheetProps) {
  const { user } = useUser();
  const { data, error, mutate } = useSWR<BloodlineCardsResponse>(BLOODLINE_ATTACH_KEY);
  const [selectedRootId, setSelectedRootId] = useState<number | null>(value.rootId);
  const [note, setNote] = useState<PedigreeNote>(value.note ?? {});

  const items = useMemo<AttachableRow[]>(() => data?.attachable ?? [], [data]);
  const mine = items.filter((item) => item.relation === "mine");
  const received = items.filter((item) => item.relation === "received");
  // 지금 붙은 혈통이 목록에 없을 때만(목록을 받은 뒤) 따로 보인다
  const currentRow =
    current && data && !items.some((item) => item.rootId === current.id)
      ? currentToAttachable(current)
      : null;
  const selected =
    items.find((item) => item.rootId === selectedRootId) ??
    (currentRow && currentRow.rootId === selectedRootId ? currentRow : null);
  const selectedIsCurrent = Boolean(currentRow && selected === currentRow);
  const noteInput = readPedigreeNoteInput(note);
  const noteValid = noteInput !== "invalid";
  const initiallyAttached = value.rootId != null;

  const isError = Boolean(error) && !data;
  const isBusy = !data && !error;

  const toggle = (rootId: number) =>
    setSelectedRootId((prev) => (prev === rootId ? null : rootId));

  const apply = () => {
    if (!selected || noteInput === "invalid") return;
    onApply({ rootId: selected.rootId, note: noteInput ?? {}, bloodline: selected });
  };
  const detach = () => onApply({ rootId: null, note: {}, bloodline: null });

  const footer = (
    <div className="flex gap-2">
      {initiallyAttached ? (
        <BloodlineSecondaryButton onClick={detach}>연결 안 함</BloodlineSecondaryButton>
      ) : null}
      {selected || !initiallyAttached ? (
        <BloodlinePrimaryButton onClick={apply} disabled={!selected || !noteValid}>
          붙이기
        </BloodlinePrimaryButton>
      ) : null}
    </div>
  );

  return (
    <BottomSheet open={open} onClose={onClose} title={BLOODLINE_ATTACH_TITLE} footer={footer}>
      <p className="px-4 pt-1.5 text-[13px] leading-[18px] text-app-muted">{BLOODLINE_ATTACH_HELP}</p>

      {isError ? (
        <QueryErrorState onRetry={() => void mutate()} />
      ) : (
        <div role="radiogroup" aria-label={BLOODLINE_ATTACH_TITLE}>
          {currentRow ? (
            <>
              <GroupLabel className="pt-4">지금 연결된 혈통</GroupLabel>
              <AttachableRowButton
                item={currentRow}
                checked={currentRow.rootId === selectedRootId}
                onToggle={() => toggle(currentRow.rootId)}
              />
              <div className="mx-4 h-px bg-app-line" />
            </>
          ) : null}
          <GroupLabel className={currentRow ? "pt-3" : "pt-4"}>내가 만든 혈통</GroupLabel>
          {isBusy ? (
            <SkeletonRows />
          ) : mine.length ? (
            mine.map((item) => (
              <AttachableRowButton
                key={item.rootId}
                item={item}
                checked={item.rootId === selectedRootId}
                onToggle={() => toggle(item.rootId)}
              />
            ))
          ) : (
            <Link
              href={BLOODLINE_CREATE_HREF}
              className="flex h-12 items-center gap-1 pl-4 pr-3 transition-colors hover:bg-app-surface"
            >
              <span className="flex-1 text-[14px] text-app-muted">아직 만든 혈통이 없어요</span>
              <span className="text-[14px] font-semibold text-app-text">혈통 만들기</span>
              <ChevronRightIcon className="h-[18px] w-[18px] shrink-0 text-app-caption" />
            </Link>
          )}
          {!isBusy && received.length ? (
            <>
              <div className="mx-4 h-px bg-app-line" />
              <GroupLabel className="pt-3">받은 출처 카드</GroupLabel>
              {received.map((item) => (
                <AttachableRowButton
                  key={item.rootId}
                  item={item}
                  checked={item.rootId === selectedRootId}
                  onToggle={() => toggle(item.rootId)}
                />
              ))}
            </>
          ) : null}
        </div>
      )}

      <PedigreeNoteFields
        value={note}
        onChange={setNote}
        disabled={!selected}
        className="px-4 pt-3"
      />

      {selected ? (
        <>
          <GroupLabel className="pb-2 pt-4">상세에 이렇게 보여요</GroupLabel>
          <BloodlineLinkRow
            bloodline={
              selectedIsCurrent && current ? current : attachableToLinkSummary(selected, user?.id)
            }
            pedigreeNote={noteValid ? noteInput : null}
            preview
          />
        </>
      ) : null}
    </BottomSheet>
  );
}

export default BloodlineAttachSheet;
