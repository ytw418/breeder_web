"use client";

/**
 * 경매의 혈통 부품(설계 §4.3, PRD S-6·S-7 웹).
 * - 등록·수정: 네이티브 select 는 웹 톤대로 유지하고, 옵션은 `?mode=attach` 의 attachable[](내가 보유한 혈통 +
 *   출처 카드를 받은 혈통)다. 그 아래 부모·누대 3칸(혈통을 고르기 전엔 막힘).
 * - 상세: 판매자 행 아래 혈통 행(BloodlineLinkRow) + 판매자에게만 보이는 낙찰자 출처 카드 보내기 제안 행.
 */
import Link from "next/link";
import useSWR from "swr";

import { BLOODLINE_ATTACH_KEY } from "@components/features/bloodline/BloodlineAttachSheet";
import { BloodlineLinkRow, bloodlineCardHref } from "@components/features/bloodline/BloodlineLinkRow";
import { ChevronRightIcon } from "@components/features/bloodline/BloodlineScreenParts";
import { PedigreeNoteFields, readPedigreeNoteInput } from "@components/features/bloodline/PedigreeNoteFields";
import { cn } from "@libs/client/utils";
import { DELETED_USER_LABEL, isDeletedUserName } from "@libs/shared/deletedUser";
import type {
  AttachableBloodline,
  AuctionBloodlineLinkSummary,
  BloodlineCardsResponse,
} from "@libs/shared/bloodline-card";
import type { PedigreeNote } from "@libs/shared/pedigree-note";
import { FIELD_INPUT_CLASS, FieldLabel, HelpText } from "./AuctionFormParts";

/** 등록·수정 select 아래 안내(PRD S-7.등록 행, AC-38·AC-67). */
export const AUCTION_BLOODLINE_HELP = "혈통을 연결하면 경매 상세에 혈통 정보가 보여요.";
export const AUCTION_BLOODLINE_NONE_LABEL = "혈통 연결 안 함";
/** 수정 화면에서 지금 연결된 혈통의 이름을 모를 때(회수·숨김으로 요약이 없을 때) 옵션 라벨. */
export const AUCTION_BLOODLINE_CURRENT_FALLBACK_LABEL = "지금 연결된 혈통";

/** select 옵션 라벨: "이름 · 종", 출처 카드를 받은 혈통은 "이름 · 종 · (받음)"(AC-67). 종이 없으면 건너뛴다. */
export function attachableOptionLabel(item: Pick<AttachableBloodline, "name" | "speciesType" | "relation">) {
  const parts = [item.name];
  const species = item.speciesType?.trim();
  if (species) parts.push(species);
  if (item.relation === "received") parts.push("(받음)");
  return parts.join(" · ");
}

/**
 * 등록·수정 payload 의 pedigreeNote. 혈통이 없으면 null(서버도 혈통을 풀면 함께 지운다),
 * 칸이 비면 null, 규칙에 안 맞으면 "invalid"(제출을 막는다).
 */
export function auctionPedigreePayload(
  rootId: number | null,
  note: PedigreeNote
): PedigreeNote | null | "invalid" {
  if (!rootId) return null;
  return readPedigreeNoteInput(note);
}

export interface AuctionBloodlineFieldProps {
  /** select 값. "" 이면 연결 안 함. */
  value: string;
  onChange: (value: string) => void;
  note: PedigreeNote;
  onNoteChange: (note: PedigreeNote) => void;
  /**
   * 수정 화면: 지금 연결된 혈통 id. 혈통을 넘겼거나 숨겨져 attachable 에 없어도 옵션으로 남겨
   * select 가 엉뚱한 값을 보이지 않게 한다(같은 id 를 다시 보내면 서버는 권한을 다시 보지 않는다).
   */
  currentRootId?: number | null;
  currentLabel?: string | null;
}

/** 등록·수정 공용: 라벨 "혈통"(선택) → select → 안내 → 부모·누대 3칸. */
export function AuctionBloodlineField({
  value,
  onChange,
  note,
  onNoteChange,
  currentRootId,
  currentLabel,
}: AuctionBloodlineFieldProps) {
  // 붙이기 시트(상품)와 같은 키라 SWR 캐시를 함께 쓴다.
  const { data } = useSWR<BloodlineCardsResponse>(BLOODLINE_ATTACH_KEY);
  const attachable = data?.attachable ?? [];
  const showCurrent = Boolean(currentRootId) && !attachable.some((item) => item.rootId === currentRootId);

  return (
    <div>
      <FieldLabel label="혈통" caption="선택" htmlFor="auction-bloodline" />
      <select
        id="auction-bloodline"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={cn(FIELD_INPUT_CLASS, "border-app-border")}
      >
        <option value="">{AUCTION_BLOODLINE_NONE_LABEL}</option>
        {showCurrent ? (
          <option value={String(currentRootId)}>
            {currentLabel?.trim() || AUCTION_BLOODLINE_CURRENT_FALLBACK_LABEL}
          </option>
        ) : null}
        {attachable.map((item) => (
          <option key={item.rootId} value={String(item.rootId)}>
            {attachableOptionLabel(item)}
          </option>
        ))}
      </select>
      <HelpText>{AUCTION_BLOODLINE_HELP}</HelpText>
      <PedigreeNoteFields className="mt-4" value={note} onChange={onNoteChange} disabled={!value} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 상세                                                                */
/* ------------------------------------------------------------------ */

const isDeletedWinner = (name?: string | null) => name === DELETED_USER_LABEL || isDeletedUserName(name);

/**
 * 낙찰자 제안 행 조건(PRD S-6.낙찰자 제안): 판매자 + 경매 "종료" + 낙찰자 있음 + 혈통 있음 + `winnerReceived === false`.
 * winnerReceived 는 서버가 판매자·종료·낙찰자이고 판매자가 지금 보낼 수 있을 때만 계산하므로 값이 없으면(구 서버 포함) 그리지 않는다.
 * 낙찰자가 탈퇴했으면 보낼 수 없으니 제안하지 않는다.
 */
export function shouldSuggestWinnerSend(input: {
  isOwner: boolean;
  status: string;
  winnerId?: number | null;
  winnerName?: string | null;
  bloodline?: AuctionBloodlineLinkSummary | null;
}) {
  const name = input.winnerName?.trim();
  return Boolean(
    input.isOwner &&
      input.status === "종료" &&
      input.winnerId &&
      name &&
      !isDeletedWinner(name) &&
      input.bloodline &&
      input.bloodline.winnerReceived === false
  );
}

/** 혈통 상세에서 받는 사람(낙찰자)과 경매 출처를 미리 채우는 링크(설계 §4.4 ④). */
export function winnerSendHref({
  rootId,
  winnerId,
  winnerName,
  auctionId,
}: {
  rootId: number;
  winnerId: number;
  winnerName: string;
  auctionId: number;
}) {
  const params = new URLSearchParams({
    action: "send",
    toUserId: String(winnerId),
    toUserName: winnerName,
    auctionId: String(auctionId),
  });
  return `${bloodlineCardHref(rootId)}?${params.toString()}`;
}

export const winnerSendText = (winnerName: string, bloodlineName: string) =>
  `낙찰자 ${winnerName}님에게 ${bloodlineName} 출처 카드를 보낼까요?`;

export interface AuctionBloodlineRowsProps {
  auctionId: number;
  bloodline?: AuctionBloodlineLinkSummary | null;
  pedigreeNote?: unknown;
  isOwner: boolean;
  status: string;
  winnerId?: number | null;
  winnerName?: string | null;
}

/**
 * 경매 상세: 혈통 행(시안 A2 #S5 .blrow) + 낙찰자 제안 행(S3 .navrow 형식, 56 · 15 text · 화살표 20).
 * 혈통이 없으면(연결 없음·회수·구 서버) 자리도 남기지 않는다.
 */
export function AuctionBloodlineRows({
  auctionId,
  bloodline,
  pedigreeNote,
  isOwner,
  status,
  winnerId,
  winnerName,
}: AuctionBloodlineRowsProps) {
  if (!bloodline) return null;
  const suggest = shouldSuggestWinnerSend({ isOwner, status, winnerId, winnerName, bloodline });
  const name = winnerName?.trim() ?? "";
  return (
    <>
      <BloodlineLinkRow bloodline={bloodline} pedigreeNote={pedigreeNote} />
      {suggest && winnerId ? (
        <Link
          href={winnerSendHref({ rootId: bloodline.id, winnerId, winnerName: name, auctionId })}
          className="flex min-h-[56px] items-center gap-1 border-b border-app-line py-2.5 pl-4 pr-3"
        >
          <span className="min-w-0 flex-1 break-keep text-[15px] leading-[21px] text-app-text [overflow-wrap:anywhere]">
            {winnerSendText(name, bloodline.name)}
          </span>
          <ChevronRightIcon className="h-5 w-5 shrink-0 text-app-caption" />
        </Link>
      ) : null}
    </>
  );
}
