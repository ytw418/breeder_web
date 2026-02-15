import type { BloodlineCardVisualStyle } from "@libs/shared/bloodline-card";
import { makeImageUrl } from "@libs/client/utils";

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
    markClass:
      "text-white/85 border-white/30 bg-white/10",
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
    markClass:
      "text-slate-700 border-slate-300 bg-white/75",
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
  },
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
  void cardId;
  void ownerName;
  void subtitle;

  const activeVariant = CARD_VARIANTS[variant];
  const aspectClass = compact ? "aspect-[3/4] min-h-[176px] p-2.5" : "aspect-[3/4] min-h-[300px] p-4";
  const resolvedImageUrl = imageUrl
    ? imageUrl
    : image
    ? makeImageUrl(image)
    : "";

  return (
    <article className={`relative ${compact ? "w-full" : "mx-auto w-full max-w-[360px]"}`}>
      <div
        className={`relative ${aspectClass} overflow-hidden rounded-lg border ${activeVariant.cardClass}`}
      >
        {resolvedImageUrl ? (
          <div className="pointer-events-none absolute inset-0">
            <img
              src={resolvedImageUrl}
              alt=""
              className="h-full w-full object-cover object-center opacity-70"
            />
            <div className={`absolute inset-0 ${activeVariant.imageOverlayClass}`} />
          </div>
        ) : null}
        <div className={`pointer-events-none absolute inset-0 ${activeVariant.glowClass}`} />
        <div
          className={`pointer-events-none absolute -left-8 -top-7 h-20 w-20 ${activeVariant.decoClass}`}
        />
        <div
          className={`pointer-events-none absolute -right-8 top-8 h-24 w-24 ${activeVariant.decoClass}`}
        />

        <div className="relative z-10 flex h-full flex-col justify-between">
          <span
            className={`inline-flex w-fit items-center rounded-full border px-2 py-1 text-[10px] font-black ${activeVariant.markClass}`}
          >
            BLOODLINE MARK
          </span>
          <div>
            <p
              className={`${compact ? "text-[10px]" : "text-xs"} font-black ${activeVariant.titleClass}`}
            >
              BREDY
            </p>
            <p
              className={`mt-1 ${compact ? "text-[24px]" : "text-[30px]"} line-clamp-2 font-black leading-[1.04] tracking-tight ${activeVariant.nameClass}`}
              title={name}
            >
              {name}
            </p>
          </div>
        </div>
      </div>
    </article>
  );
}
