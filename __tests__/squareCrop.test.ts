import {
  SQUARE_CROP_MAX_ZOOM,
  clampSquareCropOffset,
  clampSquareCropZoom,
  squareCropBaseScale,
  squareCropOutputSize,
  squareCropSourceRect,
} from "@libs/client/squareCrop";

describe("squareCrop", () => {
  it("기본 배율은 짧은 변이 정사각형 칸을 꽉 채우는 값이다", () => {
    expect(squareCropBaseScale(4000, 3000, 300)).toBeCloseTo(0.1);
    expect(squareCropBaseScale(1000, 2000, 400)).toBeCloseTo(0.4);
  });

  it("배율은 1~최대 사이로 자른다", () => {
    expect(clampSquareCropZoom(0.5)).toBe(1);
    expect(clampSquareCropZoom(2)).toBe(2);
    expect(clampSquareCropZoom(99)).toBe(SQUARE_CROP_MAX_ZOOM);
    expect(clampSquareCropZoom(Number.NaN)).toBe(1);
  });

  it("이동은 사진이 칸 밖으로 비지 않는 만큼만 허용한다", () => {
    // 4000x3000 → 칸 300 기준 400x300 으로 보인다. 가로로 ±50, 세로로 0 만 움직일 수 있다
    expect(clampSquareCropOffset({ x: 80, y: 30 }, 4000, 3000, 300, 1)).toEqual({ x: 50, y: 0 });
    expect(clampSquareCropOffset({ x: -80, y: -30 }, 4000, 3000, 300, 1)).toEqual({ x: -50, y: 0 });
    // 2배면 800x600 → 가로 ±250, 세로 ±150
    expect(clampSquareCropOffset({ x: 300, y: -200 }, 4000, 3000, 300, 2)).toEqual({ x: 250, y: -150 });
  });

  it("가운데·기본 배율이면 짧은 변 크기의 가운데 정사각형을 자른다", () => {
    expect(squareCropSourceRect(4000, 3000, 300, 1, { x: 0, y: 0 })).toEqual({
      sx: 500,
      sy: 0,
      size: 3000,
    });
  });

  it("오른쪽으로 끝까지 밀면 사진 왼쪽 끝을, 2배면 절반 크기를 자른다", () => {
    expect(squareCropSourceRect(4000, 3000, 300, 1, { x: 50, y: 0 })).toEqual({ sx: 0, sy: 0, size: 3000 });
    expect(squareCropSourceRect(4000, 3000, 300, 2, { x: 0, y: 0 })).toEqual({
      sx: 1250,
      sy: 750,
      size: 1500,
    });
  });

  it("범위를 넘는 값이 와도 사진 안쪽 사각형을 돌려준다", () => {
    const rect = squareCropSourceRect(4000, 3000, 300, 1, { x: 999, y: 999 });
    expect(rect.sx).toBeGreaterThanOrEqual(0);
    expect(rect.sy).toBeGreaterThanOrEqual(0);
    expect(rect.sx + rect.size).toBeLessThanOrEqual(4000);
    expect(rect.sy + rect.size).toBeLessThanOrEqual(3000);
  });

  it("결과 크기는 원본보다 키우지 않고 최대 1440 이다", () => {
    expect(squareCropOutputSize(3000)).toBe(1440);
    expect(squareCropOutputSize(800.4)).toBe(800);
    expect(squareCropOutputSize(0.2)).toBe(1);
  });
});
