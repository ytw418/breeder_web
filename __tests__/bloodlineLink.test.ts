/**
 * @jest-environment node
 */

/**
 * 상품·경매에 혈통 붙이기 권한과 상세 요약 — libs/server/bloodline-link.ts
 * 권한: ACTIVE BLOODLINE 이고 (지금 보유자 = 나) 또는 (그 뿌리의 ACTIVE 출처 카드를 내가 보유). 만든 사람이라도 넘긴 뒤에는 못 붙인다.
 * 요약: 뷰어와 무관(웹 SSR 비로그인 fetch 와 같은 결과). 산지 표시는 libs/shared/regions formatRegionShort.
 */
import { Prisma } from "@prisma/client";

const mockClient = {
  bloodlineCard: { findFirst: jest.fn() },
  bloodlineCardTransfer: { findFirst: jest.fn() },
};
jest.mock("@libs/server/client", () => ({
  __esModule: true,
  default: mockClient,
}));

import {
  canAttachBloodline,
  getBloodlineLinkSummary,
  pedigreeNoteDbValue,
  readStoredPedigreeNote,
} from "@libs/server/bloodline-link";
import { formatRegionShort } from "@libs/shared/regions";

const ROOT = {
  id: 10,
  name: "강산 라인",
  speciesType: "사슴벌레",
  originSido: "충청남도",
  originSigungu: "공주시",
  creatorId: 1,
  currentOwnerId: 1,
  creator: { id: 1, name: "강산" },
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe("canAttachBloodline", () => {
  it("없거나 회수된 혈통이면 not_found", async () => {
    mockClient.bloodlineCard.findFirst.mockResolvedValueOnce(null);
    await expect(canAttachBloodline(10, 7)).resolves.toEqual({ ok: false, reason: "not_found" });
    expect(mockClient.bloodlineCard.findFirst).toHaveBeenCalledWith({
      where: { id: 10, cardType: "BLOODLINE", status: "ACTIVE" },
      select: { id: true, currentOwnerId: true },
    });
  });

  it("지금 보유한 혈통이면 mine", async () => {
    mockClient.bloodlineCard.findFirst.mockResolvedValueOnce({ id: 10, currentOwnerId: 7 });
    await expect(canAttachBloodline(10, 7)).resolves.toEqual({ ok: true, relation: "mine" });
    expect(mockClient.bloodlineCard.findFirst).toHaveBeenCalledTimes(1);
  });

  it("그 뿌리의 출처 카드를 가졌으면 received", async () => {
    mockClient.bloodlineCard.findFirst
      .mockResolvedValueOnce({ id: 10, currentOwnerId: 1 })
      .mockResolvedValueOnce({ id: 21 });
    await expect(canAttachBloodline(10, 7)).resolves.toEqual({ ok: true, relation: "received", lineCardId: 21 });
    expect(mockClient.bloodlineCard.findFirst).toHaveBeenLastCalledWith({
      where: { cardType: "LINE", bloodlineReferenceId: 10, status: "ACTIVE", currentOwnerId: 7 },
      select: { id: true },
      orderBy: { createdAt: "asc" },
    });
  });

  it("만든 사람이라도 넘긴 뒤에는 forbidden", async () => {
    mockClient.bloodlineCard.findFirst
      .mockResolvedValueOnce({ id: 10, currentOwnerId: 2 })
      .mockResolvedValueOnce(null);
    await expect(canAttachBloodline(10, 1)).resolves.toEqual({ ok: false, reason: "forbidden" });
  });

  it("id 가 양의 정수가 아니면 조회 없이 not_found", async () => {
    await expect(canAttachBloodline(0, 7)).resolves.toEqual({ ok: false, reason: "not_found" });
    await expect(canAttachBloodline(Number.NaN, 7)).resolves.toEqual({ ok: false, reason: "not_found" });
    expect(mockClient.bloodlineCard.findFirst).not.toHaveBeenCalled();
  });
});

describe("getBloodlineLinkSummary", () => {
  it("판매자가 만든 혈통이면 creator", async () => {
    mockClient.bloodlineCard.findFirst.mockResolvedValueOnce(ROOT);
    await expect(getBloodlineLinkSummary(10, 1)).resolves.toEqual({
      id: 10,
      name: "강산 라인",
      speciesType: "사슴벌레",
      originLabel: "충남 공주",
      creator: { id: 1, name: "강산" },
      sellerRelation: "creator",
      receivedAt: null,
    });
    expect(mockClient.bloodlineCard.findFirst).toHaveBeenCalledWith({
      where: { id: 10, cardType: "BLOODLINE", status: "ACTIVE" },
      select: {
        id: true,
        name: true,
        speciesType: true,
        originSido: true,
        originSigungu: true,
        creatorId: true,
        currentOwnerId: true,
        creator: { select: { id: true, name: true } },
      },
    });
  });

  it("남이 만든 혈통을 넘겨받아 보유하면 holder", async () => {
    mockClient.bloodlineCard.findFirst.mockResolvedValueOnce({ ...ROOT, currentOwnerId: 3 });
    await expect(getBloodlineLinkSummary(10, 3)).resolves.toMatchObject({
      sellerRelation: "holder",
      receivedAt: null,
    });
  });

  it("출처 카드를 직접 받았으면 received + 받은 날", async () => {
    mockClient.bloodlineCard.findFirst
      .mockResolvedValueOnce(ROOT)
      .mockResolvedValueOnce({ id: 21, transferCount: 0, createdAt: new Date("2026-09-12T03:00:00.000Z") });
    await expect(getBloodlineLinkSummary(10, 7)).resolves.toMatchObject({
      sellerRelation: "received",
      receivedAt: "2026-09-12T03:00:00.000Z",
    });
    expect(mockClient.bloodlineCardTransfer.findFirst).not.toHaveBeenCalled();
  });

  it("다음 분에게서 넘겨받은 출처 카드면 마지막으로 넘겨받은 날", async () => {
    mockClient.bloodlineCard.findFirst
      .mockResolvedValueOnce(ROOT)
      .mockResolvedValueOnce({ id: 21, transferCount: 1, createdAt: new Date("2026-09-12T03:00:00.000Z") });
    mockClient.bloodlineCardTransfer.findFirst.mockResolvedValueOnce({
      createdAt: new Date("2026-09-20T03:00:00.000Z"),
    });
    await expect(getBloodlineLinkSummary(10, 7)).resolves.toMatchObject({
      sellerRelation: "received",
      receivedAt: "2026-09-20T03:00:00.000Z",
    });
    expect(mockClient.bloodlineCardTransfer.findFirst).toHaveBeenCalledWith({
      where: { cardId: 21, toUserId: 7 },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });
  });

  it("판매자가 지금은 관계가 없으면 none", async () => {
    mockClient.bloodlineCard.findFirst.mockResolvedValueOnce({ ...ROOT, currentOwnerId: 3 }).mockResolvedValueOnce(null);
    await expect(getBloodlineLinkSummary(10, 7)).resolves.toMatchObject({
      sellerRelation: "none",
      receivedAt: null,
    });
  });

  it("회수·숨김·없는 혈통이면 null", async () => {
    mockClient.bloodlineCard.findFirst.mockResolvedValueOnce(null);
    await expect(getBloodlineLinkSummary(10, 1)).resolves.toBeNull();
    await expect(getBloodlineLinkSummary(null, 1)).resolves.toBeNull();
  });

  it("만든 사람이 없으면(탈퇴) 탈퇴한 사용자로 둔다", async () => {
    mockClient.bloodlineCard.findFirst.mockResolvedValueOnce({ ...ROOT, creator: null, originSido: null });
    await expect(getBloodlineLinkSummary(10, 1)).resolves.toMatchObject({
      creator: { id: 1, name: "탈퇴한 사용자" },
      originLabel: null,
    });
  });
});

describe("pedigreeNote 저장값", () => {
  it("null 이면 DbNull, 값이면 그대로", () => {
    expect(pedigreeNoteDbValue(null)).toBe(Prisma.DbNull);
    expect(pedigreeNoteDbValue({ sireMm: 81.2, generation: "F3" })).toEqual({ sireMm: 81.2, generation: "F3" });
  });

  it("저장된 값은 규칙에 맞는 키만 읽는다", () => {
    expect(readStoredPedigreeNote({ sireMm: 81.2, foo: 1 })).toEqual({ sireMm: 81.2 });
    expect(readStoredPedigreeNote({ sireMm: 81.25 })).toBeNull();
    expect(readStoredPedigreeNote("garbage")).toBeNull();
    expect(readStoredPedigreeNote(null)).toBeNull();
    expect(readStoredPedigreeNote(undefined)).toBeNull();
  });
});

describe("formatRegionShort", () => {
  it("도는 시·도 축약 + 시·군 이름", () => {
    expect(formatRegionShort({ sido: "충청남도", sigungu: "공주시" })).toBe("충남 공주");
    expect(formatRegionShort({ sido: "경기도", sigungu: "연천군" })).toBe("경기 연천");
    expect(formatRegionShort({ sido: "강원특별자치도", sigungu: "춘천시" })).toBe("강원 춘천");
    expect(formatRegionShort({ sido: "전북특별자치도", sigungu: "전주시" })).toBe("전북 전주");
    expect(formatRegionShort({ sido: "제주특별자치도", sigungu: "서귀포시" })).toBe("제주 서귀포");
    // 같은 이름이 겹치면 한 번만
    expect(formatRegionShort({ sido: "제주특별자치도", sigungu: "제주시" })).toBe("제주");
  });

  it("특별시·광역시·세종은 시·도 축약만", () => {
    expect(formatRegionShort({ sido: "서울특별시", sigungu: "강남구" })).toBe("서울");
    expect(formatRegionShort({ sido: "부산광역시", sigungu: "해운대구" })).toBe("부산");
    expect(formatRegionShort({ sido: "세종특별자치시", sigungu: "세종특별자치시" })).toBe("세종");
  });

  it("시·도만 있으면 축약, 없으면 null", () => {
    expect(formatRegionShort({ sido: "충청남도" })).toBe("충남");
    expect(formatRegionShort({ sido: "충청남도", sigungu: null })).toBe("충남");
    expect(formatRegionShort({ sigungu: "공주시" })).toBeNull();
    expect(formatRegionShort(null)).toBeNull();
    expect(formatRegionShort(undefined)).toBeNull();
    // 목록 밖 값은 받은 그대로
    expect(formatRegionShort({ sido: "어딘가" })).toBe("어딘가");
  });
});
