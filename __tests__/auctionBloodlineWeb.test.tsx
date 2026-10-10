/**
 * 웹 경매의 혈통 부품(WB-2, 설계 §4.3, PRD S-6·S-7·AC-65·AC-67).
 * 등록·수정 select(+ 부모·누대 3칸), 상세 혈통 행 + 낙찰자 출처 카드 보내기 제안, 경매 오류 문구.
 */
import fs from "fs";
import path from "path";
import { useState, type ReactNode } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { SWRConfig } from "swr";

const mockUseUser = jest.fn(() => ({ user: { id: 1, name: "나" } }));
// jest 설정에 hooks/ 별칭이 없어 가상 모듈로 막는다(BloodlineAttachSheet 가 쓴다).
jest.mock(
  "hooks/useUser",
  () => ({ __esModule: true, default: () => mockUseUser() }),
  { virtual: true }
);
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
}));
jest.mock("@components/features/MainLayout", () => ({
  __esModule: true,
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  toLoginHref: (next: string) => `/login?next=${encodeURIComponent(next)}`,
}));
jest.mock("@libs/client/authFetch", () => ({ authFetch: jest.fn() }));

import {
  AUCTION_BLOODLINE_HELP,
  AuctionBloodlineField,
  AuctionBloodlineRows,
  attachableOptionLabel,
  auctionPedigreePayload,
  shouldSuggestWinnerSend,
  winnerSendHref,
  winnerSendText,
} from "../app/(web)/auctions/AuctionBloodlineParts";
import { getAuctionErrorMessage, getAuctionResultMessage } from "@libs/client/auctionErrorMessage";
import type {
  AttachableBloodline,
  AuctionBloodlineLinkSummary,
  BloodlineCardsResponse,
} from "@libs/shared/bloodline-card";
import type { PedigreeNote } from "@libs/shared/pedigree-note";

const attachable = (over: Partial<AttachableBloodline> = {}): AttachableBloodline => ({
  rootId: 5,
  name: "강산 라인",
  speciesType: "왕사슴벌레",
  originLabel: "충남 공주",
  creator: { id: 1, name: "나" },
  relation: "mine",
  ...over,
});

const summary = (over: Partial<AuctionBloodlineLinkSummary> = {}): AuctionBloodlineLinkSummary => ({
  id: 5,
  name: "강산 라인",
  speciesType: "왕사슴벌레",
  originLabel: "충남 공주",
  creator: { id: 1, name: "강산" },
  sellerRelation: "creator",
  receivedAt: null,
  ...over,
});

const listResponse = (items: AttachableBloodline[]): BloodlineCardsResponse => ({
  success: true,
  myBloodlines: [],
  receivedBloodlines: [],
  createdLines: [],
  receivedLines: [],
  myCreatedCards: [],
  receivedCards: [],
  ownedCards: [],
  attachable: items,
});

function withSwr(ui: ReactNode, data: BloodlineCardsResponse) {
  const fetcher = jest.fn(async () => data);
  return {
    fetcher,
    ...render(
      <SWRConfig value={{ provider: () => new Map(), fetcher, dedupingInterval: 0 }}>{ui}</SWRConfig>
    ),
  };
}

function FieldHarness({
  initialValue = "",
  initialNote = {},
  currentRootId,
  currentLabel,
}: {
  initialValue?: string;
  initialNote?: PedigreeNote;
  currentRootId?: number | null;
  currentLabel?: string | null;
}) {
  const [value, setValue] = useState(initialValue);
  const [note, setNote] = useState<PedigreeNote>(initialNote);
  return (
    <>
      <AuctionBloodlineField
        value={value}
        onChange={setValue}
        note={note}
        onNoteChange={setNote}
        currentRootId={currentRootId}
        currentLabel={currentLabel}
      />
      <output aria-label="payload">{JSON.stringify(auctionPedigreePayload(Number(value) || null, note))}</output>
    </>
  );
}

describe("attachableOptionLabel (select 옵션 라벨 '이름 · 종 · (받음)')", () => {
  it("내가 보유한 혈통은 이름 · 종", () => {
    expect(attachableOptionLabel(attachable())).toBe("강산 라인 · 왕사슴벌레");
  });
  it("출처 카드를 받은 혈통은 끝에 (받음)", () => {
    expect(attachableOptionLabel(attachable({ relation: "received" }))).toBe("강산 라인 · 왕사슴벌레 · (받음)");
  });
  it("종이 없으면 종 자리를 건너뛴다", () => {
    expect(attachableOptionLabel(attachable({ speciesType: null }))).toBe("강산 라인");
    expect(attachableOptionLabel(attachable({ speciesType: " ", relation: "received" }))).toBe("강산 라인 · (받음)");
  });
});

describe("auctionPedigreePayload (등록·수정 payload.pedigreeNote)", () => {
  it("혈통이 없으면 칸 값과 상관없이 null", () => {
    expect(auctionPedigreePayload(null, { generation: "F3" })).toBeNull();
    expect(auctionPedigreePayload(null, { sireMm: 0 })).toBeNull();
  });
  it("칸이 비면 null, 값이 있으면 규칙대로 정리한 값", () => {
    expect(auctionPedigreePayload(5, {})).toBeNull();
    expect(auctionPedigreePayload(5, { sireMm: 81.2, generation: "F3" })).toEqual({ sireMm: 81.2, generation: "F3" });
  });
  it("규칙에 안 맞는 크기는 invalid", () => {
    expect(auctionPedigreePayload(5, { sireMm: 81.25 })).toBe("invalid");
    expect(auctionPedigreePayload(5, { damMm: 501 })).toBe("invalid");
    expect(auctionPedigreePayload(5, { damMm: Number.NaN })).toBe("invalid");
  });
});

describe("AuctionBloodlineField (등록·수정 혈통 select + 3칸)", () => {
  it("옵션은 ?mode=attach 의 attachable[] 이고, 라벨 '혈통'·안내 문구에 랭킹 언급이 없다", async () => {
    const { fetcher } = withSwr(
      <FieldHarness />,
      listResponse([attachable(), attachable({ rootId: 8, name: "솔밭 라인", relation: "received" })])
    );
    const select = screen.getByLabelText("혈통") as HTMLSelectElement;
    await waitFor(() => expect(within(select).getAllByRole("option")).toHaveLength(3));
    expect(fetcher).toHaveBeenCalledWith("/api/bloodline-cards?mode=attach");
    expect(within(select).getAllByRole("option").map((option) => option.textContent)).toEqual([
      "혈통 연결 안 함",
      "강산 라인 · 왕사슴벌레",
      "솔밭 라인 · 왕사슴벌레 · (받음)",
    ]);
    expect(screen.getByText(AUCTION_BLOODLINE_HELP)).toBeInTheDocument();
    expect(AUCTION_BLOODLINE_HELP).toBe("혈통을 연결하면 경매 상세에 혈통 정보가 보여요.");
    expect(screen.queryByText(/랭킹/)).not.toBeInTheDocument();
  });

  it("혈통을 고르기 전에는 3칸이 막혀 있고, 고르면 열린다", async () => {
    withSwr(<FieldHarness />, listResponse([attachable()]));
    const select = screen.getByLabelText("혈통") as HTMLSelectElement;
    await waitFor(() => expect(within(select).getAllByRole("option")).toHaveLength(2));
    expect(screen.getByLabelText("부 크기(mm)")).toBeDisabled();
    expect(screen.getByLabelText("누대")).toBeDisabled();

    fireEvent.change(select, { target: { value: "5" } });
    expect(screen.getByLabelText("부 크기(mm)")).not.toBeDisabled();
    fireEvent.change(screen.getByLabelText("부 크기(mm)"), { target: { value: "81.2" } });
    fireEvent.change(screen.getByLabelText("누대"), { target: { value: "F3" } });
    expect(JSON.parse(screen.getByLabelText("payload").textContent || "null")).toEqual({
      sireMm: 81.2,
      generation: "F3",
    });

    // 연결을 풀면 저장할 부모 정보도 없다(서버도 함께 지운다).
    fireEvent.change(select, { target: { value: "" } });
    expect(screen.getByLabelText("payload").textContent).toBe("null");
  });

  it("수정 화면에서 지금 연결된 혈통이 목록에 없으면(넘긴 뒤·숨김) 그 값을 옵션으로 남긴다", async () => {
    withSwr(
      <FieldHarness initialValue="9" currentRootId={9} currentLabel="예전 라인 · 장수풍뎅이" initialNote={{ generation: "F2" }} />,
      listResponse([attachable()])
    );
    const select = screen.getByLabelText("혈통") as HTMLSelectElement;
    await waitFor(() => expect(within(select).getAllByRole("option")).toHaveLength(3));
    expect(select.value).toBe("9");
    expect(within(select).getByRole("option", { name: "예전 라인 · 장수풍뎅이" })).toBeInTheDocument();
    expect((screen.getByLabelText("누대") as HTMLSelectElement).value).toBe("F2");
  });

  it("지금 연결된 혈통이 목록에 있으면 옵션을 한 번만 그린다", async () => {
    withSwr(
      <FieldHarness initialValue="5" currentRootId={5} currentLabel="강산 라인 · 왕사슴벌레" />,
      listResponse([attachable()])
    );
    const select = screen.getByLabelText("혈통") as HTMLSelectElement;
    await waitFor(() => expect(fetchedOptions(select)).toEqual(["혈통 연결 안 함", "강산 라인 · 왕사슴벌레"]));
    expect(select.value).toBe("5");
  });
});

const fetchedOptions = (select: HTMLSelectElement) =>
  within(select)
    .getAllByRole("option")
    .map((option) => option.textContent);

describe("낙찰자 출처 카드 보내기 제안 (PRD S-6.낙찰자 제안, AC-65)", () => {
  const base = {
    isOwner: true,
    status: "종료",
    winnerId: 9,
    winnerName: "도윤파파",
    bloodline: summary({ winnerReceived: false }),
  };

  it("판매자 + 종료 + 낙찰자 + 혈통 + winnerReceived === false 일 때만 보인다", () => {
    expect(shouldSuggestWinnerSend(base)).toBe(true);
    expect(shouldSuggestWinnerSend({ ...base, isOwner: false })).toBe(false);
    expect(shouldSuggestWinnerSend({ ...base, status: "진행중" })).toBe(false);
    expect(shouldSuggestWinnerSend({ ...base, winnerId: null })).toBe(false);
    expect(shouldSuggestWinnerSend({ ...base, bloodline: null })).toBe(false);
    expect(shouldSuggestWinnerSend({ ...base, bloodline: summary({ winnerReceived: true }) })).toBe(false);
    // 서버가 계산하지 않았으면(구 서버·판매자 아님) 그리지 않는다.
    expect(shouldSuggestWinnerSend({ ...base, bloodline: summary() })).toBe(false);
  });

  it("낙찰자가 탈퇴했거나 이름이 없으면 제안하지 않는다", () => {
    expect(shouldSuggestWinnerSend({ ...base, winnerName: "탈퇴한 사용자" })).toBe(false);
    expect(shouldSuggestWinnerSend({ ...base, winnerName: "탈퇴한 사용자#9" })).toBe(false);
    expect(shouldSuggestWinnerSend({ ...base, winnerName: "" })).toBe(false);
  });

  it("링크는 혈통 상세에 받는 사람·경매를 미리 채운다", () => {
    const href = winnerSendHref({ rootId: 5, winnerId: 9, winnerName: "도윤 파파", auctionId: 12 });
    const url = new URL(href, "https://bredy.app");
    expect(url.pathname).toBe("/bloodline-management/card/5");
    expect(url.searchParams.get("action")).toBe("send");
    expect(url.searchParams.get("toUserId")).toBe("9");
    expect(url.searchParams.get("toUserName")).toBe("도윤 파파");
    expect(url.searchParams.get("auctionId")).toBe("12");
  });

  it("문구는 '낙찰자 {닉네임}님에게 {이름} 출처 카드를 보낼까요?'", () => {
    expect(winnerSendText("도윤파파", "강산 라인")).toBe("낙찰자 도윤파파님에게 강산 라인 출처 카드를 보낼까요?");
  });
});

describe("AuctionBloodlineRows (경매 상세 혈통 행)", () => {
  it("혈통이 없으면(구 서버 포함) 아무것도 그리지 않는다", () => {
    const { container } = render(
      <AuctionBloodlineRows auctionId={12} bloodline={undefined} isOwner status="종료" winnerId={9} winnerName="도윤파파" />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("혈통 행은 뿌리 혈통 상세로 가고, 부모·누대 줄을 함께 그린다", () => {
    render(
      <AuctionBloodlineRows
        auctionId={12}
        bloodline={summary()}
        pedigreeNote={{ generation: "F3", sireMm: 81.2 }}
        isOwner={false}
        status="진행중"
      />
    );
    const row = screen.getByRole("link", { name: /강산 라인/ });
    expect(row).toHaveAttribute("href", "/bloodline-management/card/5");
    expect(screen.getByText("누대 F3 · 부 81.2mm · 분양자 입력")).toBeInTheDocument();
    expect(screen.queryByText(/출처 카드를 보낼까요/)).not.toBeInTheDocument();
  });

  it("판매자가 종료 경매를 열고 낙찰자가 아직 받지 않았으면 제안 행이 혈통 행 아래에 보인다", () => {
    render(
      <AuctionBloodlineRows
        auctionId={12}
        bloodline={summary({ winnerReceived: false })}
        isOwner
        status="종료"
        winnerId={9}
        winnerName="도윤파파"
      />
    );
    const links = screen.getAllByRole("link");
    expect(links).toHaveLength(2);
    expect(links[1]).toHaveTextContent("낙찰자 도윤파파님에게 강산 라인 출처 카드를 보낼까요?");
    const url = new URL(links[1].getAttribute("href") || "", "https://bredy.app");
    expect(url.pathname).toBe("/bloodline-management/card/5");
    expect(url.searchParams.get("toUserId")).toBe("9");
    expect(url.searchParams.get("auctionId")).toBe("12");
  });

  it("낙찰자가 이미 받았으면 제안 행이 없다", () => {
    render(
      <AuctionBloodlineRows
        auctionId={12}
        bloodline={summary({ winnerReceived: true })}
        isOwner
        status="종료"
        winnerId={9}
        winnerName="도윤파파"
      />
    );
    expect(screen.getAllByRole("link")).toHaveLength(1);
  });
});

describe("경매 혈통 오류 문구 (E-15)", () => {
  it("혈통 연결 오류는 새 권한 기준 문구", () => {
    expect(getAuctionErrorMessage("AUCTION_INVALID_BLOODLINE_ROOT")).toBe("연결할 혈통을 찾을 수 없어요");
    expect(getAuctionErrorMessage("AUCTION_BLOODLINE_FORBIDDEN")).toBe(
      "내가 보유했거나 출처 카드를 받은 혈통만 연결할 수 있어요"
    );
  });
  it("부모·누대 오류 코드도 문구가 있다", () => {
    expect(
      getAuctionResultMessage({ errorCode: "AUCTION_INVALID_PEDIGREE_NOTE", error: "x", status: 400 }, "f")
    ).toBe("부·모 크기와 누대를 다시 확인해 주세요");
    expect(
      getAuctionResultMessage({ errorCode: "AUCTION_PEDIGREE_WITHOUT_BLOODLINE", error: "x", status: 400 }, "f")
    ).toBe("혈통을 먼저 골라 주세요");
  });
});

describe("AC-67 · AC-38 대응: 경매 폼에 혈통 랭킹 안내가 남지 않는다", () => {
  const read = (relative: string) => fs.readFileSync(path.join(__dirname, "..", relative), "utf8");
  it.each([
    "app/(web)/auctions/create/CreateAuctionClient.tsx",
    "app/(web)/auctions/[id]/edit/EditAuctionClient.tsx",
    "app/(web)/auctions/AuctionBloodlineParts.tsx",
  ])("%s 에 '랭킹 집계' 문구가 없고 옛 목록 대신 attach 목록을 쓴다", (file) => {
    const source = read(file);
    expect(source).not.toMatch(/랭킹 집계/);
    expect(source).not.toMatch(/연결 혈통카드/);
    expect(source).not.toMatch(/myBloodlines/);
  });
});
