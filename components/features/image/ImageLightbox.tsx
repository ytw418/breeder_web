"use client";

import Image from "@components/atoms/Image";
import { useEffect, useRef, useState } from "react";

interface ImageLightboxProps {
  images: string[];
  isOpen: boolean;
  currentIndex: number;
  onClose: () => void;
  onIndexChange: (nextIndex: number) => void;
  altPrefix?: string;
}

const DETAIL_FALLBACK_IMAGE = "/images/placeholders/minimal-gray-blur.svg";
/** 두 손가락 확대 범위와 두 번 탭 배율(2026-10-21 감사 #10). */
const MIN_SCALE = 1;
const MAX_SCALE = 3;
const DOUBLE_TAP_SCALE = 2;
const DOUBLE_TAP_MS = 300;
/** 이만큼 움직이면 탭이 아니라 끌기다. */
const TAP_SLOP_PX = 10;

type Point = { x: number; y: number };
type Zoom = { scale: number; x: number; y: number };
const NO_ZOOM: Zoom = { scale: 1, x: 0, y: 0 };
const clampScale = (value: number) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, value));
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

/**
 * 사진 확대: 두 손가락 벌리기(1~3배), 두 번 탭(2배 ↔ 원래), 확대한 채 한 손가락으로 끌어 옮기기.
 * 포인터 이벤트로 받아 마우스·터치 모두 된다. 확대 중이거나 두 손가락이면 좌우 넘기기를 하지 않는다.
 */
function usePinchZoom(resetKey: unknown) {
  const [zoom, setZoom] = useState<Zoom>(NO_ZOOM);
  const zoomRef = useRef<Zoom>(NO_ZOOM);
  const pointers = useRef(new Map<number, Point>());
  const pinchStart = useRef<{ distance: number; scale: number } | null>(null);
  const panStart = useRef<{ point: Point; zoom: Zoom } | null>(null);
  const tapStart = useRef<Point | null>(null);
  const lastTapAt = useRef(0);
  // 이번 손가락 동작에서 두 손가락을 썼거나 확대 상태였으면 넘기기를 막는다.
  const gestureBlocksSwipe = useRef(false);

  const apply = (next: Zoom) => {
    const settled = next.scale <= MIN_SCALE + 0.02 ? NO_ZOOM : next;
    zoomRef.current = settled;
    setZoom(settled);
  };

  useEffect(() => {
    zoomRef.current = NO_ZOOM;
    setZoom(NO_ZOOM);
    pointers.current.clear();
    pinchStart.current = null;
    panStart.current = null;
  }, [resetKey]);

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture?.(event.pointerId);
    const point = { x: event.clientX, y: event.clientY };
    pointers.current.set(event.pointerId, point);
    if (pointers.current.size === 1) {
      gestureBlocksSwipe.current = zoomRef.current.scale > MIN_SCALE;
      tapStart.current = point;
      panStart.current = { point, zoom: zoomRef.current };
    }
    if (pointers.current.size === 2) {
      const [a, b] = Array.from(pointers.current.values());
      pinchStart.current = { distance: distance(a, b) || 1, scale: zoomRef.current.scale };
      gestureBlocksSwipe.current = true;
      tapStart.current = null;
      panStart.current = null;
    }
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(event.pointerId)) return;
    const point = { x: event.clientX, y: event.clientY };
    pointers.current.set(event.pointerId, point);
    if (tapStart.current && distance(tapStart.current, point) > TAP_SLOP_PX) tapStart.current = null;
    if (pointers.current.size >= 2 && pinchStart.current) {
      const [a, b] = Array.from(pointers.current.values());
      const scale = clampScale((pinchStart.current.scale * distance(a, b)) / pinchStart.current.distance);
      apply({ ...zoomRef.current, scale });
      return;
    }
    if (pointers.current.size === 1 && panStart.current && panStart.current.zoom.scale > MIN_SCALE) {
      const start = panStart.current;
      apply({
        scale: start.zoom.scale,
        x: start.zoom.x + (point.x - start.point.x),
        y: start.zoom.y + (point.y - start.point.y),
      });
    }
  };

  const onPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(event.pointerId)) return;
    pointers.current.delete(event.pointerId);
    if (pointers.current.size < 2) pinchStart.current = null;
    if (pointers.current.size === 1) {
      // 두 손가락 중 하나를 떼면 남은 손가락으로 이어서 옮긴다.
      const [point] = Array.from(pointers.current.values());
      panStart.current = { point, zoom: zoomRef.current };
      return;
    }
    if (pointers.current.size > 0) return;
    panStart.current = null;
    if (!tapStart.current) return;
    tapStart.current = null;
    const now = Date.now();
    if (now - lastTapAt.current < DOUBLE_TAP_MS) {
      lastTapAt.current = 0;
      gestureBlocksSwipe.current = true;
      apply(zoomRef.current.scale > MIN_SCALE ? NO_ZOOM : { scale: DOUBLE_TAP_SCALE, x: 0, y: 0 });
    } else {
      lastTapAt.current = now;
    }
  };

  return {
    zoom,
    isZoomed: zoom.scale > MIN_SCALE,
    blocksSwipe: () => gestureBlocksSwipe.current || zoomRef.current.scale > MIN_SCALE,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel: onPointerUp,
    },
  };
}

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
  const pinch = usePinchZoom(`${isOpen}-${safeIndex}`);

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

    // 확대했거나 두 손가락으로 벌린 동작이면 사진을 넘기지 않는다.
    if (startX === null || endX === null || images.length <= 1 || pinch.blocksSwipe()) return;

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
        <div
          className="relative h-full w-full max-w-5xl overflow-hidden"
          // 브라우저 기본 확대·스크롤 대신 직접 확대한다(앱 ImageViewer 와 같은 동작).
          style={{ touchAction: "none" }}
          onClick={(event) => event.stopPropagation()}
          {...pinch.handlers}
        >
          <div
            className="absolute inset-0"
            style={{
              transform: `translate3d(${pinch.zoom.x}px, ${pinch.zoom.y}px, 0) scale(${pinch.zoom.scale})`,
              transition: pinch.isZoomed ? undefined : "transform 150ms ease-out",
            }}
          >
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
