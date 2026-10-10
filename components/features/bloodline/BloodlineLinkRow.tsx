/**
 * 분양글·경매 상세의 혈통 행(시안 A2 #S5 .blrow, PRD S-6). 분양자 행 바로 아래에 둔다.
 * 라벨 "혈통"(14 muted, 폭 36, 위 정렬) → 1줄 "{이름} · {산지}" 15/600 → 2줄 분양자와의 관계 13 muted
 * → 3줄 "누대 F3 · 부 81.2mm · 모 47.5mm · 분양자 입력"(값이 있을 때만) → 화살표 20 caption.
 * 누르면 뿌리 혈통 상세(공개 페이지)로 간다. 붙이기 시트의 미리보기(`preview`)는 위아래 1px 이고 이동하지 않는다.
 * 훅을 쓰지 않아 서버·클라이언트 컴포넌트 어디서나 쓸 수 있다.
 */
import Link from "next/link";
import { ChevronRightIcon } from "@components/features/bloodline/BloodlineScreenParts";
import { bloodlineUserPhrase, type BloodlineLinkSummary } from "@libs/shared/bloodline-card";
import { formatPedigreeNote, parsePedigreeNote } from "@libs/shared/pedigree-note";
import { cn } from "@libs/client/utils";

/** 3줄째 꼬리표(분양자가 적은 값이라는 표시). */
export const PEDIGREE_SELLER_INPUT_SUFFIX = "분양자 입력";

/** 혈통 상세 공개 경로(공유 URL 과 같은 경로). */
export const bloodlineCardHref = (cardId: number) => `/bloodline-management/card/${cardId}`;

const KST_MONTH_DAY = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Seoul",
  month: "2-digit",
  day: "2-digit",
});

/**
 * ISO → "09.12"(한국 시간). SSR(UTC)과 브라우저가 같은 값을 그리도록 시간대를 고정한다. 잘못된 값이면 "".
 */
export function formatBloodlineMonthDay(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const parts = KST_MONTH_DAY.formatToParts(date);
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  return month && day ? `${month}.${day}` : "";
}

/**
 * 2줄째(분양자와의 관계, PRD AC-59).
 * creator "분양자가 만든 혈통" / received "강산님 혈통 · 분양자가 09.12 출처 카드 받음" / holder·none "강산님 혈통".
 */
export function bloodlineLinkRelationText(
  bloodline: Pick<BloodlineLinkSummary, "sellerRelation" | "creator" | "receivedAt">
) {
  if (bloodline.sellerRelation === "creator") return "분양자가 만든 혈통";
  const owner = `${bloodlineUserPhrase(bloodline.creator)} 혈통`;
  if (bloodline.sellerRelation !== "received") return owner;
  const day = formatBloodlineMonthDay(bloodline.receivedAt);
  return day ? `${owner} · 분양자가 ${day} 출처 카드 받음` : `${owner} · 분양자가 출처 카드 받음`;
}

/**
 * 3줄째: "누대 F3 · 부 81.2mm · 모 47.5mm · 분양자 입력". 값이 없거나 규칙에 안 맞으면 null(줄 생략).
 * 저장된 Json 을 그대로 받아도 되도록 shared 규칙으로 한 번 더 거른다.
 */
export function bloodlinePedigreeLine(pedigreeNote: unknown) {
  const parsed = parsePedigreeNote(pedigreeNote ?? null);
  if (!parsed.ok) return null;
  const text = formatPedigreeNote(parsed.value);
  return text ? `${text} · ${PEDIGREE_SELLER_INPUT_SUFFIX}` : null;
}

export interface BloodlineLinkRowProps {
  bloodline: BloodlineLinkSummary;
  /** PedigreeNote | null. 응답의 Json 값을 그대로 넘겨도 된다. */
  pedigreeNote?: unknown;
  /** 기본은 뿌리 혈통 상세. null 이면 링크를 걸지 않는다. */
  href?: string | null;
  /** 붙이기 시트 미리보기: 좌우 16 들여 위아래 1px, 이동 없음. */
  preview?: boolean;
  className?: string;
}

export function BloodlineLinkRow({
  bloodline,
  pedigreeNote,
  href,
  preview = false,
  className,
}: BloodlineLinkRowProps) {
  const origin = bloodline.originLabel?.trim();
  const pedigreeLine = bloodlinePedigreeLine(pedigreeNote);
  const target = preview ? null : href === undefined ? bloodlineCardHref(bloodline.id) : href;

  const content = (
    <>
      <span className="w-9 shrink-0 self-start text-[14px] leading-[21px] text-app-muted">혈통</span>
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 whitespace-nowrap text-[15px] font-semibold leading-[21px] tracking-[-0.3px] text-app-text">
          <span className="min-w-0 truncate">{bloodline.name}</span>
          {origin ? <span className="shrink-0">{` · ${origin}`}</span> : null}
        </span>
        <span className="mt-0.5 block truncate text-[13px] leading-[18px] text-app-muted">
          {bloodlineLinkRelationText(bloodline)}
        </span>
        {pedigreeLine ? (
          <span className="mt-0.5 block truncate text-[13px] leading-[18px] text-app-muted">
            {pedigreeLine}
          </span>
        ) : null}
      </span>
      <ChevronRightIcon className="h-5 w-5 shrink-0 text-app-caption" />
    </>
  );

  const rowClass = preview
    ? "mx-4 flex items-center gap-2 border-y border-app-line py-3"
    : "flex min-h-[64px] items-center gap-2 border-b border-app-line px-4 py-3";

  if (target) {
    return (
      <Link href={target} className={cn(rowClass, className)}>
        {content}
      </Link>
    );
  }
  return (
    <div className={cn(rowClass, className)} data-testid={preview ? "bloodline-link-preview" : undefined}>
      {content}
    </div>
  );
}

export default BloodlineLinkRow;
