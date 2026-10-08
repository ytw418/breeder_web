/**
 * @jest-environment node
 */

/**
 * 받은 사람 닉네임 비공개(마스킹) 규칙 — libs/server/bloodline-visibility.ts
 * 1. 뿌리 혈통의 creator·currentOwner 2. 뷰어 본인 3. 뷰어가 직접 보낸 사건의 받는 사람
 * 4. 이 뿌리 아래 ACTIVE 출처 카드를 ownerNameVisible=true 로 가진 사람 → 공개. 그 외 { id: 0, name: "닉네임 비공개", masked: true }.
 * 같은 파일에서 공용 mapper(libs/server/bloodline-mapper.ts)와 화면 공용 라벨(libs/shared/bloodline-card.ts)도 본다.
 */
const mockClient = {
  bloodlineCard: { findMany: jest.fn() },
  bloodlineCardEvent: { findMany: jest.fn() },
  product: { groupBy: jest.fn() },
};
jest.mock("@libs/server/client", () => ({
  __esModule: true,
  default: mockClient,
}));

import {
  buildVisibleUserIds,
  canSeeBloodlineEventNote,
  createBloodlineVisibility,
  loadBloodlineVisibility,
  maskedBloodlineUser,
  presentBloodlineUser,
  rootIdOf,
} from "@libs/server/bloodline-visibility";
import {
  countReceivedOwners,
  fetchListingCounts,
  fetchReceivedCounts,
  toBloodlineCardItem,
} from "@libs/server/bloodline-mapper";
import {
  BLOODLINE_MASKED_USER_NAME,
  bloodlineCardTypeLabel,
  bloodlineEventSentence,
  formatBloodlineEventDate,
  formatReceivedCount,
  isHiddenBloodlineEvent,
  searchBloodlineCards,
  type BloodlineCardEventItem,
  type BloodlineCardItem,
} from "@libs/shared/bloodline-card";

const MASKED = { id: 0, name: "닉네임 비공개", masked: true };

// 뿌리 10(만든 사람 1, 지금 보유 2). 출처 카드: 11 → 5(비공개), 12 → 6(공개), 13 → 8(공개였지만 회수됨)
const LINEAGE = [
  { id: 10, cardType: "BLOODLINE", status: "ACTIVE", creatorId: 1, currentOwnerId: 2, ownerNameVisible: false },
  { id: 11, cardType: "LINE", status: "ACTIVE", creatorId: 2, currentOwnerId: 5, ownerNameVisible: false },
  { id: 12, cardType: "LINE", status: "ACTIVE", creatorId: 2, currentOwnerId: 6, ownerNameVisible: true },
  { id: 13, cardType: "LINE", status: "REVOKED", creatorId: 2, currentOwnerId: 8, ownerNameVisible: true },
];

beforeEach(() => {
  jest.clearAllMocks();
  mockClient.bloodlineCard.findMany.mockResolvedValue(LINEAGE);
  mockClient.bloodlineCardEvent.findMany.mockResolvedValue([]);
});

describe("마스킹 규칙(순수 함수)", () => {
  it("규칙 1~4 에 드는 사람만 공개 집합에 넣는다", () => {
    const visible = buildVisibleUserIds({
      viewerId: 9,
      root: { creatorId: 1, currentOwnerId: 2 },
      viewerSentToUserIds: [5, null],
      visibleLineOwnerIds: [6],
    });
    expect(Array.from(visible).sort()).toEqual([1, 2, 5, 6, 9]);

    const anonymous = buildVisibleUserIds({ root: { creatorId: 1, currentOwnerId: 2 } });
    expect(Array.from(anonymous).sort()).toEqual([1, 2]);
  });

  it("공개 집합 밖 사용자는 id 0 + 닉네임 비공개 + masked 로 바꾼다", () => {
    const visible = new Set([1, 2]);
    expect(presentBloodlineUser({ id: 1, name: "강산" }, visible)).toEqual({ id: 1, name: "강산" });
    expect(presentBloodlineUser({ id: 5, name: "도윤파파" }, visible)).toEqual(MASKED);
    expect(presentBloodlineUser(null, visible)).toBeNull();
    expect(maskedBloodlineUser()).toEqual(MASKED);
    expect(BLOODLINE_MASKED_USER_NAME).toBe("닉네임 비공개");
  });

  it("출처 카드는 뿌리 id, 혈통은 자기 id 가 뿌리다", () => {
    expect(rootIdOf({ id: 11, cardType: "LINE", bloodlineReferenceId: 10 })).toBe(10);
    expect(rootIdOf({ id: 10, cardType: "BLOODLINE", bloodlineReferenceId: null })).toBe(10);
    expect(rootIdOf({ id: 14, cardType: "LINE", bloodlineReferenceId: null })).toBe(14);
  });
});

describe("loadBloodlineVisibility", () => {
  it("비로그인에게는 받은 사람을 가린다", async () => {
    const visibility = await loadBloodlineVisibility(10, null);
    expect(mockClient.bloodlineCard.findMany).toHaveBeenCalledWith({
      where: { OR: [{ id: 10 }, { bloodlineReferenceId: 10 }] },
      select: {
        id: true,
        cardType: true,
        status: true,
        creatorId: true,
        currentOwnerId: true,
        ownerNameVisible: true,
      },
    });
    expect(mockClient.bloodlineCardEvent.findMany).not.toHaveBeenCalled();
    expect(visibility.present({ id: 1, name: "강산" })).toEqual({ id: 1, name: "강산" });
    expect(visibility.present({ id: 2, name: "보유자" })).toEqual({ id: 2, name: "보유자" });
    expect(visibility.present({ id: 5, name: "도윤파파" })).toEqual(MASKED);
    expect(visibility.isVisible(5)).toBe(false);
  });

  it("직접 보낸 사람에게는 상대를 보여 준다", async () => {
    mockClient.bloodlineCardEvent.findMany.mockResolvedValue([
      { toUserId: 5, actorUserId: 2, fromUserId: 2 },
    ]);
    const visibility = await loadBloodlineVisibility(10, 2);
    expect(mockClient.bloodlineCardEvent.findMany).toHaveBeenCalledWith({
      where: {
        cardId: { in: [10, 11, 12, 13] },
        toUserId: { not: null },
        OR: [{ actorUserId: 2 }, { fromUserId: 2 }, { toUserId: 2 }],
      },
      select: { toUserId: true, actorUserId: true, fromUserId: true },
    });
    expect(visibility.present({ id: 5, name: "도윤파파" })).toEqual({ id: 5, name: "도윤파파" });
    // 그 사람이 다시 보낸 2단계 수령자는 가린다
    expect(visibility.present({ id: 7, name: "다음분" })).toEqual(MASKED);
  });

  it("받은 사람에게는 자기에게 보낸 사람을 보여 준다(다음 분에게서 넘겨받은 출처 카드)", async () => {
    // 5(도윤파파)가 출처 카드 11 을 7 에게 넘겼다. 7 이 보면 5 가 보이고, 같은 혈통의 다른 받은 사람은 가린다.
    mockClient.bloodlineCardEvent.findMany.mockResolvedValue([
      { toUserId: 7, actorUserId: 5, fromUserId: 5 },
    ]);
    const visibility = await loadBloodlineVisibility(10, 7);
    expect(visibility.present({ id: 5, name: "도윤파파" })).toEqual({ id: 5, name: "도윤파파" });
    expect(visibility.present({ id: 9, name: "다른분" })).toEqual(MASKED);
    // 누구에게나 보이는 사람(규칙 1·4)과 이 뷰어에게만 보이는 사람을 나눈다
    expect(visibility.isPublic(5)).toBe(false);
    expect(visibility.isPublic(6)).toBe(true);
    expect(visibility.isPublic(1)).toBe(true);
  });

  it("공개를 켠 보유자는 모두에게 보인다(회수된 출처 카드는 빼고)", async () => {
    const visibility = await loadBloodlineVisibility(10);
    expect(visibility.present({ id: 6, name: "공개한분" })).toEqual({ id: 6, name: "공개한분" });
    expect(visibility.present({ id: 8, name: "회수된분" })).toEqual(MASKED);
  });

  it("뷰어 본인은 늘 보인다", async () => {
    const visibility = await loadBloodlineVisibility(10, 5);
    expect(visibility.present({ id: 5, name: "도윤파파" })).toEqual({ id: 5, name: "도윤파파" });
    expect(visibility.viewerId).toBe(5);
  });

  it("뿌리가 없으면 뷰어 본인만 보인다", async () => {
    mockClient.bloodlineCard.findMany.mockResolvedValue([]);
    const visibility = await loadBloodlineVisibility(99, 5);
    expect(visibility.isVisible(5)).toBe(true);
    expect(visibility.isVisible(1)).toBe(false);
  });
});

const baseRow = {
  id: 11,
  name: "강산 라인",
  description: null,
  image: "img-1",
  cardType: "LINE" as const,
  speciesType: "사슴벌레",
  bloodlineReferenceId: 10,
  parentCardId: 10,
  status: "ACTIVE" as const,
  transferPolicy: "NONE" as const,
  issueCount: 0,
  transferCount: 1,
  visualStyle: "clean",
  originSido: "충청남도",
  originSigungu: "공주시",
  ownerNameVisible: false,
  creatorId: 2,
  currentOwnerId: 5,
  createdAt: new Date("2026-09-12T03:00:00.000Z"),
  updatedAt: new Date("2026-09-13T03:00:00.000Z"),
  creator: { id: 2, name: "강산" },
  currentOwner: { id: 5, name: "도윤파파" },
  transfers: [
    {
      id: 1,
      fromUser: { id: 2, name: "강산" },
      toUser: { id: 5, name: "도윤파파" },
      note: "잘 키워 주세요",
      createdAt: new Date("2026-09-12T04:00:00.000Z"),
    },
  ],
};

describe("toBloodlineCardItem", () => {
  it("응답 항목으로 바꾸고 마스킹·산지 표시를 붙인다", async () => {
    const visibility = createBloodlineVisibility({
      rootId: 10,
      viewerId: null,
      root: { creatorId: 1, currentOwnerId: 2 },
    });
    const item = toBloodlineCardItem(baseRow, { viewerId: null, visibility, receivedCount: 3, listingCount: 2 });
    expect(item).toMatchObject({
      id: 11,
      name: "강산 라인",
      cardType: "LINE",
      creator: { id: 2, name: "강산" },
      currentOwner: MASKED,
      isOwnedByMe: false,
      createdAt: "2026-09-12T03:00:00.000Z",
      updatedAt: "2026-09-13T03:00:00.000Z",
      visualStyle: "noir",
      originSido: "충청남도",
      originSigungu: "공주시",
      originLabel: "충남 공주",
      receivedCount: 3,
      listingCount: 2,
    });
    expect(item.transfers).toEqual([
      {
        id: 1,
        fromUser: { id: 2, name: "강산" },
        toUser: MASKED,
        // 보유자끼리 주고받은 메모는 당사자에게만(비로그인은 null)
        note: null,
        createdAt: "2026-09-12T04:00:00.000Z",
      },
    ]);
    // ownerNameVisible 은 출처 카드 보유자 본인에게만
    expect(item.ownerNameVisible).toBeUndefined();
  });

  it("출처 카드 메모(description·transfers[].note)는 보낸 사람·받은 사람에게만 준다", () => {
    const row = { ...baseRow, description: "도윤님 26 봄 세트 3령 암컷" };
    // 비로그인·제3자: 둘 다 null
    for (const viewerId of [null, undefined, 9]) {
      const item = toBloodlineCardItem(row, { viewerId });
      expect(item.description).toBeNull();
      expect(item.transfers[0].note).toBeNull();
    }
    // 지금 보유자(받은 분)와 보낸 사람(creator)은 그대로 본다
    for (const viewerId of [5, 2]) {
      const item = toBloodlineCardItem(row, { viewerId });
      expect(item.description).toBe("도윤님 26 봄 세트 3령 암컷");
      expect(item.transfers[0].note).toBe("잘 키워 주세요");
    }
    // 혈통(BLOODLINE)의 description 은 공개 소개라 누구에게나 준다. transfers 메모는 당사자에게만
    const root = toBloodlineCardItem({ ...row, cardType: "BLOODLINE" }, { viewerId: null });
    expect(root.description).toBe("도윤님 26 봄 세트 3령 암컷");
    expect(root.transfers[0].note).toBeNull();
  });

  it("출처 카드 보유자 본인에게는 ownerNameVisible·isOwnedByMe 를 준다", () => {
    const item = toBloodlineCardItem({ ...baseRow, ownerNameVisible: true }, { viewerId: 5 });
    expect(item.isOwnedByMe).toBe(true);
    expect(item.ownerNameVisible).toBe(true);
    expect(item.currentOwner).toEqual({ id: 5, name: "도윤파파" });
  });

  it("탈퇴 등으로 사용자가 없으면 id 0 탈퇴한 사용자, 산지·transfers 가 없어도 된다", () => {
    const item = toBloodlineCardItem(
      {
        ...baseRow,
        cardType: "BLOODLINE",
        creator: null,
        currentOwner: null,
        originSido: null,
        originSigungu: null,
        transfers: undefined,
      },
      { isOwnedByMe: true }
    );
    expect(item.creator).toEqual({ id: 0, name: "탈퇴한 사용자" });
    expect(item.currentOwner).toEqual({ id: 0, name: "탈퇴한 사용자" });
    expect(item.originLabel).toBeNull();
    expect(item.transfers).toEqual([]);
    expect(item.isOwnedByMe).toBe(true);
    expect(item).not.toHaveProperty("receivedCount");
  });
});

describe("이력 메모 공개 범위(canSeeBloodlineEventNote)", () => {
  const issued = { action: "LINE_ISSUED", actorUserId: 1, fromUserId: 1, toUserId: 5 };

  it("보내기·넘기기 메모는 그 사건의 당사자에게만", () => {
    for (const action of ["LINE_ISSUED", "LINE_TRANSFER", "BLOODLINE_TRANSFER"]) {
      const event = { ...issued, action };
      expect(canSeeBloodlineEventNote(null, event)).toBe(false);
      expect(canSeeBloodlineEventNote(undefined, event)).toBe(false);
      expect(canSeeBloodlineEventNote(9, event)).toBe(false);
      expect(canSeeBloodlineEventNote(1, event)).toBe(true);
      expect(canSeeBloodlineEventNote(5, event)).toBe(true);
    }
  });

  it("시스템 문구(만들기·회수)는 누구에게나", () => {
    for (const action of ["BLOODLINE_CREATED", "LINE_CREATED", "CARD_REVOKED"]) {
      expect(canSeeBloodlineEventNote(null, { action, actorUserId: null, fromUserId: 1, toUserId: null })).toBe(true);
    }
  });
});

describe("받은 사람 수·분양글 수", () => {
  it("receivedCount 는 만든 사람·발급자 보유분을 빼고 서로 다른 현재 보유자 수다", () => {
    expect(
      countReceivedOwners(
        [
          { currentOwnerId: 5, creatorId: 1 },
          { currentOwnerId: 5, creatorId: 1 },
          { currentOwnerId: 6, creatorId: 1 },
          { currentOwnerId: 1, creatorId: 1 }, // 레거시 본인 발급
          { currentOwnerId: 3, creatorId: 3 }, // 넘겨받은 사람이 자기에게 발급
        ],
        1
      )
    ).toBe(2);
  });

  it("뿌리별로 한 번에 센다", async () => {
    mockClient.bloodlineCard.findMany.mockResolvedValue([
      { bloodlineReferenceId: 10, creatorId: 1, currentOwnerId: 5 },
      { bloodlineReferenceId: 10, creatorId: 1, currentOwnerId: 1 },
      { bloodlineReferenceId: 20, creatorId: 4, currentOwnerId: 6 },
    ]);
    const counts = await fetchReceivedCounts([
      { id: 10, creatorId: 1 },
      { id: 20, creatorId: 4 },
      { id: 30, creatorId: 4 },
    ]);
    expect(mockClient.bloodlineCard.findMany).toHaveBeenCalledWith({
      where: { cardType: "LINE", status: "ACTIVE", bloodlineReferenceId: { in: [10, 20, 30] } },
      select: { bloodlineReferenceId: true, creatorId: true, currentOwnerId: true },
    });
    expect(counts.get(10)).toBe(1);
    expect(counts.get(20)).toBe(1);
    expect(counts.get(30)).toBe(0);
    await expect(fetchReceivedCounts([])).resolves.toEqual(new Map());

    mockClient.product.groupBy.mockResolvedValue([{ bloodlineRootId: 10, _count: { _all: 2 } }]);
    const listings = await fetchListingCounts([10, 20]);
    expect(mockClient.product.groupBy).toHaveBeenCalledWith({
      by: ["bloodlineRootId"],
      where: { bloodlineRootId: { in: [10, 20] }, isDeleted: false, isHidden: false },
      _count: { _all: true },
    });
    expect(listings.get(10)).toBe(2);
    expect(listings.get(20)).toBe(0);
  });
});

describe("화면 공용 라벨(libs/shared/bloodline-card)", () => {
  const event = (overrides: Partial<BloodlineCardEventItem>): BloodlineCardEventItem => ({
    id: 1,
    action: "LINE_ISSUED",
    actorUser: { id: 1, name: "강산" },
    fromUser: null,
    toUser: { id: 5, name: "도윤파파" },
    relatedCard: null,
    note: null,
    createdAt: "2026-09-12T03:00:00.000Z",
    ...overrides,
  });

  it("카드 종류 라벨은 혈통 / 출처 카드", () => {
    expect(bloodlineCardTypeLabel("BLOODLINE")).toBe("혈통");
    expect(bloodlineCardTypeLabel("LINE")).toBe("출처 카드");
  });

  it("이력 문장은 새 용어로, 가린 사람은 '닉네임 비공개 분'", () => {
    expect(bloodlineEventSentence(event({ action: "BLOODLINE_CREATED", toUser: null }))).toBe("강산님이 만들었어요");
    expect(bloodlineEventSentence(event({ action: "LINE_ISSUED" }))).toBe("도윤파파님에게 보냈어요");
    expect(bloodlineEventSentence(event({ action: "LINE_ISSUED", toUser: MASKED }))).toBe(
      "닉네임 비공개 분에게 보냈어요"
    );
    expect(
      bloodlineEventSentence(
        event({ action: "LINE_TRANSFER", actorUser: { id: 5, name: "도윤파파" }, fromUser: { id: 5, name: "도윤파파" } })
      )
    ).toBe("도윤파파님이 다음 분에게 보냈어요");
    expect(bloodlineEventSentence(event({ action: "BLOODLINE_TRANSFER" }))).toBe("도윤파파님에게 혈통을 넘겼어요");
    expect(bloodlineEventSentence(event({ action: "CARD_REVOKED" }))).toBe("운영 정책으로 회수됐어요");
    expect(isHiddenBloodlineEvent("LINE_CREATED")).toBe(true);
    expect(isHiddenBloodlineEvent("LINE_ISSUED")).toBe(false);
  });

  it("날짜는 연도까지 YYYY.MM.DD, 받은 사람 수 문구", () => {
    const localNoon = new Date(2026, 8, 12, 12, 0, 0).toISOString();
    expect(formatBloodlineEventDate(localNoon)).toBe("2026.09.12");
    expect(formatBloodlineEventDate("not-a-date")).toBe("not-a-date");
    expect(formatReceivedCount(3)).toBe("받은 사람 3명");
    expect(formatReceivedCount(0)).toBe("아직 받은 사람 없음");
    expect(formatReceivedCount(undefined)).toBeNull();
  });

  it("검색은 가린 이름으로 맞추지 않는다", () => {
    const card = {
      id: 11,
      name: "강산 라인",
      description: null,
      creator: { id: 2, name: "강산" },
      currentOwner: MASKED,
    } as unknown as BloodlineCardItem;
    expect(searchBloodlineCards([card], "비공개")).toEqual([]);
    expect(searchBloodlineCards([card], "강산")).toEqual([card]);
  });
});
