/**
 * 정사각형 사진 자르기 계산(SquareImageCropper). 화면 단위(px)와 원본 사진 단위(px)를 오간다.
 * - 칸: 한 변 viewport 인 정사각형. 사진은 기본 배율(짧은 변 = 칸)에 zoom 을 곱해 보이고,
 *   offset 은 칸 가운데에서 사진 가운데까지의 화면 거리다.
 * - 사진이 칸 밖으로 비지 않게 offset 을 자르고, 칸에 보이는 부분을 원본 좌표 정사각형으로 바꾼다.
 */

export const SQUARE_CROP_MAX_ZOOM = 4;
/** 결과 한 변 최대(px). 상세 사진은 화면 폭(최대 576)이라 레티나 2배를 넉넉히 덮는다. */
export const SQUARE_CROP_OUTPUT_MAX = 1440;

export interface SquareCropOffset {
  x: number;
  y: number;
}

export interface SquareCropRect {
  sx: number;
  sy: number;
  size: number;
}

/** 짧은 변이 칸을 꽉 채우는 배율. */
export function squareCropBaseScale(imageWidth: number, imageHeight: number, viewport: number): number {
  return viewport / Math.min(imageWidth, imageHeight);
}

export function clampSquareCropZoom(zoom: number): number {
  if (!Number.isFinite(zoom)) return 1;
  return Math.min(SQUARE_CROP_MAX_ZOOM, Math.max(1, zoom));
}

const clamp = (value: number, limit: number) => Math.min(limit, Math.max(-limit, value));

/** 사진 가장자리가 칸 안으로 들어오지 않는 만큼만 움직인다. */
export function clampSquareCropOffset(
  offset: SquareCropOffset,
  imageWidth: number,
  imageHeight: number,
  viewport: number,
  zoom: number
): SquareCropOffset {
  const scale = squareCropBaseScale(imageWidth, imageHeight, viewport) * zoom;
  const limitX = Math.max(0, (imageWidth * scale - viewport) / 2);
  const limitY = Math.max(0, (imageHeight * scale - viewport) / 2);
  // -0 을 0 으로 맞춘다(비교·직렬화가 깔끔하게).
  return { x: clamp(offset.x, limitX) || 0, y: clamp(offset.y, limitY) || 0 };
}

/** 칸에 보이는 부분 = 원본 사진의 정사각형(sx, sy, size). 늘 사진 안쪽이다. */
export function squareCropSourceRect(
  imageWidth: number,
  imageHeight: number,
  viewport: number,
  zoom: number,
  offset: SquareCropOffset
): SquareCropRect {
  const safeZoom = clampSquareCropZoom(zoom);
  const scale = squareCropBaseScale(imageWidth, imageHeight, viewport) * safeZoom;
  const size = Math.min(viewport / scale, imageWidth, imageHeight);
  const { x, y } = clampSquareCropOffset(offset, imageWidth, imageHeight, viewport, safeZoom);
  const centerX = imageWidth / 2 - x / scale;
  const centerY = imageHeight / 2 - y / scale;
  const sx = Math.min(imageWidth - size, Math.max(0, centerX - size / 2));
  const sy = Math.min(imageHeight - size, Math.max(0, centerY - size / 2));
  return { sx: Math.round(sx), sy: Math.round(sy), size: Math.round(size) };
}

/** 결과 한 변: 원본에서 자른 크기보다 키우지 않고 최대 SQUARE_CROP_OUTPUT_MAX. */
export function squareCropOutputSize(sourceSize: number): number {
  return Math.max(1, Math.min(SQUARE_CROP_OUTPUT_MAX, Math.round(sourceSize)));
}
