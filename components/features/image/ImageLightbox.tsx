"use client";

import Image from "@components/atoms/Image";
import { useEffect, useRef } from "react";

interface ImageLightboxProps {
  images: string[];
  isOpen: boolean;
  currentIndex: number;
  onClose: () => void;
  onIndexChange: (nextIndex: number) => void;
  altPrefix?: string;
}

const DETAIL_FALLBACK_IMAGE = "/images/placeholders/minimal-gray-blur.svg";

const ImageLightbox = ({
  images,
  isOpen,
  currentIndex,
  onClose,
  onIndexChange,
  altPrefix = "이미지",
}: ImageLightboxProps) => {
  const hasImages = images.length > 0;
  const safeIndex = hasImages ? ((currentIndex % images.length) + images.length) % images.length : 0;
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);

  const handleTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    touchStartX.current = event.targetTouches[0].clientX;
    touchEndX.current = null;
  };

  const handleTouchMove = (event: React.TouchEvent<HTMLDivElement>) => {
    touchEndX.current = event.targetTouches[0].clientX;
  };

  const handleTouchEnd = () => {
    const startX = touchStartX.current;
    const endX = touchEndX.current;

    touchStartX.current = null;
    touchEndX.current = null;

    if (startX === null || endX === null || images.length <= 1) return;

    const distance = startX - endX;
    if (distance > 50) onIndexChange((safeIndex + 1) % images.length);
    if (distance < -50) onIndexChange((safeIndex - 1 + images.length) % images.length);
  };
  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (!hasImages) return;
      if (event.key === "ArrowRight") onIndexChange((safeIndex + 1) % images.length);
      if (event.key === "ArrowLeft") onIndexChange((safeIndex - 1 + images.length) % images.length);
    };

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [hasImages, images.length, isOpen, onClose, onIndexChange, safeIndex]);

  if (!isOpen || !hasImages) return null;

  const goPrevious = () => onIndexChange((safeIndex - 1 + images.length) % images.length);
  const goNext = () => onIndexChange((safeIndex + 1) % images.length);

  // 검정 배경 고정(테마 무관). 위: 닫기(44) + 가운데 "n / N", 넓은 화면은 좌우 ←/→ 버튼.
  return (
    <div
      className="fixed inset-0 z-[120] flex flex-col bg-black text-white"
      role="dialog"
      aria-modal="true"
      aria-label={`${altPrefix} 보기`}
    >
      <div className="relative flex h-14 shrink-0 items-center justify-center pt-[env(safe-area-inset-top)]">
        <button
          type="button"
          onClick={onClose}
          className="absolute left-2 grid h-11 w-11 place-items-center rounded-full"
          aria-label="닫기"
        >
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <span className="text-[15px] font-medium tabular-nums" aria-live="polite">
          {safeIndex + 1} / {images.length}
        </span>
      </div>

      <div
        className="relative flex min-h-0 flex-1 items-center justify-center pb-[env(safe-area-inset-bottom)]"
        onClick={onClose}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div className="relative h-full w-full max-w-5xl" onClick={(event) => event.stopPropagation()}>
          <Image
            src={images[safeIndex]}
            fallbackSrc={DETAIL_FALLBACK_IMAGE}
            alt={`${altPrefix} ${safeIndex + 1}`}
            fill
            className="object-contain"
            sizes="100vw"
            quality={100}
            priority
          />
        </div>

        {images.length > 1 && (
          <>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                goPrevious();
              }}
              className="absolute left-3 top-1/2 hidden h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/15 sm:grid"
              aria-label="이전 이미지"
            >
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                goNext();
              }}
              className="absolute right-3 top-1/2 hidden h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white/15 sm:grid"
              aria-label="다음 이미지"
            >
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default ImageLightbox;
