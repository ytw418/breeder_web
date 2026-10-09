"use client";

/**
 * 혈통 사진 정사각형 자르기 창 — 앱은 기기 사진 편집기(expo-image-picker allowsEditing, aspect 1:1)를 쓰고
 * 웹은 이 창을 쓴다(2026-10-09 사용자 결정: 상세 사진이 1:1 이라 올릴 때 맞춰 자른다).
 *
 * overlay 위 시트(bgElevated, radius 12): 제목 "사진 자르기" 18/700 → 정사각형 칸(끌어서 옮기기, 두 손가락·휠로 확대)
 * → 확대 슬라이더 → 보조 "취소" + 주황 "완료". 완료하면 칸에 보이는 부분을 JPEG(최대 1440px)로 만들어 넘긴다.
 * 브라우저가 열 수 없는 형식(크롬의 HEIC 등)이면 자르지 않고 원본을 그대로 넘긴다(Cloudflare 가 변환, 화면은 cover).
 */
import { PointerEvent, WheelEvent, useEffect, useRef, useState } from "react";
import {
  SQUARE_CROP_MAX_ZOOM,
  clampSquareCropOffset,
  clampSquareCropZoom,
  squareCropBaseScale,
  squareCropOutputSize,
  squareCropSourceRect,
  type SquareCropOffset,
} from "@libs/client/squareCrop";
import {
  BloodlinePrimaryButton,
  BloodlineSecondaryButton,
  BloodlineSpinner,
} from "@components/features/bloodline/BloodlineScreenParts";

const OUTPUT_TYPE = "image/jpeg";
const OUTPUT_QUALITY = 0.9;

interface SquareImageCropperProps {
  file: File;
  onCancel: () => void;
  /** 자른 결과(JPEG). 브라우저가 사진을 못 열면 원본 file 그대로. */
  onDone: (file: File) => void;
}

/** 확장자를 .jpg 로 바꾼 파일 이름. */
function croppedFileName(name: string) {
  const base = name.replace(/\.[^.]+$/, "") || "bloodline-photo";
  return `${base}.jpg`;
}

export default function SquareImageCropper({ file, onCancel, onDone }: SquareImageCropperProps) {
  const [src, setSrc] = useState("");
  const [natural, setNatural] = useState<{ width: number; height: number } | null>(null);
  const [viewport, setViewport] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState<SquareCropOffset>({ x: 0, y: 0 });
  const [working, setWorking] = useState(false);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const pointersRef = useRef(new Map<number, { x: number; y: number }>());
  const pinchRef = useRef<number | null>(null);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // 칸 한 변(px)을 재 둔다. 창 크기가 바뀌면 다시 잰다.
  const frameRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const node = frameRef.current;
    if (!node) return;
    const measure = () => setViewport(node.clientWidth);
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  // Esc 로 닫는다.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  const applyZoom = (nextZoom: number) => {
    if (!natural || !viewport) return;
    const z = clampSquareCropZoom(nextZoom);
    setZoom(z);
    setOffset((prev) => clampSquareCropOffset(prev, natural.width, natural.height, viewport, z));
  };

  const moveBy = (dx: number, dy: number) => {
    if (!natural || !viewport) return;
    setOffset((prev) =>
      clampSquareCropOffset({ x: prev.x + dx, y: prev.y + dy }, natural.width, natural.height, viewport, zoom)
    );
  };

  const pinchDistance = () => {
    const [a, b] = Array.from(pointersRef.current.values());
    return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : null;
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    pinchRef.current = pointersRef.current.size === 2 ? pinchDistance() : null;
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const prev = pointersRef.current.get(event.pointerId);
    if (!prev) return;
    pointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointersRef.current.size === 1) {
      moveBy(event.clientX - prev.x, event.clientY - prev.y);
      return;
    }
    const distance = pinchDistance();
    if (distance && pinchRef.current) {
      applyZoom(zoom * (distance / pinchRef.current));
      pinchRef.current = distance;
    }
  };

  const handlePointerEnd = (event: PointerEvent<HTMLDivElement>) => {
    pointersRef.current.delete(event.pointerId);
    pinchRef.current = pointersRef.current.size === 2 ? pinchDistance() : null;
  };

  const handleWheel = (event: WheelEvent<HTMLDivElement>) => {
    applyZoom(zoom * Math.exp(-event.deltaY * 0.0015));
  };

  const handleDone = async () => {
    const image = imageRef.current;
    if (working) return;
    // 크기를 못 쟀으면(사진·칸이 0) 자르지 않고 원본을 넘긴다.
    if (!image || !natural?.width || !natural.height || !viewport) {
      onDone(file);
      return;
    }
    setWorking(true);
    try {
      const rect = squareCropSourceRect(natural.width, natural.height, viewport, zoom, offset);
      const size = squareCropOutputSize(rect.size);
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("canvas");
      context.drawImage(image, rect.sx, rect.sy, rect.size, rect.size, 0, 0, size, size);
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, OUTPUT_TYPE, OUTPUT_QUALITY)
      );
      if (!blob) throw new Error("toBlob");
      onDone(new File([blob], croppedFileName(file.name), { type: OUTPUT_TYPE }));
    } catch (error) {
      // 그리기에 실패하면 원본을 올린다(화면은 cover 로 정사각형을 보여 준다).
      console.warn("[bloodline-crop] 자르기 실패, 원본을 올린다", error);
      onDone(file);
    } finally {
      setWorking(false);
    }
  };

  const baseScale = natural && viewport ? squareCropBaseScale(natural.width, natural.height, viewport) : 0;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-app-overlay px-4" onClick={onCancel}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="square-cropper-title"
        className="w-full max-w-[400px] rounded-xl bg-app-elevated px-4 pb-4 pt-5"
        onClick={(event) => event.stopPropagation()}
      >
        <p id="square-cropper-title" className="text-[18px] font-bold tracking-[-0.3px] text-app-text">
          사진 자르기
        </p>
        <p className="mt-1 text-[14px] tracking-[-0.2px] text-app-muted">
          끌어서 옮기고, 아래 막대로 크게 볼 수 있어요
        </p>

        <div
          ref={frameRef}
          className="relative mt-4 aspect-square w-full touch-none select-none overflow-hidden rounded-md bg-app-placeholder"
          style={{ cursor: natural ? "grab" : "default" }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerEnd}
          onPointerCancel={handlePointerEnd}
          onWheel={handleWheel}
        >
          {src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              ref={imageRef}
              src={src}
              alt="자를 사진"
              draggable={false}
              onLoad={(event) =>
                setNatural({
                  width: event.currentTarget.naturalWidth,
                  height: event.currentTarget.naturalHeight,
                })
              }
              // 브라우저가 못 여는 형식이면 자르지 않고 원본을 넘긴다
              onError={() => onDone(file)}
              className="pointer-events-none absolute left-1/2 top-1/2 max-w-none"
              style={{
                width: natural ? natural.width * baseScale : undefined,
                height: natural ? natural.height * baseScale : undefined,
                visibility: natural && viewport ? "visible" : "hidden",
                transform: `translate(-50%, -50%) translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
              }}
            />
          ) : null}
          {!natural ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <BloodlineSpinner />
            </div>
          ) : null}
        </div>

        <input
          type="range"
          aria-label="확대"
          min={1}
          max={SQUARE_CROP_MAX_ZOOM}
          step={0.01}
          value={zoom}
          disabled={!natural}
          onChange={(event) => applyZoom(Number(event.target.value))}
          className="mt-4 w-full accent-app-text"
        />

        <div className="mt-4 flex gap-2">
          <BloodlineSecondaryButton onClick={onCancel} disabled={working}>
            취소
          </BloodlineSecondaryButton>
          <BloodlinePrimaryButton onClick={() => void handleDone()} disabled={!natural || working}>
            {working ? "자르는 중..." : "완료"}
          </BloodlinePrimaryButton>
        </div>
      </div>
    </div>
  );
}
