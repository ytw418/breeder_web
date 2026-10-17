import { withAdRows } from "@libs/shared/ads/adRows";

const rows = (count: number) => Array.from({ length: count }, (_, i) => i + 1);

describe("withAdRows", () => {
  it("8개마다 광고 행을 끼우고 슬롯 번호는 위치로 정한다", () => {
    expect(withAdRows(rows(17), true)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8,
      { kind: "ad", slot: 0 },
      9, 10, 11, 12, 13, 14, 15, 16,
      { kind: "ad", slot: 1 },
      17,
    ]);
  });

  it("마지막 행 뒤에는 광고를 붙이지 않는다", () => {
    expect(withAdRows(rows(8), true)).toEqual(rows(8));
  });

  it("끄면 목록을 그대로 돌려준다", () => {
    expect(withAdRows(rows(20), false)).toEqual(rows(20));
  });
});
