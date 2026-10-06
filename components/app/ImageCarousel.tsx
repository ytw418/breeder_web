"use client";

import { useEffect, useRef } from "react";
import Image from "@components/atoms/Image";
import { cn, makeImageUrl } from "@libs/client/utils";

/**
 * 상세 화면 사진 캐러셀: 가로 scroll-snap + 아래 가운데 도트. 사진을 누르면 onOpen(i)(라이트박스).
 * index 는 부모가 들고(onIndexChange), 밖에서 index 가 바뀌면 그 장으로 스크롤한다.
 */
export function ImageCarousel({
  images,
  index,
  onIndexChange,
  onOpen,
  aspect = "1/1",
  alt = "이미지",
  className,
}: {
  images: string[];
  index: number;
  onIndexChange: (index: number) => void;
  onOpen?: (index: number) => void;
  aspect?: "4/3" | "1/1";
  alt?: string;
  className?: string;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const lastReported = useRef(index);

  // 밖에서 index 가 바뀌면(라이트박스에서 넘김 등) 그 장으로 맞춘다.
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el || lastReported.current === index) return;
    lastReported.current = index;
    el.scrollTo({ left: index * el.clientWidth, behavior: "smooth" });
  }, [index]);

  const handleScroll = () => {
    const el = scrollerRef.current;
    if (!el || el.clientWidth === 0) return;
    const next = Math.round(el.scrollLeft / el.clientWidth);
    if (next !== lastReported.current && next >= 0 && next < images.length) {
      lastReported.current = next;
      onIndexChange(next);
    }
  };

  if (images.length === 0) return null;

  return (
    <div
      className={cn(
        "relative w-full overflow-hidden bg-app-placeholder",
        aspect === "4/3" ? "aspect-[4/3]" : "aspect-square",
        className
      )}
    >
      <div
        ref={scrollerRef}
        onScroll={handleScroll}
        className="flex h-full w-full snap-x snap-mandatory overflow-x-auto scrollbar-hide"
      >
        {images.map((src, i) => (
          <button
            key={`${src}-${i}`}
            type="button"
            onClick={() => onOpen?.(i)}
            className="relative h-full w-full shrink-0 snap-center"
            aria-label={`${alt} ${i + 1} 크게 보기`}
            tabIndex={onOpen ? 0 : -1}
          >
            <Image
              src={makeImageUrl(src, "public")}
              alt={`${alt} ${i + 1}`}
              fill
              sizes="(max-width: 576px) 100vw, 576px"
              className="object-cover"
              priority={i === 0}
            />
          </button>
        ))}
      </div>
      {images.length > 1 ? (
        <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center gap-1.5">
          {images.map((src, i) => (
            <span
              key={`dot-${src}-${i}`}
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                i === index ? "bg-white" : "bg-white/50"
              )}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default ImageCarousel;
