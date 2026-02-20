"use client";

import Image from "@components/atoms/Image";
import { useEffect } from "react";

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

  return (
    <div
      className="fixed inset-0 z-[120] bg-black/90 p-3 sm:p-6"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <button
        type="button"
        className="absolute right-4 top-4 z-10 rounded-full bg-white/15 px-3 py-1.5 text-sm text-white backdrop-blur"
        onClick={onClose}
      >
        닫기
      </button>

      <div
        className="relative mx-auto flex h-full w-full max-w-5xl items-center justify-center"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="relative h-[82vh] w-full">
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
              onClick={() => onIndexChange((safeIndex - 1 + images.length) % images.length)}
              className="absolute left-0 rounded-full bg-white/15 p-3 text-white backdrop-blur"
              aria-label="이전 이미지"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={() => onIndexChange((safeIndex + 1) % images.length)}
              className="absolute right-0 rounded-full bg-white/15 p-3 text-white backdrop-blur"
              aria-label="다음 이미지"
            >
              ›
            </button>
          </>
        )}
      </div>

      <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/40 px-3 py-1 text-xs text-white">
        {safeIndex + 1} / {images.length}
      </div>

    </div>
  );
};

export default ImageLightbox;
