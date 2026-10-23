/**
 * 채팅 분양글 맥락 규칙(libs/shared/tradeChat.ts = 앱 src/lib/tradeChat.ts 사본). 앱 docs/prd/trade-review.md §3.2.
 */
import { chatProductAction, productStarterChips } from "@libs/shared/tradeChat";
import type { TradeState } from "@libs/shared/tradeReview";

describe("productStarterChips", () => {
  it("용품 · 포유류 · 그 외 생물로 세 번째 질문이 달라진다", () => {
    expect(productStarterChips({ productType: "용품", categoryPath: "/mammal/dog/" })[2]).toBe("직거래 가능한가요?");
    expect(productStarterChips({ productType: "생물", categoryPath: "/mammal/dog/" })[2]).toBe("직접 보러 가도 될까요?");
    expect(productStarterChips({ productType: null, categoryPath: "/reptile/gecko/" })[2]).toBe("생물 택배 가능한가요?");
  });
});

describe("chatProductAction", () => {
  it("분양자는 분양완료 전 sold, 지정된 입양자는 확정 전 confirm · 확정 뒤 review", () => {
    const base: TradeState = {
      viewerId: 1,
      sellerId: 1,
      status: "판매중",
      buyerId: null,
      buyerSource: null,
      purchaseConfirmed: false,
      hasReview: false,
      hasReply: false,
      isDeleted: false,
    };
    expect(chatProductAction(base)).toBe("sold");
    const sold = { ...base, status: "판매완료", buyerId: 2, buyerSource: "bredy" as const };
    expect(chatProductAction(sold)).toBeNull();
    expect(chatProductAction({ ...sold, viewerId: 2 })).toBe("confirm");
    expect(chatProductAction({ ...sold, viewerId: 2, purchaseConfirmed: true })).toBe("review");
    expect(chatProductAction({ ...sold, viewerId: 3 })).toBeNull();
  });

  it("임보 글(noTrade)은 분양자·입양자 모두 버튼이 없다(앱 docs/prd/pet-space.md §16)", () => {
    const foster: TradeState = {
      viewerId: 1,
      sellerId: 1,
      status: "판매중",
      buyerId: null,
      buyerSource: null,
      purchaseConfirmed: false,
      hasReview: false,
      hasReply: false,
      isDeleted: false,
      noTrade: true,
    };
    expect(chatProductAction(foster)).toBeNull();
    expect(
      chatProductAction({ ...foster, status: "판매완료", buyerId: 2, buyerSource: "bredy", viewerId: 2 })
    ).toBeNull();
  });
});
