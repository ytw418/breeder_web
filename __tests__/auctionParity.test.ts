import {
  AUCTION_MAX_DURATION_MS,
  AUCTION_MIN_DURATION_MS,
  formatAuctionTimeLeft,
  getAuctionEditLockReason,
  getPresetEndAtMs,
  isAuctionDurationValid,
  isAuctionTimeOver,
  uniqueAuctionsById,
} from "@libs/auctionRules";

const MIN = 60_000;
const HOUR = 60 * MIN;

describe("getPresetEndAtMs (기간 프리셋 종료 시각)", () => {
  const now = Date.UTC(2026, 9, 6, 3, 17, 42, 500);

  it("72시간 프리셋은 상한(72h-1분) 안으로 잘려 서버 검증을 통과한다", () => {
    const end = getPresetEndAtMs(72, now);
    expect(end - now).toBeLessThanOrEqual(AUCTION_MAX_DURATION_MS - MIN);
    expect(end % MIN).toBe(0);
    // 요청이 59초 늦게 도착해도 범위 안
    expect(isAuctionDurationValid(new Date(end), new Date(now))).toBe(true);
    expect(isAuctionDurationValid(new Date(end), new Date(now + 59_000))).toBe(true);
  });

  it("1시간 프리셋은 하한(1h+1분) 이상", () => {
    const end = getPresetEndAtMs(1, now);
    expect(end - now).toBeGreaterThanOrEqual(AUCTION_MIN_DURATION_MS + MIN);
    expect(isAuctionDurationValid(new Date(end), new Date(now + 59_000))).toBe(true);
  });

  it("중간 프리셋은 분을 올린 뒤 N시간", () => {
    const ceil = Math.ceil(now / MIN) * MIN;
    expect(getPresetEndAtMs(24, now)).toBe(ceil + 24 * HOUR);
  });

  it("정각 now 에서도 72시간은 상한을 넘지 않는다", () => {
    const exact = Date.UTC(2026, 0, 1, 0, 0, 0, 0);
    expect(getPresetEndAtMs(72, exact)).toBe(exact + 72 * HOUR - MIN);
  });
});

describe("경매 남은 시간 표시", () => {
  const now = Date.UTC(2026, 0, 1);
  it("지났으면 마감", () => {
    expect(isAuctionTimeOver(new Date(now - 1), now)).toBe(true);
    expect(formatAuctionTimeLeft(new Date(now), now)).toBe("마감");
  });
  it("일·시간·분", () => {
    expect(formatAuctionTimeLeft(new Date(now + 26 * HOUR + 5 * MIN), now)).toBe("1일 2시간 남음");
    expect(formatAuctionTimeLeft(new Date(now + 2 * HOUR + 5 * MIN), now)).toBe("2시간 5분 남음");
    expect(formatAuctionTimeLeft(new Date(now + 5 * MIN + 30_000), now)).toBe("5분 남음");
    expect(isAuctionTimeOver(new Date(now + MIN), now)).toBe(false);
  });
  it("잘못된 날짜는 빈 문자열", () => {
    expect(formatAuctionTimeLeft("nope", now)).toBe("");
    expect(isAuctionTimeOver("nope", now)).toBe(false);
  });
});

describe("수정 불가 사유", () => {
  it("canEdit 이면 없음", () => {
    expect(getAuctionEditLockReason({ canEdit: true, status: "종료", bidCount: 3 })).toBeNull();
  });
  it("진행 상태 → 입찰 → 시간 순서", () => {
    expect(getAuctionEditLockReason({ canEdit: false, status: "종료", bidCount: 1 })).toBe("status");
    expect(getAuctionEditLockReason({ canEdit: false, status: "진행중", bidCount: 1 })).toBe("bid");
    expect(getAuctionEditLockReason({ canEdit: false, status: "진행중", bidCount: 0 })).toBe("time");
  });
});

describe("uniqueAuctionsById", () => {
  it("처음 것만 남긴다", () => {
    expect(
      uniqueAuctionsById([{ id: 1, v: "a" }, { id: 2, v: "b" }, { id: 1, v: "c" }]).map((x) => x.v)
    ).toEqual(["a", "b"]);
  });
});

describe("getAuctionResultMessage", () => {
   
  const { getAuctionResultMessage } = require("@libs/client/auctionErrorMessage");
  it("errorCode 문구 우선", () => {
    expect(getAuctionResultMessage({ errorCode: "BID_AUCTION_CLOSED", error: "x", status: 400 }, "f")).toBe(
      "이미 종료된 경매입니다."
    );
  });
  it("4xx 서버 문구", () => {
    expect(getAuctionResultMessage({ error: "서버 사유", status: 409 }, "f")).toBe("서버 사유");
  });
  it("5xx·문구 없음은 fallback", () => {
    expect(getAuctionResultMessage({ error: "Internal", status: 500 }, "f")).toBe("f");
    expect(getAuctionResultMessage(undefined, "f")).toBe("f");
  });
});
