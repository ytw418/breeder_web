"use client";

import { useEffect, useRef, type ReactNode } from "react";
import Image from "@components/atoms/Image";
import { cn, makeImageUrl } from "@libs/client/utils";

const aspectClass = (aspect: "4/3" | "1/1") =>
  aspect === "4/3" ? "aspect-[4/3]" : "aspect-square";

/** 사진이 없을 때 자리(앱 상품 상세와 같은 app-surface 박스 + 48px image 라인 아이콘). */
export function ImageCarouselPlaceholder({
  aspect = "1/1",
  className,
}: {
  aspect?: "4/3" | "1/1";
  className?: string;
}) {
  return (
    <div
      role="img"
      aria-label="사진 없음"
      className={cn(
        "grid w-full place-items-center bg-app-surface text-app-caption",
        aspectClass(aspect),
        className
      )}
    >
      <svg className="h-12 w-12" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
        />
      </svg>
    </div>
  );
}

/**
 * 상세 화면 사진 캐러셀: 가로 scroll-snap + 아래 가운데 도트. 사진을 누르면 onOpen(i)(라이트박스).
 * index 는 부모가 들고(onIndexChange), 밖에서 index 가 바뀌면 그 장으로 스크롤한다.
 * 도트는 앱과 같이 8px(간격 8, 아래 16), 누르면 그 장으로 간다.
 * 사진이 없으면 기본은 아무것도 그리지 않고, emptyFallback="placeholder" 면 사진 없음 박스,
 * 다른 ReactNode 면 그것을 그린다.
 */
export function ImageCarousel({
  images,
  index,
  onIndexChange,
  onOpen,
  aspect = "1/1",
  alt = "이미지",
  className,
  emptyFallback,
}: {
  images: string[];
  index: number;
  onIndexChange: (index: number) => void;
  onOpen?: (index: number) => void;
  aspect?: "4/3" | "1/1";
  alt?: string;
  className?: string;
  emptyFallback?: ReactNode | "placeholder";
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

  const goTo = (i: number) => {
    const el = scrollerRef.current;
    lastReported.current = i;
    onIndexChange(i);
    el?.scrollTo({ left: i * el.clientWidth, behavior: "smooth" });
  };

  if (images.length === 0) {
    if (emptyFallback === "placeholder") {
      return <ImageCarouselPlaceholder aspect={aspect} className={className} />;
    }
    return emptyFallback ? <>{emptyFallback}</> : null;
  }

  return (
    <div
      className={cn(
        "relative w-full overflow-hidden bg-app-placeholder",
        aspectClass(aspect),
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
        <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center gap-2">
          {images.map((src, i) => (
            <button
              key={`dot-${src}-${i}`}
              type="button"
              aria-label={`${i + 1}번 이미지로 이동`}
              aria-current={i === index ? "true" : undefined}
              onClick={() => goTo(i)}
              className={cn(
                "pointer-events-auto h-2 w-2 rounded-full bg-[#fff]",
                i === index ? "opacity-100" : "opacity-50"
              )}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default ImageCarousel;
