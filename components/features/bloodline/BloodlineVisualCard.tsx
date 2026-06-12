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
    imageFrameClass: string;
    placeholderClass: string;
    badgeClass: string;
    labelClass: string;
    nameClass: string;
    metaClass: string;
    subtleClass: string;
    serialClass: string;
  }
> = {
  noir: {
    cardClass: "border-slate-800 bg-slate-950 text-white",
    imageFrameClass: "border-slate-800 bg-slate-900",
    placeholderClass: "bg-slate-900 text-slate-500",
    badgeClass: "border-white/20 bg-white/10 text-white/80",
    labelClass: "text-white/50",
    nameClass: "text-white",
    metaClass: "border-white/10 bg-white/[0.04] text-white",
    subtleClass: "text-white/60",
    serialClass: "border-white/10 bg-white/[0.05] text-white",
  },
  clean: {
    cardClass: "border-slate-200 bg-white text-slate-900",
    imageFrameClass: "border-slate-200 bg-slate-100",
    placeholderClass: "bg-slate-100 text-slate-400",
    badgeClass: "border-slate-200 bg-white/90 text-slate-700",
    labelClass: "text-slate-400",
    nameClass: "text-slate-950",
    metaClass: "border-slate-200 bg-slate-50 text-slate-900",
    subtleClass: "text-slate-500",
    serialClass: "border-slate-200 bg-white text-slate-900",
  },
  editorial: {
    cardClass: "border-zinc-200 bg-zinc-50 text-slate-900",
    imageFrameClass: "border-zinc-200 bg-zinc-100",
    placeholderClass: "bg-zinc-100 text-zinc-400",
    badgeClass: "border-zinc-200 bg-zinc-50/90 text-zinc-700",
    labelClass: "text-zinc-500",
    nameClass: "text-slate-950",
    metaClass: "border-zinc-200 bg-white text-slate-900",
    subtleClass: "text-zinc-600",
    serialClass: "border-zinc-300 bg-zinc-50 text-slate-900",
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
  const aspectClass = compact
    ? "aspect-[4/5] min-h-[188px]"
    : "aspect-[4/5] min-h-[320px]";
  const resolvedImageUrl = imageUrl
    ? imageUrl
    : image
    ? makeImageUrl(image)
    : "";

  return (
    <article
      className={`relative ${
        compact ? "w-full" : "mx-auto w-full max-w-[360px]"
      }`}
    >
      <div
        className={`relative ${aspectClass} overflow-hidden rounded-xl border shadow-sm ${activeVariant.cardClass}`}
      >
        <div className="flex h-full flex-col">
          <div
            className={`relative h-[52%] overflow-hidden border-b ${activeVariant.imageFrameClass}`}
          >
            {resolvedImageUrl ? (
              <Image
                src={resolvedImageUrl}
                alt=""
                fill
                sizes={compact ? "240px" : "360px"}
                className="object-cover object-center"
                unoptimized
              />
            ) : (
              <div
                className={`flex h-full w-full items-center justify-center px-3 py-2 ${activeVariant.placeholderClass}`}
              >
                <div className="text-center">
                  <p className="text-[10px] font-semibold tracking-[0.14em]">
                    BREDY
                  </p>
                  <p className="mt-1 text-[11px] font-semibold">BLOODLINE</p>
                </div>
              </div>
            )}
            <span
              className={`absolute left-2.5 top-2.5 inline-flex h-6 items-center rounded-md border px-2 text-[10px] font-semibold ${activeVariant.badgeClass}`}
            >
              {cardId ? `#${cardId}` : "DRAFT"}
            </span>
          </div>

          <div
            className={`${
              compact ? "p-3" : "p-4"
            } flex flex-1 flex-col justify-between`}
          >
            <div>
              <p
                className={`${
                  compact ? "text-[10px]" : "text-[11px]"
                } font-semibold ${activeVariant.labelClass}`}
              >
                혈통카드
              </p>
              <p
                className={`mt-1 ${
                  compact ? "text-[20px]" : "text-[25px]"
                } line-clamp-2 font-bold leading-[1.08] tracking-[-0.02em] ${
                  activeVariant.nameClass
                }`}
                title={name}
              >
                {name}
              </p>
            </div>

            <div className="mt-3 grid gap-2">
              <div
                className={`rounded-lg border px-3 py-2 ${activeVariant.metaClass}`}
              >
                <p
                  className={`text-[10px] font-semibold ${activeVariant.labelClass}`}
                >
                  보유자
                </p>
                <p className="mt-0.5 truncate text-sm font-semibold">
                  {ownerName}
                </p>
                <p
                  className={`mt-1 line-clamp-2 text-[11px] leading-relaxed ${activeVariant.subtleClass}`}
                >
                  {subtitle || "브리더가 만든 혈통카드"}
                </p>
              </div>
              <div
                className={`inline-flex max-w-full flex-col rounded-lg border px-3 py-2 ${activeVariant.serialClass}`}
              >
                <p
                  className={`text-[9px] leading-none ${activeVariant.labelClass}`}
                >
                  카드 코드
                </p>
                <p className="mt-1 text-[11px] font-semibold leading-none tracking-[0.12em] text-current">
                  {serialText}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}
