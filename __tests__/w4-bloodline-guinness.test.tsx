import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { SWRConfig } from "swr";
import {
  bloodlineCardMeta,
  bloodlineFilterFromFocus,
  cardsForBloodlineFilter,
  formatBloodlineIssuedAt,
  groupBloodlineCards,
  searchBloodlineCards,
  type BloodlineCardItem,
} from "@libs/shared/bloodline-card";
import { formatRecordValue } from "@libs/shared/guinness-record";
import {
  GUINNESS_DRAFT_KEY_PREFIX,
  LEGACY_GUINNESS_DRAFT_KEY,
  clearGuinnessDrafts,
  clearOtherGuinnessDrafts,
  getGuinnessDraftKey,
  readGuinnessDraft,
  writeGuinnessDraft,
} from "@libs/client/guinnessDraft";
import { loadMergedBloodlineEvents } from "@libs/client/bloodlineCardEvents";
import { BloodlineVisualCard } from "@components/features/bloodline/BloodlineVisualCard";
import {
  BLOODLINE_EVENT_LABELS,
  BLOODLINE_TRUST_NOTICE,
  BloodlineHeader,
  bloodlineErrorText,
  bloodlineEventSearchText,
  bloodlineProfileHref,
  bloodlineRowMeta,
  bloodlineUserLabel,
  readBloodlineSendParams,
  resolveBloodlineSendPreset,
  withJosa,
} from "@components/features/bloodline/BloodlineScreenParts";
import { ProfileBloodlineRows } from "@components/features/profile/ProfileActivityLists";
import { getNotificationIcon } from "@/app/(web)/notifications/notificationFormat";
import BloodlineCardDetailClient from "@/app/(web)/bloodline-management/card/[cardId]/BloodlineCardDetailClient";
import BloodlineCardCreateClient from "@/app/(web)/bloodline-cards/create/BloodlineCardCreateClient";
import BloodlineManagementClient from "@/app/(web)/bloodline-management/BloodlineManagementClient";
import { authFetch } from "@libs/client/authFetch";
import { shareOrCopy } from "@libs/client/share";
import type { BloodlineCardEventItem } from "@libs/shared/bloodline-card";

jest.mock("@libs/client/authFetch", () => ({ authFetch: jest.fn() }));

/* ── 혈통 화면 렌더용 모의(WB-3) ─────────────────────────────────────── */
const mockUseUser = jest.fn();
const mockReplace = jest.fn();
const mockPush = jest.fn();
let mockSearchParams = new URLSearchParams();
// jest 설정에 hooks/ 별칭이 없어 가상 모듈로 막는다(확인창은 실제 구현을 그대로 쓴다).
jest.mock("hooks/useUser", () => ({ __esModule: true, default: () => mockUseUser() }), {
  virtual: true,
});
jest.mock("hooks/useConfirmDialog", () => jest.requireActual("../hooks/useConfirmDialog"), {
  virtual: true,
});
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace, back: jest.fn() }),
  usePathname: () => "/bloodline-management/card/5",
  useSearchParams: () => mockSearchParams,
}));
jest.mock("@components/features/MainLayout", () => ({
  __esModule: true,
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  toLoginHref: (next: string) => `/auth/login?next=${encodeURIComponent(next)}`,
}));
jest.mock("@libs/client/share", () => ({ shareOrCopy: jest.fn(async () => "copied") }));

const card = (over: Partial<BloodlineCardItem>): BloodlineCardItem => ({
  id: 1,
  name: "헤라클레스",
  description: "오닉스 라인",
  image: null,
  cardType: "BLOODLINE",
  speciesType: "장수풍뎅이",
  bloodlineReferenceId: null,
  parentCardId: null,
  status: "ACTIVE",
  transferPolicy: "NONE",
  issueCount: 0,
  transferCount: 0,
  creator: { id: 7, name: "김하늘" },
  currentOwner: { id: 7, name: "김하늘" },
  createdAt: "2026-03-14T03:00:00.000Z",
  updatedAt: "2026-03-14T03:00:00.000Z",
  transfers: [],
  ...over,
});

describe("혈통관리 순수 함수", () => {
  it("?focus= 딥링크(예전 섹션 값 포함)를 칩으로 바꾼다", () => {
    expect(bloodlineFilterFromFocus("myBloodlines")).toBe("bloodline");
    expect(bloodlineFilterFromFocus("createdLines")).toBe("line");
    expect(bloodlineFilterFromFocus("receivedCards")).toBe("received");
    expect(bloodlineFilterFromFocus("line")).toBe("line");
    expect(bloodlineFilterFromFocus("toString")).toBeNull();
    expect(bloodlineFilterFromFocus(null)).toBeNull();
  });

  const mine = card({ id: 1 });
  const line = card({ id: 2, cardType: "LINE" });
  const received = card({ id: 3, creator: { id: 9, name: "박도윤" }, currentOwner: { id: 7, name: "김하늘" } });

  it("새 필드가 있으면 그대로, 없으면 ownedCards 로 내 혈통/출처 카드/받은 카드를 나눈다", () => {
    const direct = groupBloodlineCards({ myBloodlines: [mine], createdLines: [line], receivedBloodlines: [received] }, 7);
    expect(direct.myBloodlines).toEqual([mine]);
    expect(direct.receivedCards).toEqual([received]);

    const compat = groupBloodlineCards({ ownedCards: [mine, line, received] }, 7);
    expect(compat.myBloodlines.map((c) => c.id)).toEqual([1]);
    expect(compat.createdLines.map((c) => c.id)).toEqual([2]);
    expect(compat.receivedCards.map((c) => c.id)).toEqual([3]);
    expect(groupBloodlineCards(null).myBloodlines).toEqual([]);
  });

  it("칩: 출처 카드 칩은 LINE 카드만, 전체는 id 중복 제거", () => {
    const groups = groupBloodlineCards({ myBloodlines: [mine, line], createdLines: [line], receivedBloodlines: [received] }, 7);
    expect(cardsForBloodlineFilter(groups, "line").map((c) => c.id)).toEqual([2]);
    expect(cardsForBloodlineFilter(groups, "received").map((c) => c.id)).toEqual([3]);
    expect(cardsForBloodlineFilter(groups, "all").map((c) => c.id)).toEqual([1, 2, 3]);
  });

  it("검색은 카드명·설명·제작자·보유자 닉네임", () => {
    const cards = [mine, received];
    expect(searchBloodlineCards(cards, "박도").map((c) => c.id)).toEqual([3]);
    expect(searchBloodlineCards(cards, "오닉스")).toHaveLength(2);
    expect(searchBloodlineCards(cards, "  ")).toHaveLength(2);
    expect(searchBloodlineCards(cards, "없는값")).toHaveLength(0);
  });

  it("메타 줄과 발급일 형식", () => {
    expect(bloodlineCardMeta(mine)).toBe("장수풍뎅이 · 오닉스 라인");
    expect(bloodlineCardMeta({ speciesType: null, description: " " })).toBe("");
    expect(formatBloodlineIssuedAt("2026-03-14T03:00:00.000Z")).toBe("2026.03.14");
    expect(formatBloodlineIssuedAt("nope")).toBeNull();
  });
});

describe("BloodlineVisualCard (A안)", () => {
  it("이름·메타·보유자·등록일·카드 번호와 태그를 그리고 영문 장식 라벨이 없다", () => {
    const { container } = render(
      <BloodlineVisualCard
        cardId={10428}
        name="헤라클레스 장수풍뎅이"
        subtitle="장수풍뎅이 · 오닉스 라인"
        ownerName="김하늘"
        typeLabel="혈통"
        issuedAt="2026-03-14T03:00:00.000Z"
        variant="noir"
      />
    );
    expect(screen.getByText("헤라클레스 장수풍뎅이")).toBeInTheDocument();
    expect(screen.getByText("혈통")).toBeInTheDocument();
    expect(screen.getByText("보유자")).toBeInTheDocument();
    expect(screen.getByText("2026.03.14")).toBeInTheDocument();
    expect(screen.getByText("10428")).toBeInTheDocument();
    // 혈통 v2: "발급" 용어를 쓰지 않는다
    expect(screen.getByText("등록일")).toBeInTheDocument();
    expect(screen.getByText("카드 번호")).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/발급/);
    expect(container.textContent).not.toMatch(/BREDY|BLOODLINE|CID-/);
  });
});

describe("브리디북", () => {
  it("formatRecordValue 는 소수 첫째 자리 반올림", () => {
    expect(formatRecordValue(89.6329)).toBe("89.6");
    expect(formatRecordValue(84)).toBe("84");
    expect(formatRecordValue(84.05)).toBe("84.1");
    expect(formatRecordValue(Number.NaN)).toBe("NaN");
  });

  it("임시저장 키는 계정별이고, 레거시·다른 계정 키를 지운다", () => {
    localStorage.clear();
    expect(getGuinnessDraftKey(7)).toBe(`${GUINNESS_DRAFT_KEY_PREFIX}.7`);
    localStorage.setItem(LEGACY_GUINNESS_DRAFT_KEY, "{}");
    writeGuinnessDraft(getGuinnessDraftKey(7), { species: "장수" });
    writeGuinnessDraft(getGuinnessDraftKey(8), { species: "사슴" });
    localStorage.setItem("other", "keep");

    clearOtherGuinnessDrafts(7);
    expect(localStorage.getItem(LEGACY_GUINNESS_DRAFT_KEY)).toBeNull();
    expect(readGuinnessDraft<{ species: string }>(getGuinnessDraftKey(7))?.species).toBe("장수");
    expect(localStorage.getItem(getGuinnessDraftKey(8))).toBeNull();
    expect(localStorage.getItem("other")).toBe("keep");

    clearGuinnessDrafts(7);
    expect(localStorage.getItem(getGuinnessDraftKey(7))).toBeNull();
    expect(localStorage.getItem("other")).toBe("keep");
  });

  it("깨진 임시저장은 null 을 돌려주고 지운다", () => {
    localStorage.setItem(getGuinnessDraftKey(3), "{broken");
    expect(readGuinnessDraft(getGuinnessDraftKey(3))).toBeNull();
    expect(localStorage.getItem(getGuinnessDraftKey(3))).toBeNull();
  });
});

describe("혈통 이벤트 모으기", () => {
  const ev = (id: number, createdAt: string) => ({
    id,
    action: "BLOODLINE_CREATED" as const,
    actorUser: null,
    fromUser: null,
    toUser: null,
    relatedCard: null,
    note: null,
    createdAt,
  });

  it("최신순으로 합치고 일부 실패는 건너뛴다", async () => {
    const loader = jest.fn(async (cardId: number | string) => {
      if (cardId === 2) throw new Error("x");
      return [ev(Number(cardId), `2026-0${cardId}-01T00:00:00.000Z`)];
    });
    const merged = await loadMergedBloodlineEvents([1, 2, 3], 10, loader);
    expect(merged.map((e) => e.id)).toEqual([3, 1]);
  });

  it("여러 카드 응답에 같은 이벤트가 오면 한 번만 남긴다", async () => {
    const loader = jest.fn(async (cardId: number | string) =>
      cardId === 1
        ? [ev(10, "2026-03-01T00:00:00.000Z"), ev(11, "2026-02-01T00:00:00.000Z")]
        : [ev(10, "2026-03-01T00:00:00.000Z")]
    );
    const merged = await loadMergedBloodlineEvents([1, 2], 10, loader);
    expect(merged.map((e) => e.id)).toEqual([10, 11]);
  });

  it("전부 실패하면 오류", async () => {
    const loader = jest.fn(async () => {
      throw new Error("boom");
    });
    await expect(loadMergedBloodlineEvents([1, 2], 10, loader)).rejects.toThrow("boom");
    await expect(loadMergedBloodlineEvents([], 10, loader)).resolves.toEqual([]);
  });
});

/* ------------------------------------------------------------------ */
/* 혈통 v2 — 웹 혈통 화면 계약 호환·문구 (WB-3, AC-68~AC-72)              */
/* ------------------------------------------------------------------ */

const mockedAuthFetch = authFetch as jest.MockedFunction<typeof authFetch>;
const mockedShare = shareOrCopy as jest.MockedFunction<typeof shareOrCopy>;

type FetchRoute = (url: string, init?: RequestInit) => { status?: number; body: unknown } | undefined;

const jsonResponse = (body: unknown, status = 200) =>
  ({ ok: status < 400, status, json: async () => body }) as unknown as Response;

/** URL·메서드로 응답을 고른다. 없으면 404. */
function routeAuthFetch(route: FetchRoute) {
  mockedAuthFetch.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const hit = route(url, init);
    if (!hit) return jsonResponse({ success: false, error: `no route ${url}` }, 404);
    return jsonResponse(hit.body, hit.status ?? 200);
  });
}

const callsTo = (fragment: string, method = "POST") =>
  mockedAuthFetch.mock.calls.filter(
    ([url, init]) => String(url).includes(fragment) && (init?.method ?? "GET") === method
  );
const bodyOf = (call: unknown[]) => JSON.parse(String((call[1] as RequestInit).body));

function renderWithSwr(ui: ReactNode, fetcher?: (url: string) => Promise<unknown>) {
  return render(
    <SWRConfig
      value={{
        provider: () => new Map(),
        dedupingInterval: 0,
        shouldRetryOnError: false,
        ...(fetcher ? { fetcher } : {}),
      }}
    >
      {ui}
    </SWRConfig>
  );
}

const rootCard = (over: Partial<BloodlineCardItem> = {}) =>
  card({
    id: 5,
    name: "강산 라인",
    description: "2022년 공주 WF1 페어에서 시작한 극태 계열이에요.",
    speciesType: "사슴벌레",
    creator: { id: 7, name: "강산" },
    currentOwner: { id: 7, name: "강산" },
    isOwnedByMe: true,
    originSido: "충청남도",
    originSigungu: "공주시",
    originLabel: "충남 공주",
    receivedCount: 3,
    issueCount: 4,
    transferCount: 0,
    ...over,
  });

const lineCard = (over: Partial<BloodlineCardItem> = {}) =>
  card({
    id: 9,
    name: "강산 라인",
    description: "26 봄 세트 3령 유충 수컷",
    cardType: "LINE",
    speciesType: "사슴벌레",
    bloodlineReferenceId: 5,
    parentCardId: 5,
    creator: { id: 7, name: "강산" },
    currentOwner: { id: 12, name: "도윤파파" },
    originLabel: "충남 공주",
    transferCount: 1,
    createdAt: "2026-09-12T03:00:00.000Z",
    ...over,
  });

const event = (over: Partial<BloodlineCardEventItem>): BloodlineCardEventItem => ({
  id: 1,
  action: "BLOODLINE_CREATED",
  actorUser: null,
  fromUser: null,
  toUser: null,
  relatedCard: null,
  note: null,
  createdAt: "2026-09-12T03:00:00.000Z",
  ...over,
});

const masked = { id: 0, name: "닉네임 비공개", masked: true };

describe("혈통 화면 공용 문구 (BloodlineScreenParts)", () => {
  it("가린 사용자는 '닉네임 비공개'이고 프로필 링크가 없다", () => {
    expect(bloodlineUserLabel(masked)).toBe("닉네임 비공개");
    expect(bloodlineUserLabel({ id: 3, name: "강산" })).toBe("강산");
    expect(bloodlineUserLabel(null)).toBe("탈퇴한 사용자");
    expect(bloodlineProfileHref(masked)).toBeNull();
    expect(bloodlineProfileHref({ id: 0, name: "탈퇴한 사용자" })).toBeNull();
    expect(bloodlineProfileHref({ id: 3, name: "강산" })).toBe("/profiles/3");
  });

  it("조사를 받침에 맞춘다", () => {
    expect(withJosa("강산 라인", "을/를")).toBe("강산 라인을");
    expect(withJosa("공주 극태", "을/를")).toBe("공주 극태를");
    expect(withJosa("도윤파파", "으로/로")).toBe("도윤파파로");
    expect(withJosa("하늘", "으로/로")).toBe("하늘로");
    expect(withJosa("강산", "으로/로")).toBe("강산으로");
  });

  it("?action=send(issue)·transfer 와 받는 사람·경매를 읽는다", () => {
    expect(
      readBloodlineSendParams(
        new URLSearchParams("action=send&toUserId=12&toUserName=도윤파파&auctionId=77")
      )
    ).toEqual({ action: "send", toUserId: 12, toUserName: "도윤파파", auctionId: 77 });
    expect(readBloodlineSendParams(new URLSearchParams("action=issue")).action).toBe("send");
    expect(readBloodlineSendParams(new URLSearchParams("action=transfer")).action).toBe("transfer");
    expect(readBloodlineSendParams(new URLSearchParams("action=send&toUserId=abc&auctionId=-1"))).toEqual({
      action: "send",
    });
    expect(readBloodlineSendParams(new URLSearchParams("")).action).toBeNull();
    expect(readBloodlineSendParams(null).action).toBeNull();
  });

  it("링크로 채울 받는 사람은 toUserId 의 실제 프로필 닉네임이고, URL 닉네임과 다르면 채우지 않는다", () => {
    const profile = { success: true, user: { id: 12, name: "도윤파파" } };
    expect(resolveBloodlineSendPreset({ toUserId: 12, toUserName: "도윤파파" }, profile)).toEqual({
      id: 12,
      name: "도윤파파",
    });
    // URL 닉네임이 없어도 실제 닉네임으로 채운다
    expect(resolveBloodlineSendPreset({ toUserId: 12 }, profile)).toEqual({ id: 12, name: "도윤파파" });
    // 다른 사람 id 를 다른 닉네임으로 위장
    expect(resolveBloodlineSendPreset({ toUserId: 12, toUserName: "낙찰자" }, profile)).toBeNull();
    // 프로필을 못 받았거나 id 가 다르면 채우지 않는다
    expect(resolveBloodlineSendPreset({ toUserId: 12 }, null)).toBeNull();
    expect(resolveBloodlineSendPreset({ toUserId: 12 }, { success: false })).toBeNull();
    expect(resolveBloodlineSendPreset({ toUserId: 13 }, profile)).toBeNull();
    expect(resolveBloodlineSendPreset({}, profile)).toBeNull();
  });

  it("오류 문구는 errorCode 먼저, 없으면 서버 문구, 그것도 없으면 기본 문구", () => {
    expect(
      bloodlineErrorText({ errorCode: "BLOODLINE_RECEIVER_SELF", error: "서버 문구" }, "기본")
    ).toBe("나에게는 보낼 수 없어요");
    expect(bloodlineErrorText({ errorCode: "MYSTERY", error: "서버 문구" }, "기본")).toBe("서버 문구");
    expect(bloodlineErrorText({ error: "  " }, "기본")).toBe("기본");
    expect(bloodlineErrorText(null, "기본")).toBe("기본");
  });

  it("행 메타: 혈통은 '종 · 산지 · 받은 사람 N명', 출처 카드는 '종 · ○○님에게서 · 날짜'", () => {
    expect(bloodlineRowMeta(rootCard())).toBe("사슴벌레 · 충남 공주 · 받은 사람 3명");
    expect(bloodlineRowMeta(rootCard({ receivedCount: 0 }))).toBe("사슴벌레 · 충남 공주 · 아직 받은 사람 없음");
    expect(
      bloodlineRowMeta(
        rootCard({ receivedCount: undefined, speciesType: null, originLabel: null, originSido: null })
      )
    ).toBe("종 미지정");
    expect(bloodlineRowMeta(rootCard({ originLabel: null }))).toBe("사슴벌레 · 충남 공주 · 받은 사람 3명");
    expect(bloodlineRowMeta(lineCard())).toBe("사슴벌레 · 강산님에게서 · 2026.09.12");
    expect(
      bloodlineRowMeta(
        lineCard({
          transfers: [
            {
              id: 3,
              fromUser: masked,
              toUser: { id: 12, name: "도윤파파" },
              note: null,
              createdAt: "2026-10-01T03:00:00.000Z",
            },
          ],
        })
      )
    ).toBe("사슴벌레 · 닉네임 비공개 분에게서 · 2026.10.01");
  });

  it("이력 라벨은 새 용어이고, 검색 문자열에서 가린 이름을 뺀다", () => {
    expect(BLOODLINE_EVENT_LABELS).toEqual({
      BLOODLINE_CREATED: "만들었어요",
      LINE_CREATED: "보냈어요",
      LINE_ISSUED: "보냈어요",
      LINE_TRANSFER: "다음 분에게 보냈어요",
      BLOODLINE_TRANSFER: "혈통을 넘겼어요",
      CARD_REVOKED: "운영 정책으로 회수됐어요",
    });
    const text = bloodlineEventSearchText(
      event({
        action: "LINE_ISSUED",
        actorUser: { id: 7, name: "강산" },
        toUser: masked,
        relatedCard: { id: 5, name: "강산 라인" },
        note: "3령 수컷",
      })
    );
    expect(text).toContain("강산");
    expect(text).toContain("강산 라인");
    expect(text).toContain("3령 수컷");
    expect(text).not.toContain("비공개");
  });

  it("헤더 오른쪽 슬롯을 그린다", () => {
    render(<BloodlineHeader title="혈통" right={<button type="button">공유</button>} />);
    expect(screen.getByRole("heading", { name: "혈통" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "공유" })).toBeInTheDocument();
  });

  it("받음 알림(BLOODLINE_RECEIVED)은 종 아이콘", () => {
    expect(getNotificationIcon("BLOODLINE_RECEIVED")).toBe("bell");
  });
});

describe("웹 혈통 상세 (BloodlineCardDetailClient)", () => {
  const owner = { id: 7, name: "강산" };
  const events = [
    event({ id: 3, action: "LINE_ISSUED", actorUser: owner, fromUser: owner, toUser: masked, note: "3령 수컷" }),
    event({ id: 2, action: "LINE_CREATED", actorUser: owner, toUser: masked }),
    event({ id: 1, action: "BLOODLINE_CREATED", actorUser: owner, toUser: owner }),
  ];

  const detailRoute =
    (detail: Record<string, unknown>, extra?: FetchRoute): FetchRoute =>
    (url, init) => {
      const method = init?.method ?? "GET";
      const extraHit = extra?.(url, init);
      if (extraHit) return extraHit;
      if (method === "GET" && /\/api\/bloodline-cards\/\d+\/events/.test(url)) {
        return { body: { success: true, events } };
      }
      if (method === "GET" && /\/api\/bloodline-cards\/\d+$/.test(url)) {
        return { body: { success: true, bloodlineSourceCard: null, parentLineCard: null, ...detail } };
      }
      if (url.startsWith("/api/users/search")) {
        return { body: { success: true, users: [{ id: 12, name: "도윤파파" }, { id: 7, name: "강산" }] } };
      }
      // 링크로 미리 채울 받는 사람은 실제 프로필로 확인한다
      const profileMatch = method === "GET" ? /^\/api\/users\/(\d+)$/.exec(url) : null;
      if (profileMatch) {
        const profiles: Record<string, string> = { "12": "도윤파파", "30": "낙찰자", "44": "다른사람" };
        const name = profiles[profileMatch[1]];
        return name
          ? { body: { success: true, user: { id: Number(profileMatch[1]), name } } }
          : { status: 404, body: { success: false } };
      }
      return undefined;
    };

  beforeEach(() => {
    mockedAuthFetch.mockReset();
    mockedShare.mockClear();
    mockReplace.mockClear();
    mockSearchParams = new URLSearchParams();
    mockUseUser.mockReturnValue({ user: owner, isLoading: false });
  });

  it("보유자 하단 주 버튼은 '출처 카드 보내기' 하나, '혈통 넘기기'는 보조, 라인 이름 칸이 없다 (AC-68)", async () => {
    routeAuthFetch(detailRoute({ card: rootCard(), viewerRelation: "owner" }));
    renderWithSwr(<BloodlineCardDetailClient cardId={5} />);

    const send = await screen.findByRole("button", { name: "출처 카드 보내기" });
    expect(screen.getByRole("button", { name: "혈통 넘기기" })).toBeInTheDocument();
    expect(screen.queryByText("라인 만들기")).toBeNull();
    expect(screen.queryByText("카드 보내기")).toBeNull();

    fireEvent.click(send);
    expect(screen.queryByLabelText("라인 이름")).toBeNull();
    expect(screen.getByLabelText("받는 분")).toBeInTheDocument();
    // 받는 사람 없이는 보낼 수 없다
    expect(screen.getByRole("button", { name: "보내기" })).toBeDisabled();
  });

  it("닉네임 검색은 authFetch 로 부르고(AC-69), 확인창을 거쳐 issue-line 에 받는 사람·메모·경로를 보내 '보냈어요'를 띄운다", async () => {
    routeAuthFetch(
      detailRoute({ card: rootCard(), viewerRelation: "owner" }, (url, init) =>
        url === "/api/bloodline-cards/5/issue-line" && init?.method === "POST"
          ? { body: { success: true, card: lineCard() } }
          : undefined
      )
    );
    renderWithSwr(<BloodlineCardDetailClient cardId={5} />);

    fireEvent.click(await screen.findByRole("button", { name: "출처 카드 보내기" }));
    fireEvent.change(screen.getByLabelText("받는 분"), { target: { value: "도윤" } });
    const candidate = await screen.findByRole("button", { name: "도윤파파" });
    expect(callsTo("/api/users/search?q=%EB%8F%84%EC%9C%A4", "GET").length).toBeGreaterThan(0);
    // 나 자신은 후보에 없다
    expect(screen.queryByRole("button", { name: "강산" })).toBeNull();
    fireEvent.click(candidate);
    fireEvent.change(screen.getByLabelText("메모 (선택)"), { target: { value: "26 봄 세트 3령 암컷" } });
    fireEvent.click(screen.getByRole("button", { name: "보내기" }));

    const dialog = await screen.findByRole("dialog", {
      name: "도윤파파님에게 강산 라인 출처 카드를 보낼까요?",
    });
    expect(within(dialog).getByText("보내면 되돌릴 수 없어요.")).toBeInTheDocument();
    expect(callsTo("/issue-line")).toHaveLength(0);
    fireEvent.click(within(dialog).getByRole("button", { name: "보내기" }));

    expect(await screen.findByText("보냈어요")).toBeInTheDocument();
    const [call] = callsTo("/api/bloodline-cards/5/issue-line");
    expect(bodyOf(call)).toEqual({
      toUserName: "도윤파파",
      toUserId: 12,
      note: "26 봄 세트 3령 암컷",
      source: { type: "search" },
    });
  });

  it("?action=send&toUserId&toUserName&auctionId 로 받는 사람을 미리 채우고 source 를 경매로 보낸다", async () => {
    mockSearchParams = new URLSearchParams("action=send&toUserId=12&toUserName=도윤파파&auctionId=77");
    routeAuthFetch(
      detailRoute({ card: rootCard(), viewerRelation: "owner" }, (url, init) =>
        url === "/api/bloodline-cards/5/issue-line" && init?.method === "POST"
          ? { body: { success: true, card: lineCard() } }
          : undefined
      )
    );
    renderWithSwr(<BloodlineCardDetailClient cardId={5} />);

    await waitFor(() => expect(screen.getByLabelText("받는 분")).toHaveValue("도윤파파"));
    fireEvent.click(screen.getByRole("button", { name: "보내기" }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "보내기" }));

    await screen.findByText("보냈어요");
    const [call] = callsTo("/api/bloodline-cards/5/issue-line");
    expect(bodyOf(call)).toEqual({
      toUserName: "도윤파파",
      toUserId: 12,
      source: { type: "auction", auctionId: 77 },
    });
  });

  it("링크의 닉네임이 toUserId 의 실제 닉네임과 다르면 받는 사람을 채우지 않는다(조작한 링크)", async () => {
    // toUserId=44 의 실제 닉네임은 '다른사람'인데 링크는 '도윤파파'로 보이게 했다
    mockSearchParams = new URLSearchParams("action=send&toUserId=44&toUserName=도윤파파&auctionId=77");
    routeAuthFetch(detailRoute({ card: rootCard(), viewerRelation: "owner" }));
    renderWithSwr(<BloodlineCardDetailClient cardId={5} />);

    const input = await screen.findByLabelText("받는 분");
    await waitFor(() => expect(callsTo("/api/users/44", "GET").length).toBeGreaterThan(0));
    // 확인이 끝나도 비어 있다(URL 닉네임을 쓰지 않는다)
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(input).toHaveValue("");
    expect(screen.getByRole("button", { name: "보내기" })).toBeDisabled();
  });

  it("혈통 넘기기 링크(?action=transfer)는 뿌리 혈통에서 받는 사람을 미리 채우지 않는다", async () => {
    mockSearchParams = new URLSearchParams("action=transfer&toUserId=12&toUserName=도윤파파");
    routeAuthFetch(detailRoute({ card: rootCard(), viewerRelation: "owner" }));
    renderWithSwr(<BloodlineCardDetailClient cardId={5} />);

    const input = await screen.findByLabelText("받는 분");
    expect(screen.getByRole("button", { name: "넘기기" })).toBeInTheDocument();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(input).toHaveValue("");
    expect(callsTo("/api/users/12", "GET")).toHaveLength(0);
  });

  it("지금 보낼 수 없는 링크로 들어오면 조용히 넘어가지 않고 알린다", async () => {
    // 판매자가 혈통을 넘겼고 출처 카드도 없다(viewerRelation none)
    mockSearchParams = new URLSearchParams("action=send&toUserId=12&toUserName=도윤파파&auctionId=77");
    routeAuthFetch(detailRoute({ card: rootCard({ isOwnedByMe: false }), viewerRelation: "none" }));
    renderWithSwr(<BloodlineCardDetailClient cardId={5} />);

    expect(await screen.findByText("지금 이 혈통을 보낼 수 없어요")).toBeInTheDocument();
    expect(screen.queryByLabelText("받는 분")).toBeNull();
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("출처 카드만 가진 판매자가 ?action=send 로 뿌리를 열면 내 출처 카드의 '다음 분에게 보내기'로 옮긴다", async () => {
    // 낙찰자 제안 링크는 뿌리 id 로 온다. 판매자(도윤파파 12)는 출처 카드 9 만 가졌다.
    mockUseUser.mockReturnValue({ user: { id: 12, name: "도윤파파" }, isLoading: false });
    mockSearchParams = new URLSearchParams("action=send&toUserId=30&toUserName=낙찰자&auctionId=77");
    routeAuthFetch(
      detailRoute({
        card: rootCard({ isOwnedByMe: false }),
        viewerRelation: "holder",
        viewerLineCard: lineCard({ isOwnedByMe: true }),
      })
    );
    renderWithSwr(<BloodlineCardDetailClient cardId={5} />);

    await waitFor(() => expect(mockReplace).toHaveBeenCalled());
    const [href] = mockReplace.mock.calls[0];
    const [path, query] = String(href).split("?");
    expect(path).toBe("/bloodline-management/card/9");
    expect(Object.fromEntries(new URLSearchParams(query))).toEqual({
      action: "transfer",
      toUserId: "30",
      toUserName: "낙찰자",
      auctionId: "77",
    });
    expect(callsTo("/issue-line")).toHaveLength(0);
  });

  it("보내기 오류는 errorCode 문구로 보인다", async () => {
    mockSearchParams = new URLSearchParams("action=send&toUserId=12&toUserName=도윤파파");
    routeAuthFetch(
      detailRoute({ card: rootCard(), viewerRelation: "owner" }, (url, init) =>
        url === "/api/bloodline-cards/5/issue-line" && init?.method === "POST"
          ? {
              status: 409,
              body: { success: false, card: null, errorCode: "BLOODLINE_ALREADY_SENT", error: "서버 문구" },
            }
          : undefined
      )
    );
    renderWithSwr(<BloodlineCardDetailClient cardId={5} />);

    await waitFor(() => expect(screen.getByLabelText("받는 분")).toHaveValue("도윤파파"));
    fireEvent.click(screen.getByRole("button", { name: "보내기" }));
    fireEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "보내기" }));
    expect(await screen.findByText("이미 받은 분이에요")).toBeInTheDocument();
    expect(screen.queryByText("서버 문구")).toBeNull();
  });

  it("혈통 넘기기는 danger 확인창을 거쳐 transfer 로 보낸다", async () => {
    routeAuthFetch(
      detailRoute({ card: rootCard(), viewerRelation: "owner" }, (url, init) =>
        url === "/api/bloodline-cards/5/transfer" && init?.method === "POST"
          ? { body: { success: true } }
          : undefined
      )
    );
    renderWithSwr(<BloodlineCardDetailClient cardId={5} />);

    fireEvent.click(await screen.findByRole("button", { name: "혈통 넘기기" }));
    fireEvent.change(screen.getByLabelText("받는 분"), { target: { value: "도윤파파" } });
    fireEvent.click(screen.getByRole("button", { name: "넘기기" }));

    const dialog = await screen.findByRole("dialog", { name: "혈통을 넘길까요?" });
    expect(within(dialog).getByText("혈통 자체가 도윤파파님에게 넘어가요. 되돌릴 수 없어요.")).toBeInTheDocument();
    const confirmButton = within(dialog).getByRole("button", { name: "넘기기" });
    expect(confirmButton.className).toContain("bg-app-danger");
    fireEvent.click(confirmButton);

    expect(await screen.findByText("넘겼어요")).toBeInTheDocument();
    const [call] = callsTo("/api/bloodline-cards/5/transfer");
    expect(bodyOf(call)).toEqual({ toUserName: "도윤파파", source: { type: "search" } });
  });

  it("정보 표: 상태·카드 번호·원본/상위 행이 없고 보낸 횟수·산지·받은 사람이 있다. 이력은 가린 이름을 '닉네임 비공개'로 그린다", async () => {
    mockUseUser.mockReturnValue({ user: { id: 99, name: "구경꾼" }, isLoading: false });
    routeAuthFetch(detailRoute({ card: rootCard({ isOwnedByMe: false }), viewerRelation: "none" }));
    renderWithSwr(<BloodlineCardDetailClient cardId={5} />);

    expect(await screen.findByText("보낸 횟수")).toBeInTheDocument();
    expect(screen.getByText("4회")).toBeInTheDocument();
    expect(screen.getByText("산지")).toBeInTheDocument();
    expect(screen.getAllByText("충남 공주").length).toBeGreaterThan(0);
    expect(screen.getByText("받은 사람")).toBeInTheDocument();
    expect(screen.getByText("3명")).toBeInTheDocument();
    for (const gone of ["상태", "카드 번호", "원본 혈통", "상위 라인", "발급 횟수", "양도 이력"]) {
      expect(screen.queryByText(gone)).toBeNull();
    }
    // 이력: LINE_CREATED 는 숨기고, 가린 받는 사람은 '닉네임 비공개 분'
    expect(await screen.findByText("닉네임 비공개 분에게 보냈어요")).toBeInTheDocument();
    expect(screen.getByText("강산님이 만들었어요")).toBeInTheDocument();
    expect(screen.getAllByText(/보냈어요$/)).toHaveLength(1);
    // 보유자가 아니면 보내기·넘기기가 없고 신뢰 고지가 있다
    expect(screen.queryByRole("button", { name: "출처 카드 보내기" })).toBeNull();
    expect(screen.queryByRole("button", { name: "혈통 넘기기" })).toBeNull();
    expect(screen.getByText(BLOODLINE_TRUST_NOTICE)).toBeInTheDocument();
  });

  it("출처 카드의 가린 보유자는 링크 없이 '닉네임 비공개'이고, 혈통 행은 뿌리로 간다 (AC-70)", async () => {
    mockUseUser.mockReturnValue({ user: { id: 99, name: "구경꾼" }, isLoading: false });
    routeAuthFetch(
      detailRoute({
        card: lineCard({ currentOwner: masked, isOwnedByMe: false }),
        bloodlineSourceCard: rootCard({ isOwnedByMe: false }),
        viewerRelation: "none",
      })
    );
    renderWithSwr(<BloodlineCardDetailClient cardId={9} />);

    const ownerLabel = await screen.findByText("현재 보유자");
    const row = ownerLabel.parentElement as HTMLElement;
    expect(row).toHaveTextContent("닉네임 비공개");
    expect(row.closest("a")).toBeNull();
    expect(screen.getByRole("link", { name: "혈통 강산 라인" })).toHaveAttribute(
      "href",
      "/bloodline-management/card/5"
    );
    expect(screen.getByRole("heading", { name: "출처 카드" })).toBeInTheDocument();
  });

  it("출처 카드 보유자에게 '내 닉네임 공개' 토글이 있고 PATCH ownerNameVisible 로 바꾼다 (AC-70)", async () => {
    mockUseUser.mockReturnValue({ user: { id: 12, name: "도윤파파" }, isLoading: false });
    // 서버처럼 PATCH 뒤 다시 받으면 바뀐 값을 준다
    let visible = false;
    routeAuthFetch((url, init) => {
      if (url === "/api/bloodline-cards/9" && init?.method === "PATCH") {
        visible = JSON.parse(String(init.body)).ownerNameVisible;
        return { body: { success: true, card: lineCard({ isOwnedByMe: true, ownerNameVisible: visible }) } };
      }
      return detailRoute({
        card: lineCard({ isOwnedByMe: true, ownerNameVisible: visible }),
        bloodlineSourceCard: rootCard({ isOwnedByMe: false }),
        viewerRelation: "holder",
      })(url, init);
    });
    renderWithSwr(<BloodlineCardDetailClient cardId={9} />);

    const toggle = await screen.findByRole("switch", { name: "내 닉네임 공개" });
    expect(toggle).toHaveAttribute("aria-checked", "false");
    expect(screen.getByText("켜면 이 혈통 페이지에 도윤파파로 보여요")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "다음 분에게 보내기" })).toBeInTheDocument();
    fireEvent.click(toggle);

    await waitFor(() => expect(callsTo("/api/bloodline-cards/9", "PATCH")).toHaveLength(1));
    expect(bodyOf(callsTo("/api/bloodline-cards/9", "PATCH")[0])).toEqual({ ownerNameVisible: true });
    await waitFor(() => expect(toggle).toHaveAttribute("aria-checked", "true"));
  });

  it("회수된 혈통은 errorCode 로 '운영 정책으로 회수된 혈통이에요'를 그린다", async () => {
    routeAuthFetch((url) =>
      url === "/api/bloodline-cards/5"
        ? {
            status: 404,
            body: {
              success: false,
              card: null,
              bloodlineSourceCard: null,
              parentLineCard: null,
              errorCode: "BLOODLINE_REVOKED",
              error: "서버 문구",
            },
          }
        : undefined
    );
    renderWithSwr(<BloodlineCardDetailClient cardId={5} />);
    expect(await screen.findByText("운영 정책으로 회수된 혈통이에요")).toBeInTheDocument();
  });

  it("헤더 공유 아이콘은 공개 URL 을 shareOrCopy 로 넘긴다", async () => {
    routeAuthFetch(detailRoute({ card: rootCard(), viewerRelation: "owner" }));
    renderWithSwr(<BloodlineCardDetailClient cardId={5} />);
    fireEvent.click(await screen.findByRole("button", { name: "공유" }));
    expect(mockedShare).toHaveBeenCalledWith({
      title: "강산 라인 · 사슴벌레",
      url: "/bloodline-management/card/5",
    });
  });
});

describe("웹 혈통 만들기 (BloodlineCardCreateClient, AC-71)", () => {
  const categories = [
    { id: 1, name: "곤충", slug: "insect", parentId: null, path: "/insect/", sortOrder: 1 },
    { id: 2, name: "기타", slug: "etc", parentId: null, path: "/etc/", sortOrder: 99 },
    { id: 11, name: "사슴벌레", slug: "stag-beetle", parentId: 1, path: "/insect/stag-beetle/", sortOrder: 2 },
    { id: 10, name: "장수풍뎅이", slug: "rhinoceros-beetle", parentId: 1, path: "/insect/rhinoceros-beetle/", sortOrder: 1 },
  ];
  const swrFetcher = async (url: string) => {
    if (url === "/api/categories") return { success: true, categories };
    throw new Error(`unexpected ${url}`);
  };
  const mockedGlobalFetch = global.fetch as jest.Mock;

  beforeAll(() => {
    Object.assign(URL, {
      createObjectURL: jest.fn(() => "blob:preview"),
      revokeObjectURL: jest.fn(),
    });
  });

  beforeEach(() => {
    mockedAuthFetch.mockReset();
    mockReplace.mockClear();
    mockedGlobalFetch.mockReset();
    mockUseUser.mockReturnValue({ user: { id: 7, name: "강산" }, isLoading: false });
  });

  const chooseSpecies = async () => {
    const group = await screen.findByLabelText("분류");
    await waitFor(() => expect(within(group).getByRole("option", { name: "곤충" })).toBeInTheDocument());
    fireEvent.change(group, { target: { value: "곤충" } });
    const species = screen.getByLabelText("종") as HTMLSelectElement;
    expect(Array.from(species.options).map((option) => option.text)).toEqual([
      "종 선택",
      "장수풍뎅이",
      "사슴벌레",
    ]);
    fireEvent.change(species, { target: { value: "사슴벌레" } });
  };

  const uploadPhoto = async () => {
    const file = new File(["x"], "beetle.png", { type: "image/png" });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });
    await screen.findByAltText("선택한 사진");
    // 업로드가 끝나면(스피너가 사라지면) 만들 수 있다
    await waitFor(() => expect(screen.queryByRole("status", { name: "불러오는 중" })).toBeNull());
  };

  it("카드 스타일·확인창이 없고, 종·사진이 없으면 막는다", async () => {
    renderWithSwr(<BloodlineCardCreateClient />, swrFetcher);
    expect(screen.getByRole("heading", { name: "혈통 만들기" })).toBeInTheDocument();
    expect(screen.queryByText("카드 스타일")).toBeNull();
    expect(screen.getByText("혈통 소개 (선택)")).toBeInTheDocument();
    expect(screen.getByText(/산지/)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("혈통 이름"), { target: { value: "강산 라인" } });
    fireEvent.click(screen.getByRole("button", { name: "혈통 만들기" }));
    expect(await screen.findByText("종을 골라 주세요")).toBeInTheDocument();
    expect(screen.getByText("대표 사진 1장이 필요해요")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(callsTo("/api/bloodline-cards")).toHaveLength(0);
  });

  it("띄어쓰기 이름·종·사진·산지를 보내고(visualStyle 없음) 상세로 간다", async () => {
    routeAuthFetch((url, init) => {
      if (url === "/api/files") return { body: { uploadURL: "https://upload.test", id: "img-1" } };
      if (url === "/api/bloodline-cards" && init?.method === "POST") {
        return { body: { success: true, myBloodlines: [rootCard({ id: 31 })] } };
      }
      return undefined;
    });
    mockedGlobalFetch.mockResolvedValue(jsonResponse({ success: true, result: { id: "img-1" } }));
    renderWithSwr(<BloodlineCardCreateClient />, swrFetcher);

    fireEvent.change(screen.getByLabelText("혈통 이름"), { target: { value: "  강산   라인 " } });
    await chooseSpecies();
    await uploadPhoto();
    fireEvent.change(screen.getByLabelText("시·도"), { target: { value: "충청남도" } });
    fireEvent.change(screen.getByLabelText("시·군·구"), { target: { value: "공주시" } });
    fireEvent.click(screen.getByRole("button", { name: "혈통 만들기" }));

    await waitFor(() => expect(callsTo("/api/bloodline-cards")).toHaveLength(1));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(bodyOf(callsTo("/api/bloodline-cards")[0])).toEqual({
      name: "강산 라인",
      speciesType: "사슴벌레",
      image: "img-1",
      originSido: "충청남도",
      originSigungu: "공주시",
    });
    await waitFor(() =>
      expect(mockReplace).toHaveBeenCalledWith(
        expect.stringContaining("/bloodline-management/card/31?celebration=card-created")
      )
    );
  });

  it("하위가 없는 분류(기타)는 그 자체가 종이다", async () => {
    renderWithSwr(<BloodlineCardCreateClient />, swrFetcher);
    const group = await screen.findByLabelText("분류");
    await waitFor(() => expect(within(group).getByRole("option", { name: "기타" })).toBeInTheDocument());
    fireEvent.change(group, { target: { value: "기타" } });
    expect(screen.queryByLabelText("종")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "혈통 만들기" }));
    expect(await screen.findByText("대표 사진 1장이 필요해요")).toBeInTheDocument();
    expect(screen.queryByText("종을 골라 주세요")).toBeNull();
  });

  it("중복 이름은 errorCode 로 판정해 이름 칸 오류로 보인다", async () => {
    routeAuthFetch((url, init) => {
      if (url === "/api/files") return { body: { uploadURL: "https://upload.test", id: "img-1" } };
      if (url === "/api/bloodline-cards" && init?.method === "POST") {
        return {
          status: 409,
          body: { success: false, errorCode: "BLOODLINE_DUPLICATE_NAME", error: "서버 문구" },
        };
      }
      return undefined;
    });
    mockedGlobalFetch.mockResolvedValue(jsonResponse({ success: true, result: { id: "img-1" } }));
    renderWithSwr(<BloodlineCardCreateClient />, swrFetcher);

    fireEvent.change(screen.getByLabelText("혈통 이름"), { target: { value: "강산 라인" } });
    await chooseSpecies();
    await uploadPhoto();
    fireEvent.click(screen.getByRole("button", { name: "혈통 만들기" }));

    const error = await screen.findByText("이미 사용 중인 이름이에요");
    expect(error).toHaveAttribute("id", "bloodline-card-name-error");
  });
});

describe("웹 혈통 관리·프로필 문구 (AC-72)", () => {
  beforeEach(() => {
    mockedAuthFetch.mockReset();
    mockSearchParams = new URLSearchParams();
    mockUseUser.mockReturnValue({ user: { id: 7, name: "강산" }, isLoading: false });
  });

  it("혈통 관리: 칩 '출처 카드', CTA '혈통 만들기', 혈통 행 메타에 받은 사람 수", async () => {
    const data = {
      success: true,
      myBloodlines: [rootCard()],
      receivedBloodlines: [],
      createdLines: [],
      receivedLines: [lineCard({ currentOwner: { id: 7, name: "강산" }, creator: { id: 3, name: "백두" } })],
      myCreatedCards: [],
      receivedCards: [],
      ownedCards: [],
    };
    renderWithSwr(<BloodlineManagementClient />, async () => data);

    expect(await screen.findByText("사슴벌레 · 충남 공주 · 받은 사람 3명")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "출처 카드" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "라인" })).toBeNull();
    expect(screen.getByRole("link", { name: "혈통 만들기" })).toHaveAttribute("href", "/bloodline-cards/create");
    expect(document.body.textContent).not.toMatch(/라인카드|혈통카드|내 라인/);
  });

  it("프로필 보유 혈통 행: '받은 사람 N명', '출처 카드', 카드 번호 없음", () => {
    render(
      <ProfileBloodlineRows
        data={{ success: true, cards: [rootCard({ description: null }), lineCard({ description: null })] }}
        isLoading={false}
        isError={false}
        onRetry={jest.fn()}
      />
    );
    expect(screen.getByText("혈통 · 보유 강산 · 받은 사람 3명")).toBeInTheDocument();
    expect(screen.getByText("출처 카드 · 보유 도윤파파")).toBeInTheDocument();
    expect(screen.getAllByText("사슴벌레 · 충남 공주")).toHaveLength(2);
    expect(document.body.textContent).not.toMatch(/BC-|발급|라인 ·/);
  });
});
