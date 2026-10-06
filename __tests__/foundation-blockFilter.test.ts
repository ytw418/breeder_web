import { withoutBlocked } from "@libs/shared/blockFilter";

type Row = { id: number; ownerId?: number | null };

describe("withoutBlocked", () => {
  const rows: Row[] = [
    { id: 1, ownerId: 10 },
    { id: 2, ownerId: 20 },
    { id: 3, ownerId: null },
    { id: 4 },
  ];

  it("차단한 사용자의 항목을 뺀다", () => {
    expect(withoutBlocked(rows, new Set([20]), (row) => row.ownerId).map((r) => r.id)).toEqual([
      1, 3, 4,
    ]);
  });

  it("작성자를 알 수 없는 항목은 남긴다", () => {
    const result = withoutBlocked(rows, new Set([10, 20]), (row) => row.ownerId);
    expect(result.map((r) => r.id)).toEqual([3, 4]);
  });

  it("차단 목록이 비면 그대로(새 배열) 돌려준다", () => {
    const result = withoutBlocked(rows, new Set(), (row) => row.ownerId);
    expect(result).toEqual(rows);
    expect(result).not.toBe(rows);
  });
});
