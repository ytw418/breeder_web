import {
  createNicknameChecker,
  NAME_CHECK_DEBOUNCE_MS,
  NAME_CHECK_TIMEOUT_MS,
  shouldCheckNickname,
  type CheckNameResult,
  type NameCheck,
} from "@components/features/profile/nicknameCheck";
import { formatNotificationTime, getNotificationHref, getNotificationIcon } from "@/app/(web)/notifications/notificationFormat";
import {
  applyBlockedResult,
  blockerHref,
  canRequestDeletion,
  getDeletionView,
  type DeletionEligibilityResponse,
} from "@/app/(web)/settings/delete-account/deletionView";
import { getRankingOwnerId } from "@libs/shared/ranking";
import { withoutBlocked } from "@libs/shared/blockFilter";

describe("닉네임 사전 확인", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  const setup = (request: jest.Mock) => {
    const statuses: Array<[NameCheck, string | undefined]> = [];
    const checker = createNicknameChecker({
      request,
      onStatus: (status, reason) => statuses.push([status, reason]),
    });
    return { checker, statuses };
  };

  it("비었거나 10자를 넘거나 현재 닉네임과 같으면 묻지 않는다", () => {
    expect(shouldCheckNickname("   ", "브리더")).toBe(false);
    expect(shouldCheckNickname("가".repeat(11), "브리더")).toBe(false);
    expect(shouldCheckNickname(" 브리더 ", "브리더")).toBe(false);
    expect(shouldCheckNickname("새이름", "브리더")).toBe(true);
  });

  it("입력이 멈추고 400ms 뒤 마지막 입력만 한 번 묻는다", async () => {
    const request = jest.fn().mockResolvedValue({ success: true, available: true } as CheckNameResult);
    const { checker, statuses } = setup(request);
    checker.schedule("새", "브리더");
    checker.schedule("새이", "브리더");
    checker.schedule("새이름", "브리더");
    expect(statuses.at(-1)?.[0]).toBe("checking");
    jest.advanceTimersByTime(NAME_CHECK_DEBOUNCE_MS - 1);
    expect(request).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);
    expect(request).toHaveBeenCalledTimes(1);
    expect(request.mock.calls[0][0]).toBe("새이름");
    await Promise.resolve();
    await Promise.resolve();
    expect(statuses.at(-1)).toEqual(["available", undefined]);
  });

  it("사용할 수 없으면 서버 사유를 그대로 돌려준다", async () => {
    const request = jest.fn().mockResolvedValue({ success: true, available: false, reason: "중복된 닉네임입니다." });
    const { checker, statuses } = setup(request);
    checker.schedule("중복", "브리더");
    jest.advanceTimersByTime(NAME_CHECK_DEBOUNCE_MS);
    await Promise.resolve();
    await Promise.resolve();
    expect(statuses.at(-1)).toEqual(["unavailable", "중복된 닉네임입니다."]);
  });

  it("5초 안에 답이 없으면 요청을 끊고 idle 로 돌려 저장을 막지 않는다", () => {
    let signal: AbortSignal | undefined;
    const request = jest.fn((_name: string, s: AbortSignal) => {
      signal = s;
      return new Promise<CheckNameResult>(() => undefined);
    });
    const { checker, statuses } = setup(request as unknown as jest.Mock);
    checker.schedule("느림", "브리더");
    jest.advanceTimersByTime(NAME_CHECK_DEBOUNCE_MS + NAME_CHECK_TIMEOUT_MS);
    expect(signal?.aborted).toBe(true);
    expect(statuses.at(-1)?.[0]).toBe("idle");
  });

  it("늦게 온 이전 입력의 응답은 버린다", async () => {
    let resolveFirst: (value: CheckNameResult) => void = () => undefined;
    const request = jest
      .fn()
      .mockImplementationOnce(() => new Promise<CheckNameResult>((resolve) => (resolveFirst = resolve)))
      .mockResolvedValueOnce({ success: true, available: true });
    const { checker, statuses } = setup(request);
    checker.schedule("첫째", "브리더");
    jest.advanceTimersByTime(NAME_CHECK_DEBOUNCE_MS);
    checker.schedule("둘째", "브리더");
    resolveFirst({ success: true, available: false, reason: "중복" });
    await Promise.resolve();
    await Promise.resolve();
    expect(statuses.some(([status]) => status === "unavailable")).toBe(false);
  });

  it("확인 실패(네트워크·500)는 idle 로 둔다", async () => {
    const request = jest.fn().mockRejectedValue(new Error("network"));
    const { checker, statuses } = setup(request);
    checker.schedule("실패", "브리더");
    jest.advanceTimersByTime(NAME_CHECK_DEBOUNCE_MS);
    await Promise.resolve();
    await Promise.resolve();
    expect(statuses.at(-1)?.[0]).toBe("idle");
  });
});

describe("알림 시간 표기", () => {
  const now = new Date(2026, 9, 6, 15, 0, 0).getTime();
  const at = (y: number, m: number, d: number, h = 0, min = 0) => new Date(y, m - 1, d, h, min).toISOString();

  it("방금 / N분 전 / N시간 전 / 어제 / 날짜", () => {
    expect(formatNotificationTime(new Date(now - 30_000).toISOString(), now)).toBe("방금");
    expect(formatNotificationTime(new Date(now - 5 * 60_000).toISOString(), now)).toBe("5분 전");
    expect(formatNotificationTime(new Date(now - 3 * 3_600_000).toISOString(), now)).toBe("3시간 전");
    expect(formatNotificationTime(at(2026, 10, 5, 9), now)).toBe("어제");
    expect(formatNotificationTime(at(2026, 9, 1, 9), now)).toBe(new Date(at(2026, 9, 1, 9)).toLocaleDateString("ko-KR"));
    expect(formatNotificationTime("잘못된 값", now)).toBe("");
  });

  it("타입별 아이콘: 경매 망치, 채팅·댓글 말풍선, 나머지 종", () => {
    expect(getNotificationIcon("OUTBID")).toBe("hammer");
    expect(getNotificationIcon("CHAT")).toBe("bubble");
    expect(getNotificationIcon("COMMENT")).toBe("bubble");
    expect(getNotificationIcon("FOLLOW")).toBe("bell");
  });

  it("대상이 없으면 링크가 없다", () => {
    expect(getNotificationHref(null, null)).toBeNull();
    expect(getNotificationHref("chatRoom", 3)).toBe("/chat/3");
    expect(getNotificationHref("user", 9)).toBe("/profiles/9");
  });
});

describe("회원탈퇴 화면 상태", () => {
  const eligible: DeletionEligibilityResponse = { success: true, eligible: true, purgeAfterDays: 30, blockers: [] };

  it("응답에 따라 로딩·오류·관리자·막힘·가능을 고른다", () => {
    expect(getDeletionView({ isLoading: true })).toBe("loading");
    expect(getDeletionView({ isLoading: false, error: new Error("x") })).toBe("error");
    expect(
      getDeletionView({
        isLoading: false,
        data: { success: true, eligible: false, errorCode: "ADMIN_ACCOUNT_CANNOT_SELF_DELETE", blockers: [] },
      })
    ).toBe("admin");
    expect(
      getDeletionView({
        isLoading: false,
        data: {
          success: true,
          eligible: false,
          blockers: [{ code: "AUCTION_TOP_BIDDER", message: "최고 입찰 중인 경매가 있어요.", items: [{ id: 1, title: "경매" }] }],
        },
      })
    ).toBe("blocked");
    expect(getDeletionView({ isLoading: false, data: eligible })).toBe("eligible");
  });

  it("가능할 때만, 요청 중이 아닐 때만 탈퇴하기를 누를 수 있다", () => {
    expect(canRequestDeletion("eligible", eligible, false)).toBe(true);
    expect(canRequestDeletion("eligible", eligible, true)).toBe(false);
    expect(canRequestDeletion("admin", { ...eligible, eligible: false }, false)).toBe(false);
    expect(canRequestDeletion("blocked", { ...eligible, eligible: false }, false)).toBe(false);
  });

  it("예약중 상품은 상품 상세, 나머지는 경매 상세로 보낸다", () => {
    expect(blockerHref({ code: "PRODUCT_RESERVED" }, { id: 5, title: "왕사슴" })).toMatch(/^\/products\/5/);
    expect(blockerHref({ code: "AUCTION_SELLING_ACTIVE" }, { id: 7, title: "경매" })).toMatch(/^\/auctions\/7/);
  });

  it("POST 409 막힘 응답이면 막힘 상태로 바꾸고, 다른 오류는 그대로 둔다", () => {
    const blockers = [{ code: "PRODUCT_RESERVED" as const, message: "예약중인 분양글이 있어요.", items: [] }];
    const next = applyBlockedResult(eligible, { success: false, errorCode: "ACCOUNT_DELETION_BLOCKED", blockers });
    expect(next).toEqual({ success: true, purgeAfterDays: 30, eligible: false, blockers });
    expect(applyBlockedResult(eligible, { success: false, errorCode: "ACCOUNT_ALREADY_DELETED" })).toBe(eligible);
  });
});

describe("랭킹 차단 숨김", () => {
  it("탭별 작성자로 차단한 사용자 항목을 거른다", () => {
    const breeders = [
      { rank: 1, user: { id: 1, name: "a" } },
      { rank: 2, user: { id: 2, name: "b" } },
    ];
    const blocked = new Set([2]);
    const result = withoutBlocked(breeders, blocked, (item) =>
      getRankingOwnerId("breeders", item as unknown as Parameters<typeof getRankingOwnerId>[1])
    );
    expect(result.map((item) => item.user.id)).toEqual([1]);
    expect(getRankingOwnerId("auctions", { seller: { id: 3 } } as never)).toBe(3);
    expect(getRankingOwnerId("bloodlines", { creator: { id: 4 } } as never)).toBe(4);
    expect(getRankingOwnerId("community", { post: { user: { id: 5 } } } as never)).toBe(5);
  });
});
