import type { BloodlineCardVisualStyle } from "@libs/shared/bloodline-card";
import { makeImageUrl } from "@libs/client/utils";
import Image from "@components/atoms/Image";

export type BloodlineVisualCardVariant = BloodlineCardVisualStyle;
export const bloodlineVisualCardVariants: BloodlineVisualCardVariant[] = [
  "noir",
  "clean",
  "editorial",
];

interface BloodlineVisualCardProps {
  cardId: number | null;
  name: string;
  ownerName: string;
  subtitle: string;
  compact?: boolean;
  variant?: BloodlineVisualCardVariant;
  image?: string | null;
  imageUrl?: string | null;
}

const CARD_VARIANTS: Record<
  BloodlineVisualCardVariant,
  {
    cardClass: string;
    glowClass: string;
    decoClass: string;
    imageOverlayClass: string;
    titleClass: string;
    nameClass: string;
    markClass: string;
    serialClass: string;
  }
> = {
  noir: {
    cardClass:
      "bg-slate-950 text-white border-slate-900/20 shadow-[0_18px_36px_rgba(15,23,42,0.28)]",
    glowClass:
      "bg-[radial-gradient(circle_at_24%_22%,rgba(255,255,255,0.22),transparent_30%),radial-gradient(circle_at_80%_2%,rgba(245,137,66,0.24),transparent_33%),linear-gradient(125deg,rgba(255,255,255,0.14),rgba(255,255,255,0)_50%)]",
    decoClass: "rounded-full border border-white/10",
    imageOverlayClass: "bg-slate-900/45",
    titleClass: "text-white/75 uppercase tracking-[0.16em]",
    nameClass: "text-white",
    markClass: "text-white/85 border-white/30 bg-white/10",
    serialClass:
      "text-white border-white/35 bg-slate-900/78 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08),0_8px_24px_rgba(15,23,42,0.45)]",
  },
  clean: {
    cardClass:
      "bg-white text-slate-900 border-slate-200/80 shadow-[0_12px_26px_rgba(15,23,42,0.12)]",
    glowClass:
      "bg-[radial-gradient(circle_at_88%_4%,rgba(245,137,66,0.16),transparent_42%)]",
    decoClass: "rounded-full border border-slate-200/85",
    imageOverlayClass: "bg-slate-50/45",
    titleClass: "text-slate-700 uppercase tracking-[0.18em]",
    nameClass: "text-slate-900",
    markClass: "text-slate-700 border-slate-300 bg-white/75",
    serialClass:
      "text-slate-900 border-slate-200/75 bg-white/95 shadow-[inset_0_0_0_1px_rgba(15,23,42,0.05),0_6px_18px_rgba(15,23,42,0.16)]",
  },
  editorial: {
    cardClass:
      "bg-gradient-to-br from-slate-50 via-white to-slate-100 text-slate-900 border-slate-300/70 shadow-[0_10px_26px_rgba(15,23,42,0.15)]",
    glowClass:
      "bg-[linear-gradient(145deg,rgba(15,23,42,0.06),rgba(245,137,66,0.12),rgba(15,23,42,0)_70%)]",
    decoClass: "rounded-full border border-slate-300/65",
    imageOverlayClass: "bg-slate-900/38",
    titleClass: "text-slate-700 uppercase tracking-[0.18em]",
    nameClass: "text-slate-900",
    markClass: "text-slate-700 border-slate-300 bg-white/80",
    serialClass:
      "text-slate-900 border-slate-400/80 bg-slate-100/90 shadow-[inset_0_0_0_1px_rgba(15,23,42,0.08),0_6px_18px_rgba(15,23,42,0.16)]",
  },
};

const makeFallbackCardSerial = (cardId: number | null, name: string) => {
  if (cardId) {
    return `CID-${String(cardId).padStart(5, "0")}`;
  }

  const base = (name || "새 혈통").trim();
  if (!base) {
    return "CID-DRAFT";
  }

  let hash = 0;
  for (let i = 0; i < Math.min(base.length, 8); i += 1) {
    hash = (hash * 31 + base.charCodeAt(i)) % 100000;
  }
  return `CID-${String(hash).padStart(5, "0")}`;
};

export function BloodlineVisualCard({
  cardId,
  name,
  ownerName,
  subtitle,
  compact = false,
  variant = "noir",
  image,
  imageUrl,
}: BloodlineVisualCardProps) {
  const serialText = makeFallbackCardSerial(cardId, name);
  const activeVariant = CARD_VARIANTS[variant];
  const metaCardClass =
    variant === "noir"
      ? "border-white/10 bg-black/10 text-white"
      : "border-slate-200/80 bg-white/80 text-slate-900";
  const metaLabelClass = variant === "noir" ? "text-white/65" : "text-slate-500";
  const metaDescriptionClass = variant === "noir" ? "text-white/72" : "text-slate-600";
  const aspectClass = compact
    ? "aspect-[4/5] min-h-[188px] p-3"
    : "aspect-[4/5] min-h-[320px] p-4";
  const resolvedImageUrl = imageUrl
    ? imageUrl
    : image
    ? makeImageUrl(image)
    : "";

  return (
    <article className={`relative ${compact ? "w-full" : "mx-auto w-full max-w-[360px]"}`}>
      <div
        className={`relative ${aspectClass} overflow-hidden rounded-[22px] border ${activeVariant.cardClass}`}
      >
        {resolvedImageUrl ? (
          <div className="pointer-events-none absolute inset-0">
            <Image
              src={resolvedImageUrl}
              alt=""
              fill
              sizes={compact ? "240px" : "360px"}
              className="object-cover object-center opacity-75"
              unoptimized
            />
            <div className={`absolute inset-0 ${activeVariant.imageOverlayClass}`} />
          </div>
        ) : (
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.14),transparent_32%),radial-gradient(circle_at_82%_18%,rgba(245,137,66,0.18),transparent_28%),linear-gradient(145deg,rgba(255,255,255,0.06),rgba(15,23,42,0)_48%)]" />
        )}
        <div className={`pointer-events-none absolute inset-0 ${activeVariant.glowClass}`} />
        <div className={`pointer-events-none absolute -left-8 -top-7 h-20 w-20 ${activeVariant.decoClass}`} />
        <div className={`pointer-events-none absolute -right-8 top-8 h-24 w-24 ${activeVariant.decoClass}`} />
        <div className="pointer-events-none absolute inset-x-4 top-[56%] h-px bg-white/10" />

        <div className="relative z-10 flex h-full flex-col justify-between">
          <span
            className={`inline-flex w-fit items-center rounded-full border px-2 py-1 text-[10px] font-semibold tracking-[0.18em] ${activeVariant.markClass}`}
          >
            BLOODLINE SERIES
          </span>
          <div>
            <p
              className={`${compact ? "text-[11px]" : "text-[13px]"} font-semibold tracking-[0.16em] ${activeVariant.titleClass}`}
            >
              BLOODLINE CARD
            </p>
            <p
              className={`mt-1 ${compact ? "text-[21px]" : "text-[26px]"} line-clamp-2 font-semibold leading-[1.06] tracking-[-0.03em] ${activeVariant.nameClass}`}
              title={name}
            >
              {name}
            </p>
            <div className={`mt-3 max-w-[88%] rounded-2xl border px-3 py-2 backdrop-blur-[6px] ${metaCardClass}`}>
              <p className={`text-[10px] font-semibold uppercase tracking-[0.18em] ${metaLabelClass}`}>
                Owner
              </p>
              <p className="mt-1 text-sm font-semibold">{ownerName}</p>
              <p className={`mt-1 line-clamp-2 text-[11px] leading-relaxed ${metaDescriptionClass}`}>
                {subtitle || "브리더가 만든 혈통카드"}
              </p>
            </div>
          </div>
        </div>

        <div className="pointer-events-none absolute right-3 bottom-3 left-3 flex justify-end">
          <div
            className={`relative inline-flex max-w-[90%] flex-col rounded-xl border px-3 py-2 ${activeVariant.serialClass}`}
          >
            <span className="absolute inset-x-0 top-[4px] h-px bg-current/22" />
            <span className="absolute inset-x-0 bottom-[4px] h-px bg-current/8" />
            <p className="text-[8px] leading-none tracking-[0.28em] text-current/65">
              BLOODLINE CODE
            </p>
            <p className="mt-1 text-[11px] leading-none tracking-[0.18em] font-semibold uppercase font-mono text-current">
              {serialText}
            </p>
          </div>
        </div>
      </div>
    </article>
  );
}
