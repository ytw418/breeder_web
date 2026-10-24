"use client";

import { cn } from "@libs/client/utils";
import { shelterTelHref } from "@libs/shared/shelterAnimal";
import { shelterNoticeUrl, type ShelterContact } from "@libs/shared/shelterNotice";

/**
 * 보호소 글 상세의 출처 상자(앱 docs/prd/shelter-animals.md S-3, 시안 shelter-animals/A-karrot.html #shelter-detail .src).
 * 본문 아래 면 색 r12 상자: 보호소 이름·주소·전화, 공고번호, '보호 기간이 지나면 이미 입양됐을 수 있어요'.
 * 값은 본문 줄에서 읽고(parseShelterContact) 읽지 못한 칸은 그리지 않는다. 안내 줄은 늘 보인다.
 */
export function ShelterSourceBox({ contact }: { contact: ShelterContact }) {
  const rows = [
    { label: "보호소", value: contact.name },
    { label: "주소", value: contact.address },
    { label: "전화", value: contact.tel },
    { label: "공고번호", value: contact.noticeNo },
  ].filter((row): row is { label: string; value: string } => Boolean(row.value));
  return (
    <section className="rounded-xl bg-app-surface px-4 py-3.5" aria-label="출처" data-testid="shelter-source">
      <h2 className="text-[14px] font-bold leading-5 text-app-text">출처</h2>
      {rows.length > 0 ? (
        <dl className="mt-2">
          {rows.map((row) => (
            <div key={row.label} className="flex gap-3 py-1 text-[14px] leading-5">
              <dt className="w-14 shrink-0 text-app-muted">{row.label}</dt>
              <dd className="min-w-0 flex-1 break-keep text-app-text">{row.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      <p
        className={cn(
          "flex gap-1.5 text-[13px] leading-[18px] text-app-sub",
          rows.length > 0 ? "mt-2.5 border-t border-app-line pt-2.5" : "mt-1.5"
        )}
      >
        <svg
          className="mt-px h-4 w-4 shrink-0 text-app-muted"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="9" />
          <path strokeLinecap="round" d="M12 11v5M12 8h.01" />
        </svg>
        보호 기간이 지나면 이미 입양됐을 수 있어요
      </p>
    </section>
  );
}

const PHONE_ICON = (
  <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" aria-hidden="true">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M6.6 4h2.6l1.4 3.6-1.8 1.2a10.5 10.5 0 0 0 5.8 5.8l1.2-1.8L19.4 14v2.6A2.4 2.4 0 0 1 17 19 12.5 12.5 0 0 1 5 7a2.4 2.4 0 0 1 1.6-3z"
    />
  </svg>
);

const EXTERNAL_ICON = (
  <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24" aria-hidden="true">
    <g strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 5h6v6" />
      <path d="M19 5 11 13" />
      <path d="M17 14v4a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 5 18V8.5A1.5 1.5 0 0 1 6.5 7H10" />
    </g>
  </svg>
);

/**
 * 보호소 글 상세 하단 고정 바(S-3). 채팅하기·찜·가격은 두지 않는다 — 브리디가 보호소를 대신하지 않는다.
 * 주 버튼 '보호소에 전화'(tel:, 주황)와 보조 '공고 원문 보기'(animal.go.kr, 회색). 전화가 비었거나 형식이 다르면(E-6)
 * '공고 원문 보기'만 주 버튼 자리를 채우고, 구조번호도 없으면 바를 그리지 않는다.
 * onCall: '보호소에 전화'를 눌렀을 때(PostHog shelter_call_click). tel: 이동은 막지 않는다.
 */
export function ShelterActionBar({
  tel,
  externalId,
  onCall,
}: {
  /** 본문에서 읽은 보호소 전화 글(parseShelterContact().tel). */
  tel: string | null;
  /** Product.externalId = 구조번호(desertionNo). */
  externalId: string | null | undefined;
  onCall?: () => void;
}) {
  const telHref = shelterTelHref(tel);
  const noticeUrl = shelterNoticeUrl(externalId);
  if (!telHref && !noticeUrl) return null;
  return (
    <div
      className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-xl border-t border-app-border bg-app-bg pb-[env(safe-area-inset-bottom)]"
      data-testid="shelter-action-bar"
    >
      <div className="mx-auto flex max-w-xl items-center gap-2 px-4 py-2.5">
        {noticeUrl ? (
          <a
            href={noticeUrl}
            target="_blank"
            rel="noopener noreferrer"
            data-testid="shelter-notice-link"
            className={cn(
              "flex h-[52px] items-center justify-center gap-1.5 whitespace-nowrap rounded-md text-[16px] font-semibold",
              telHref ? "w-[152px] shrink-0 bg-app-surface text-app-text" : "flex-1 bg-app-brand text-white"
            )}
          >
            {EXTERNAL_ICON}
            공고 원문 보기
          </a>
        ) : null}
        {telHref ? (
          <a
            href={telHref}
            onClick={onCall}
            data-testid="shelter-call"
            className="flex h-[52px] min-w-0 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-md bg-app-brand text-[16px] font-semibold text-white"
          >
            {PHONE_ICON}
            보호소에 전화
          </a>
        ) : null}
      </div>
    </div>
  );
}
