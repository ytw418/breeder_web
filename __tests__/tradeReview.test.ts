/**
 * 입양자 지정·거래 후기 규칙(libs/shared/tradeReview.ts = 앱 src/lib/tradeReview.ts 사본). 앱 docs/prd/trade-review.md §3.1.
 */
import {
  canChangeBuyer,
  canConfirmAdoption,
  canReplyTradeReview,
  canWriteTradeReview,
  isTradelessDeal,
  keywordsForProduct,
  normalizeReviewKeywords,
  tradeReviewSummary,
  tradeStatusLine,
  type TradeState,
} from "@libs/shared/tradeReview";

const SELLER = 1;
const BUYER = 2;
const OTHER = 3;

const assigned: TradeState = {
  viewerId: BUYER,
  sellerId: SELLER,
  status: "판매완료",
  buyerId: BUYER,
  buyerSource: "bredy",
  purchaseConfirmed: false,
  hasReview: false,
  hasReply: false,
  isDeleted: false,
};

const can = (state: TradeState) => ({
  confirm: canConfirmAdoption(state),
  review: canWriteTradeReview(state),
  reply: canReplyTradeReview(state),
  changeBuyer: canChangeBuyer(state),
});

describe("거래 단계별 버튼", () => {
  it("지정 → 확정 → 후기 → 답글로 넘어가고, 확정·후기가 생기면 입양자를 바꿀 수 없다", () => {
    expect(can(assigned)).toEqual({ confirm: true, review: false, reply: false, changeBuyer: false });
    expect(can({ ...assigned, viewerId: OTHER })).toEqual({ confirm: false, review: false, reply: false, changeBuyer: false });
    expect(can({ ...assigned, viewerId: SELLER })).toEqual({ confirm: false, review: false, reply: false, changeBuyer: true });
    // 미지정 글은 누구도 확정할 수 없다(요청 경로만)
    expect(can({ ...assigned, buyerId: null, buyerSource: null }).confirm).toBe(false);

    const confirmed = { ...assigned, purchaseConfirmed: true };
    expect(can(confirmed)).toEqual({ confirm: false, review: true, reply: false, changeBuyer: false });
    // 확정 뒤 분양자가 글을 지워도 후기는 쓸 수 있다
    expect(canWriteTradeReview({ ...confirmed, isDeleted: true })).toBe(true);
    expect(canChangeBuyer({ ...confirmed, viewerId: SELLER })).toBe(false);

    const reviewed = { ...confirmed, hasReview: true };
    expect(can(reviewed)).toEqual({ confirm: false, review: false, reply: false, changeBuyer: false });
    expect(canReplyTradeReview({ ...reviewed, viewerId: SELLER })).toBe(true);
    expect(canReplyTradeReview({ ...reviewed, viewerId: SELLER, hasReply: true })).toBe(false);
  });

  it("임보 글(noTrade)은 입양 확정·입양자 지정·입양자 행이 없다(앱 docs/prd/pet-space.md §16)", () => {
    expect(isTradelessDeal("foster")).toBe(true);
    expect(isTradelessDeal("adoption")).toBe(false);
    expect(isTradelessDeal("rehoming")).toBe(false);
    expect(isTradelessDeal(null)).toBe(false);

    const foster = { ...assigned, noTrade: true };
    expect(can(foster)).toEqual({ confirm: false, review: false, reply: false, changeBuyer: false });
    expect(canChangeBuyer({ ...foster, viewerId: SELLER })).toBe(false);
    expect(tradeStatusLine({ ...foster, viewerId: SELLER }, "입양자")).toBeNull();
    // 고치기 전에 입양 확정까지 간 글은 후기 자격을 그대로 둔다(글 종류를 바꿔 후기를 막지 못하게).
    expect(canWriteTradeReview({ ...foster, purchaseConfirmed: true })).toBe(true);
  });
});

describe("normalizeReviewKeywords", () => {
  it("정해진 순서로 중복을 지우고, 0개·6개·모르는 키·용품에 개체 키워드는 null", () => {
    expect(normalizeReviewKeywords(["kind", "fast_reply", "kind"], "생물")).toEqual(["fast_reply", "kind"]);
    expect(normalizeReviewKeywords([], "생물")).toBeNull();
    expect(
      normalizeReviewKeywords(["as_described", "healthy", "care_info", "aftercare", "fast_reply", "kind"], "생물")
    ).toBeNull();
    expect(normalizeReviewKeywords(["nope"], "생물")).toBeNull();
    expect(normalizeReviewKeywords("kind", "생물")).toBeNull();
    expect(normalizeReviewKeywords(["healthy", "kind"], "용품")).toBeNull();
    expect(keywordsForProduct("용품").some((item) => item.key === "healthy")).toBe(false);
  });

  it("요약은 첫 키워드 + 나머지 수", () => {
    expect(tradeReviewSummary(["fast_reply", "kind", "punctual"])).toBe("응답이 빨라요 외 2개");
  });
});
