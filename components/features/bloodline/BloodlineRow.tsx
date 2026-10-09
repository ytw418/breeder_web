/**
 * 혈통 목록 행 — 채택 시안 A2 `.row` 1:1(앱 components/features/bloodline/BloodlineRow.tsx).
 * 72 행, 좌우 16, 간격 12: 56 썸네일(r12) 또는 44 원형 아바타 → 이름 16/600(말줄임) + 메타 14 muted → 화살표 20 caption.
 * 사진이 없으면 placeholder 면 + 라인 아이콘(사진 24 / 사람 20). 행 구분선·스켈레톤·섹션 제목·"예시" pill 도 여기 둔다.
 */
import Link from "next/link";
import type { ReactNode } from "react";
import Image from "@components/atoms/Image";
import { cn, makeImageUrl } from "@libs/client/utils";

type Shape = { d?: string; circle?: [number, number, number]; rect?: [number, number, number, number, number] };

function LineIcon({ shapes, size, className }: { shapes: Shape[]; size: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={cn("shrink-0", className)}
    >
      {shapes.map((shape, index) =>
        shape.d ? (
          <path key={index} d={shape.d} />
        ) : shape.circle ? (
          <circle key={index} cx={shape.circle[0]} cy={shape.circle[1]} r={shape.circle[2]} />
        ) : shape.rect ? (
          <rect key={index} x={shape.rect[0]} y={shape.rect[1]} width={shape.rect[2]} height={shape.rect[3]} rx={shape.rect[4]} />
        ) : null
      )}
    </svg>
  );
}

const IMAGE: Shape[] = [{ rect: [3.5, 4.5, 17, 15, 2.5] }, { circle: [9, 10, 1.6] }, { d: "M4 17l4.5-4.5 4 3.5 3-2.5L20 17" }];
const PERSON: Shape[] = [{ circle: [12, 8, 3.5] }, { d: "M4.5 19.5c1.2-3.3 4-5 7.5-5s6.3 1.7 7.5 5" }];
const INFO: Shape[] = [{ circle: [12, 12, 8.5] }, { d: "M12 11v5.5" }, { d: "M12 7.6v.1" }];
const CHEVRON_RIGHT: Shape[] = [{ d: "M9 5l7 7-7 7" }];

export const BloodlineImageIcon = ({ size = 24 }: { size?: number }) => (
  <LineIcon shapes={IMAGE} size={size} className="text-app-caption" />
);
export const BloodlinePersonIcon = ({ size = 20 }: { size?: number }) => (
  <LineIcon shapes={PERSON} size={size} className="text-app-caption" />
);
export const BloodlineInfoIcon = ({ size = 16 }: { size?: number }) => (
  <LineIcon shapes={INFO} size={size} className="text-app-caption" />
);
export const BloodlineChevronIcon = ({ size = 20 }: { size?: number }) => (
  <LineIcon shapes={CHEVRON_RIGHT} size={size} className="text-app-caption" />
);

/** 56 썸네일 / 44 아바타. 사진이 없으면 placeholder + 라인 아이콘. */
export function BloodlineThumb({ imageId, avatar }: { imageId?: string | null; avatar?: boolean }) {
  const size = avatar ? 44 : 56;
  const shape = avatar ? "rounded-full" : "rounded-xl";
  if (imageId?.trim()) {
    return (
      <Image
        src={makeImageUrl(imageId, avatar ? "avatar" : "product")}
        alt=""
        width={size}
        height={size}
        className={cn("shrink-0 object-cover", shape)}
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      className={cn("flex shrink-0 items-center justify-center bg-app-placeholder", shape)}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      {avatar ? <BloodlinePersonIcon size={20} /> : <BloodlineImageIcon size={24} />}
    </span>
  );
}

/** "예시" 같은 중립 pill: 높이 22, r11, surface 배경, 12/600 sub. */
export function BloodlinePill({ label }: { label: string }) {
  return (
    <span className="inline-flex h-[22px] items-center rounded-[11px] bg-app-surface px-2 text-[12px] font-semibold text-app-sub">
      {label}
    </span>
  );
}

export function BloodlineRow({
  imageId,
  avatar,
  title,
  meta,
  href,
  pill,
  titleTone = "default",
  right,
  ariaLabel,
}: {
  imageId?: string | null;
  /** true 면 44 원형 아바타(받은 사람 목록), 아니면 56 썸네일. */
  avatar?: boolean;
  title: string;
  meta: string;
  /** 없으면 누를 수 없는 행(화살표도 없다). */
  href?: string;
  /** "예시" pill(S1 예시 블록). 주면 높이를 고정하지 않는다. */
  pill?: "예시";
  /** "sub" 는 가린 이름("닉네임 비공개")처럼 한 단계 옅게. */
  titleTone?: "default" | "sub";
  right?: ReactNode;
  ariaLabel?: string;
}) {
  const body = (
    <span className="flex min-w-0 items-center gap-3">
      <BloodlineThumb imageId={imageId} avatar={avatar} />
      <span className="min-w-0 flex-1">
        <span
          className={cn(
            "block truncate text-[16px] font-semibold leading-[22px] tracking-[-0.3px]",
            titleTone === "sub" ? "text-app-sub" : "text-app-text"
          )}
        >
          {title}
        </span>
        {meta ? <span className="mt-0.5 block truncate text-[14px] leading-5 text-app-muted">{meta}</span> : null}
      </span>
      {right ?? (href ? <BloodlineChevronIcon size={20} /> : null)}
    </span>
  );
  if (pill) {
    return (
      <div className="px-4">
        <BloodlinePill label={pill} />
        <div className="mt-3">{body}</div>
      </div>
    );
  }
  if (!href) {
    return <div className="flex h-[72px] flex-col justify-center px-4">{body}</div>;
  }
  return (
    <Link
      href={href}
      aria-label={ariaLabel ?? (meta ? `${title}, ${meta}` : title)}
      className="flex h-[72px] flex-col justify-center px-4 transition-colors hover:bg-app-surface"
    >
      {body}
    </Link>
  );
}

/** 행 사이 구분선: 좌우 16 들인 1px line. */
export function BloodlineRowDivider() {
  return <div className="mx-4 h-px bg-app-line" aria-hidden="true" />;
}

/** 72 행 스켈레톤(56 placeholder + 바 2줄). avatar 면 44 원. */
export function BloodlineRowSkeleton({ avatar }: { avatar?: boolean }) {
  return (
    <div className="flex h-[72px] items-center gap-3 px-4" aria-hidden="true">
      <span
        className={cn("shrink-0 animate-pulse bg-app-placeholder", avatar ? "h-11 w-11 rounded-full" : "h-14 w-14 rounded-xl")}
      />
      <span className="flex flex-1 flex-col gap-2">
        <span className="h-4 w-[45%] animate-pulse rounded bg-app-placeholder" />
        <span className="h-3.5 w-[70%] animate-pulse rounded bg-app-placeholder" />
      </span>
    </div>
  );
}

/** 섹션 제목("내 혈통", "받은 출처 카드"): 16/700, 패딩 16/16/8. */
export function BloodlineSectionTitle({ title }: { title: string }) {
  return (
    <h2 className="px-4 pb-2 pt-4 text-[16px] font-bold leading-[22px] tracking-[-0.3px] text-app-text">{title}</h2>
  );
}
