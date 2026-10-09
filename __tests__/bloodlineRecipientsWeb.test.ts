import {
  bloodlineReceivedCountText,
  filterBloodlineListingsPage,
  recipientRowMeta,
  recipientsSummaryText,
} from "@libs/client/bloodlineRecipients";

describe("혈통 받은 사람 문구(앱 bloodlineLabels 와 같음)", () => {
  it("직접 받음·재분양 메타에 날짜를 붙인다", () => {
    expect(recipientRowMeta({ via: "direct", receivedAt: "2026-09-12T03:00:00.000Z" })).toBe(
      "출처 카드 받음 · 2026.09.12"
    );
    expect(recipientRowMeta({ via: "rehomed", receivedAt: "2026-10-01T03:00:00.000Z" })).toBe(
      "재분양으로 이어받음 · 2026.10.01"
    );
    expect(recipientRowMeta({ via: "direct", receivedAt: "" })).toBe("출처 카드 받음");
  });

  it("요약은 첫 공개 이름 기준, 전부 비공개면 없다", () => {
    const visible = { user: { id: 3, name: "도윤파파" } };
    const masked = { user: { id: 0, name: "닉네임 비공개", masked: true } };
    expect(recipientsSummaryText([masked, visible], 3)).toBe("도윤파파 외 2");
    expect(recipientsSummaryText([visible], 1)).toBe("도윤파파");
    expect(recipientsSummaryText([masked], 1)).toBeNull();
    expect(bloodlineReceivedCountText(4)).toBe("받은 사람 4명");
  });
});

describe("이 혈통 분양글 필터", () => {
  it("이 혈통이 붙은 상품만 남긴다", () => {
    const result = filterBloodlineListingsPage(7, 1, {
      products: [{ id: 1, bloodlineRootId: 7 }, { id: 2, bloodlineRootId: 9 }],
      pages: 3,
    });
    expect(result).toEqual({ products: [{ id: 1, bloodlineRootId: 7 }], pages: 3 });
  });

  it("구 서버가 필터를 무시해 하나도 안 남으면 더 받지 않는다", () => {
    expect(
      filterBloodlineListingsPage(7, 2, { products: [{ id: 5, bloodlineRootId: null }], pages: 9 }).pages
    ).toBe(2);
    expect(filterBloodlineListingsPage(7, 1, { products: [], pages: 1 }).pages).toBe(1);
  });
});
