import { render, screen } from "@testing-library/react";
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

jest.mock("@libs/client/authFetch", () => ({ authFetch: jest.fn() }));

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

  it("새 필드가 있으면 그대로, 없으면 ownedCards 로 내 혈통/라인/받은 카드를 나눈다", () => {
    const direct = groupBloodlineCards({ myBloodlines: [mine], createdLines: [line], receivedBloodlines: [received] }, 7);
    expect(direct.myBloodlines).toEqual([mine]);
    expect(direct.receivedCards).toEqual([received]);

    const compat = groupBloodlineCards({ ownedCards: [mine, line, received] }, 7);
    expect(compat.myBloodlines.map((c) => c.id)).toEqual([1]);
    expect(compat.createdLines.map((c) => c.id)).toEqual([2]);
    expect(compat.receivedCards.map((c) => c.id)).toEqual([3]);
    expect(groupBloodlineCards(null).myBloodlines).toEqual([]);
  });

  it("칩: 라인 칩은 LINE 카드만, 전체는 id 중복 제거", () => {
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
  it("이름·메타·보유자·발급일·발급번호와 태그를 그리고 영문 장식 라벨이 없다", () => {
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
