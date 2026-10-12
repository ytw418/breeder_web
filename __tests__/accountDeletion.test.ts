const mockClient = {
  auction: { findMany: jest.fn(), updateMany: jest.fn() },
  product: { findMany: jest.fn(), updateMany: jest.fn() },
  user: { findUnique: jest.fn(), update: jest.fn() },
  userDeletionRecord: {
    create: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
  },
  fcmToken: { deleteMany: jest.fn() },
  fav: { deleteMany: jest.fn() },
  follow: { deleteMany: jest.fn() },
  alertSubscription: { deleteMany: jest.fn() },
  bloodlineFollow: { deleteMany: jest.fn() },
  profileAlbum: { deleteMany: jest.fn() },
  notification: { deleteMany: jest.fn() },
  voiceInquiry: { updateMany: jest.fn() },
  guinnessSubmission: { updateMany: jest.fn() },
  $transaction: jest.fn(),
};

jest.mock("@libs/server/client", () => ({
  __esModule: true,
  default: mockClient,
}));

const mockSettle = jest.fn();
jest.mock("@libs/server/auctionSettlement", () => ({
  settleExpiredAuctions: (...args: unknown[]) => mockSettle(...args),
}));

import {
  ACCOUNT_DELETION_RETENTION_DAYS,
  buildDeletedUserName,
  deleteAccount,
  findDeletionBlockers,
  findPendingDeletion,
  hashSnsId,
  isDeletedUserName,
  purgeDeletedAccounts,
} from "@libs/server/accountDeletion";

const NOW = new Date("2026-10-01T00:00:00.000Z");
const DAY = 24 * 60 * 60 * 1000;
const USER_ID = 7;

type Where = Record<string, any>;

/** auction.findMany 는 판정 쿼리마다 where 가 달라 조건으로 응답을 고른다. */
function mockAuctions(rows: {
  selling?: unknown[];
  bidding?: unknown[];
  soldRecently?: unknown[];
  wonRecently?: unknown[];
}) {
  mockClient.auction.findMany.mockImplementation(({ where }: { where: Where }) => {
    if (where.status === "진행중" && where.userId === USER_ID) {
      return Promise.resolve(rows.selling ?? []);
    }
    if (where.status === "진행중" && where.bids) {
      return Promise.resolve(rows.bidding ?? []);
    }
    if (where.status === "종료" && where.userId === USER_ID) {
      return Promise.resolve(rows.soldRecently ?? []);
    }
    if (where.status === "종료" && where.winnerId === USER_ID) {
      return Promise.resolve(rows.wonRecently ?? []);
    }
    return Promise.resolve([]);
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockAuctions({});
  mockClient.product.findMany.mockResolvedValue([]);
  mockClient.$transaction.mockImplementation((fn: (tx: unknown) => unknown) =>
    fn(mockClient)
  );
  mockSettle.mockResolvedValue(0);
});

describe("탈퇴 표시 이름", () => {
  it("탈퇴 유저 이름은 unique 를 지키도록 id 접미사를 붙인다", () => {
    expect(buildDeletedUserName(12)).toBe("탈퇴한 사용자#12");
    expect(isDeletedUserName("탈퇴한 사용자#12")).toBe(true);
    expect(isDeletedUserName("브리더")).toBe(false);
    expect(isDeletedUserName(null)).toBe(false);
  });

  it("snsId 해시는 결정적이며 원문을 포함하지 않는다", () => {
    expect(hashSnsId("kakao-123")).toBe(hashSnsId("kakao-123"));
    expect(hashSnsId("kakao-123")).not.toBe(hashSnsId("kakao-124"));
    expect(hashSnsId("kakao-123")).not.toContain("kakao-123");
  });
});

describe("findDeletionBlockers", () => {
  it("만료된 경매를 먼저 정산한 뒤 판정한다", async () => {
    await findDeletionBlockers(USER_ID, NOW);
    expect(mockSettle).toHaveBeenCalled();
  });

  it("진행 중인 판매 경매가 있으면 AUCTION_SELLING_ACTIVE", async () => {
    mockAuctions({ selling: [{ id: 1, title: "왕사슴", endAt: NOW }] });
    const blockers = await findDeletionBlockers(USER_ID, NOW);
    expect(blockers.map((b) => b.code)).toEqual(["AUCTION_SELLING_ACTIVE"]);
    expect(blockers[0].items).toEqual([
      { id: 1, title: "왕사슴", endAt: NOW.toISOString() },
    ]);
  });

  it("진행 중 경매의 최고 입찰자면 AUCTION_TOP_BIDDER, 아니면 차단하지 않는다", async () => {
    mockAuctions({
      bidding: [
        { id: 2, title: "내가 최고", endAt: NOW, bids: [{ userId: USER_ID }] },
        { id: 3, title: "남이 최고", endAt: NOW, bids: [{ userId: 99 }] },
      ],
    });
    const blockers = await findDeletionBlockers(USER_ID, NOW);
    expect(blockers).toHaveLength(1);
    expect(blockers[0].code).toBe("AUCTION_TOP_BIDDER");
    expect(blockers[0].items.map((item) => item.id)).toEqual([2]);
  });

  it("최근 7일 내 낙찰된 경매는 판매자·낙찰자 모두 차단한다", async () => {
    mockAuctions({
      soldRecently: [{ id: 4, title: "판매", endAt: new Date(NOW.getTime() - 3 * DAY) }],
      wonRecently: [{ id: 5, title: "낙찰", endAt: new Date(NOW.getTime() - 3 * DAY) }],
    });
    const blockers = await findDeletionBlockers(USER_ID, NOW);
    expect(blockers.map((b) => b.code)).toEqual([
      "AUCTION_SETTLING_SELLER",
      "AUCTION_SETTLING_WINNER",
    ]);

    const sellerQuery = mockClient.auction.findMany.mock.calls
      .map(([args]) => args.where)
      .find((where: Where) => where.status === "종료" && where.userId === USER_ID);
    expect(sellerQuery.endAt.gte).toEqual(new Date(NOW.getTime() - 7 * DAY));
    expect(sellerQuery.winnerId).toEqual({ not: null });
  });

  it("예약중 상품이 있으면 PRODUCT_RESERVED", async () => {
    mockClient.product.findMany.mockResolvedValue([{ id: 8, name: "애완 장수풍뎅이" }]);
    const blockers = await findDeletionBlockers(USER_ID, NOW);
    expect(blockers.map((b) => b.code)).toEqual(["PRODUCT_RESERVED"]);
    expect(blockers[0].items).toEqual([{ id: 8, title: "애완 장수풍뎅이" }]);
    expect(mockClient.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: USER_ID, status: "예약중", isDeleted: false },
      })
    );
  });

  it("아무것도 없으면 빈 배열", async () => {
    expect(await findDeletionBlockers(USER_ID, NOW)).toEqual([]);
  });
});

describe("deleteAccount", () => {
  const activeUser = {
    id: USER_ID,
    status: "ACTIVE",
    snsId: "kakao-123",
    provider: "kakao",
    email: "me@example.com",
    phone: "01012345678",
    name: "브리더",
  };

  it("차단 사유가 있으면 아무것도 바꾸지 않고 BLOCKED 를 돌려준다", async () => {
    mockClient.user.findUnique.mockResolvedValue(activeUser);
    mockAuctions({ selling: [{ id: 1, title: "왕사슴", endAt: NOW }] });

    const result = await deleteAccount(USER_ID, { now: NOW });

    expect(result).toEqual(
      expect.objectContaining({ ok: false, code: "ACCOUNT_DELETION_BLOCKED" })
    );
    expect(mockClient.user.update).not.toHaveBeenCalled();
    expect(mockClient.userDeletionRecord.create).not.toHaveBeenCalled();
  });

  it("이미 탈퇴한 계정이면 ALREADY_DELETED", async () => {
    mockClient.user.findUnique.mockResolvedValue({
      ...activeUser,
      status: "DELETED",
      snsId: `deleted:${hashSnsId("kakao-123")}`,
      name: "탈퇴한 사용자#7",
      email: null,
      phone: null,
    });
    const result = await deleteAccount(USER_ID, { now: NOW });
    expect(result).toEqual({ ok: false, code: "ACCOUNT_ALREADY_DELETED" });
    expect(mockClient.user.update).not.toHaveBeenCalled();
    expect(mockClient.userDeletionRecord.create).not.toHaveBeenCalled();
  });

  it("상태만 DELETED 로 바뀐 예전 계정(snsId 원문)은 익명화를 마저 진행한다", async () => {
    // 예전 관리자 상태 변경은 status 만 DELETED 로 바꿔 개인정보가 그대로 남아 있다.
    mockClient.user.findUnique.mockResolvedValue({ ...activeUser, status: "DELETED" });

    const result = await deleteAccount(USER_ID, { now: NOW, force: true });

    expect(result.ok).toBe(true);
    expect(mockClient.userDeletionRecord.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ userId: USER_ID, snsId: "kakao-123", email: "me@example.com" }),
    });
    expect(mockClient.user.update).toHaveBeenCalledWith({
      where: { id: USER_ID },
      data: expect.objectContaining({
        status: "DELETED",
        name: "탈퇴한 사용자#7",
        email: null,
        phone: null,
        snsId: `deleted:${hashSnsId("kakao-123")}`,
      }),
    });
  });

  it("성공 시 개인정보를 User 에서 지우고 분리 보관 레코드를 만든다", async () => {
    mockClient.user.findUnique.mockResolvedValue(activeUser);

    const result = await deleteAccount(USER_ID, { now: NOW, reason: "안 써요" });

    const purgeAt = new Date(NOW.getTime() + ACCOUNT_DELETION_RETENTION_DAYS * DAY);
    expect(result).toEqual({ ok: true, deletedAt: NOW, purgeAt });

    expect(mockClient.user.update).toHaveBeenCalledWith({
      where: { id: USER_ID },
      data: {
        status: "DELETED",
        deletedAt: NOW,
        name: "탈퇴한 사용자#7",
        email: null,
        phone: null,
        avatar: null,
        bio: null,
        snsId: `deleted:${hashSnsId("kakao-123")}`,
        // 탈퇴하면 모든 기기의 access/refresh 토큰을 즉시 무효화한다.
        tokenVersion: { increment: 1 },
        suspendedUntil: null,
      },
    });
    expect(mockClient.userDeletionRecord.create).toHaveBeenCalledWith({
      data: {
        userId: USER_ID,
        provider: "kakao",
        snsId: "kakao-123",
        snsIdHash: hashSnsId("kakao-123"),
        email: "me@example.com",
        phone: "01012345678",
        name: "브리더",
        reason: "안 써요",
        requestedAt: NOW,
        purgeAt,
      },
    });
  });

  it("성공 시 개인 설정·수신함을 지우고 판매중 상품을 숨긴다", async () => {
    mockClient.user.findUnique.mockResolvedValue(activeUser);
    await deleteAccount(USER_ID, { now: NOW });

    expect(mockClient.fcmToken.deleteMany).toHaveBeenCalledWith({ where: { userId: USER_ID } });
    expect(mockClient.fav.deleteMany).toHaveBeenCalledWith({ where: { userId: USER_ID } });
    expect(mockClient.follow.deleteMany).toHaveBeenCalledWith({
      where: { OR: [{ followerId: USER_ID }, { followingId: USER_ID }] },
    });
    expect(mockClient.alertSubscription.deleteMany).toHaveBeenCalledWith({ where: { userId: USER_ID } });
    expect(mockClient.bloodlineFollow.deleteMany).toHaveBeenCalledWith({ where: { userId: USER_ID } });
    expect(mockClient.profileAlbum.deleteMany).toHaveBeenCalledWith({ where: { userId: USER_ID } });
    expect(mockClient.notification.deleteMany).toHaveBeenCalledWith({ where: { userId: USER_ID } });
    // 보낸 알림 문구("브리더님이 회원님을 팔로우했습니다.")에 박힌 원래 닉네임도 남기지 않는다.
    expect(mockClient.notification.deleteMany).toHaveBeenCalledWith({
      where: { senderId: USER_ID, message: { contains: "브리더" } },
    });
    expect(mockClient.product.updateMany).toHaveBeenCalledWith({
      where: { userId: USER_ID, status: "판매중", isDeleted: false },
      data: { isHidden: true },
    });
  });

  it("force 면 차단 사유를 무시한다(관리자 처리)", async () => {
    mockClient.user.findUnique.mockResolvedValue(activeUser);
    mockAuctions({ selling: [{ id: 1, title: "왕사슴", endAt: NOW }] });
    const result = await deleteAccount(USER_ID, { now: NOW, force: true });
    expect(result.ok).toBe(true);
  });
});

describe("findPendingDeletion", () => {
  it("파기 전 보관 레코드가 있으면 purgeAt 을 돌려준다", async () => {
    const purgeAt = new Date(NOW.getTime() + 10 * DAY);
    mockClient.userDeletionRecord.findFirst.mockResolvedValue({ purgeAt });
    expect(await findPendingDeletion("kakao-123")).toEqual({ purgeAt });
    expect(mockClient.userDeletionRecord.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { snsId: "kakao-123", purgedAt: null } })
    );
  });

  it("없으면 null", async () => {
    mockClient.userDeletionRecord.findFirst.mockResolvedValue(null);
    expect(await findPendingDeletion("kakao-123")).toBeNull();
  });
});

describe("purgeDeletedAccounts", () => {
  it("보관 기한이 지난 레코드만 조회한다", async () => {
    mockClient.userDeletionRecord.findMany.mockResolvedValue([]);
    await purgeDeletedAccounts(NOW, 50);
    expect(mockClient.userDeletionRecord.findMany).toHaveBeenCalledWith({
      where: { purgedAt: null, purgeAt: { lte: NOW } },
      orderBy: { purgeAt: "asc" },
      take: 50,
    });
  });

  it("경매 판매자 연락처·문의 연락처·보관 원문을 파기한다", async () => {
    mockClient.userDeletionRecord.findMany.mockResolvedValue([
      { id: 1, userId: USER_ID, email: "me@example.com" },
    ]);

    const result = await purgeDeletedAccounts(NOW);

    expect(result).toEqual({ purged: 1, failed: 0 });
    expect(mockClient.auction.updateMany).toHaveBeenCalledWith({
      where: { userId: USER_ID },
      data: {
        sellerPhone: null,
        sellerEmail: null,
        sellerBlogUrl: null,
        sellerCafeNick: null,
        sellerBandNick: null,
        sellerProofImage: null,
        sellerTrustNote: null,
      },
    });
    expect(mockClient.guinnessSubmission.updateMany).toHaveBeenCalledWith({
      where: { userId: USER_ID },
      data: { contactPhone: null, contactEmail: null },
    });
    expect(mockClient.voiceInquiry.updateMany).toHaveBeenCalledWith({
      where: { requesterId: USER_ID },
      data: { contactEmail: "deleted@invalid", requesterName: null },
    });
    expect(mockClient.userDeletionRecord.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: {
        snsId: null,
        email: null,
        phone: null,
        name: null,
        reason: null,
        purgedAt: NOW,
      },
    });
  });

  it("한 건이 실패해도 나머지는 계속 처리한다", async () => {
    mockClient.userDeletionRecord.findMany.mockResolvedValue([
      { id: 1, userId: 1, email: null },
      { id: 2, userId: 2, email: null },
    ]);
    mockClient.$transaction
      .mockImplementationOnce(() => Promise.reject(new Error("db down")))
      .mockImplementationOnce((fn: (tx: unknown) => unknown) => fn(mockClient));

    expect(await purgeDeletedAccounts(NOW)).toEqual({ purged: 1, failed: 1 });
  });
});
