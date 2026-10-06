"use client";

/**
 * 혈통카드 — 채택 시안(A안, 당근 톤) 1:1
 * 원본: bredy_app design/mockups/bloodline-card/A-karrot.html `.card`,
 *       bredy_app src/components/features/bloodline/BloodlineVisualCard.tsx
 *
 * 1px border r12 카드 = 사진(186, 없으면 placeholder + 34 라인 아이콘, 좌상단 태그)
 * + 본문(이름 20/700, 메타 14 muted) + 정보 행(보유자 / 발급일 / 발급번호).
 */
import { useState } from "react";
import Image from "@components/atoms/Image";
import { makeImageUrl } from "@libs/client/utils";
import {
  formatBloodlineIssuedAt,
  type BloodlineCardVisualStyle,
} from "@libs/shared/bloodline-card";

export type BloodlineVisualCardVariant = BloodlineCardVisualStyle;
/** @deprecated A안에서 카드 색 변주는 사라졌다. 호환용으로만 남긴다. */
export const bloodlineVisualCardVariants: BloodlineVisualCardVariant[] = [
  "noir",
  "clean",
  "editorial",
];

interface BloodlineVisualCardProps {
  cardId: number | null;
  name: string;
  /** 이름 아래 메타 줄(예: "장수풍뎅이 · 오닉스 라인") */
  subtitle: string;
  ownerName: string;
  /** 사진 좌상단 태그("혈통"/"라인"). 없으면 그리지 않는다. */
  typeLabel?: string;
  /** 발급일 원본(ISO). 없으면 발급일 행을 그리지 않는다. */
  issuedAt?: string | null;
  /** 좁은 자리에서 사진 높이를 줄인다(132). */
  compact?: boolean;
  /**
   * @deprecated A안에서 카드 색 변주(noir/clean/editorial)는 사라졌다.
   * 기존 호출부 호환을 위해 prop 만 남기고 렌더에는 쓰지 않는다.
   */
  variant?: BloodlineVisualCardVariant;
  /** Cloudflare 이미지 id */
  image?: string | null;
  /** 이미 만들어진 URL(로컬 미리보기 blob 등). image 보다 우선한다. */
  imageUrl?: string | null;
  className?: string;
}

function PhotoPlaceholderIcon() {
  return (
    <svg
      width={34}
      height={34}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="text-app-caption"
    >
      <rect x={3} y={4} width={18} height={16} rx={2} />
      <circle cx={8.5} cy={9.5} r={1.8} />
      <path d="M4 17l4.5-4.5 3.5 3.5 3-2.5L20 18" />
    </svg>
  );
}

export function BloodlineVisualCard({
  cardId,
  name,
  subtitle,
  ownerName,
  typeLabel,
  issuedAt,
  compact = false,
  image,
  imageUrl,
  className,
}: BloodlineVisualCardProps) {
  const src = imageUrl || (image ? makeImageUrl(image, "public") : "");
  // 실패한 src 를 기억해 두고, src 가 바뀌면 다시 시도한다.
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const showImage = Boolean(src) && failedSrc !== src;
  const issuedText = formatBloodlineIssuedAt(issuedAt);

  const rows: { label: string; value: string }[] = [
    { label: "보유자", value: ownerName || "-" },
  ];
  if (issuedText) rows.push({ label: "발급일", value: issuedText });
  if (cardId) rows.push({ label: "발급번호", value: String(cardId) });

  return (
    <article
      className={`w-full overflow-hidden rounded-xl border border-app-border bg-app-elevated text-left ${
        className ?? ""
      }`}
    >
      <div
        className={`relative flex items-center justify-center bg-app-placeholder ${
          compact ? "h-[132px]" : "h-[186px]"
        }`}
      >
        {showImage ? (
          <Image
            src={src}
            alt=""
            fill
            sizes="(max-width: 576px) 100vw, 576px"
            className="object-cover object-center"
            unoptimized
            onError={() => setFailedSrc(src)}
          />
        ) : (
          <PhotoPlaceholderIcon />
        )}
        {typeLabel ? (
          // 사진 위 스크림 태그 — 테마와 무관하게 고정(앱 S.scrim55)
          <span
            className="absolute left-3 top-3 inline-flex h-6 items-center rounded-md px-2 text-[11px] font-semibold text-white"
            style={{ backgroundColor: "rgba(0, 0, 0, 0.55)" }}
          >
            {typeLabel}
          </span>
        ) : null}
      </div>

      <div className="px-3.5 pb-1 pt-3.5">
        <p className="line-clamp-2 text-[20px] font-bold leading-[26px] tracking-[-0.4px] text-app-text">
          {name}
        </p>
        {subtitle ? (
          <p className="mt-[5px] truncate text-[14px] tracking-[-0.2px] text-app-muted">
            {subtitle}
          </p>
        ) : null}
      </div>

      <dl className="px-3.5 pb-3.5 pt-3">
        {rows.map((row, index) => (
          <div
            key={row.label}
            className={`flex items-center justify-between gap-3 text-[14px] tracking-[-0.2px] ${
              index === 0 ? "pb-[9px] pt-0.5" : "border-t border-app-line py-[9px]"
            }`}
          >
            <dt className="shrink-0 text-app-muted">{row.label}</dt>
            <dd className="min-w-0 truncate text-right font-medium text-app-text">
              {row.value}
            </dd>
          </div>
        ))}
      </dl>
    </article>
  );
}

export default BloodlineVisualCard;
