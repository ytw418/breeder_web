import { useState, type ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { SWRConfig } from "swr";

const mockUseUser = jest.fn();
// jest 설정에 hooks/ 별칭이 없어 가상 모듈로 막는다.
jest.mock(
  "hooks/useUser",
  () => ({ __esModule: true, default: () => mockUseUser() }),
  { virtual: true }
);
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn() }),
}));
// BloodlineScreenParts 가 toLoginHref 를 가져온다. 무거운 셸은 막는다.
jest.mock("@components/features/MainLayout", () => ({
  __esModule: true,
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  toLoginHref: (next: string) => `/login?next=${encodeURIComponent(next)}`,
}));

import {
  BloodlineLinkRow,
  bloodlineLinkRelationText,
  bloodlinePedigreeLine,
  formatBloodlineMonthDay,
} from "@components/features/bloodline/BloodlineLinkRow";
import {
  PEDIGREE_MM_ERROR_MESSAGE,
  PedigreeNoteFields,
  readPedigreeNoteInput,
  sanitizePedigreeMmInput,
} from "@components/features/bloodline/PedigreeNoteFields";
import {
  BLOODLINE_ATTACH_HELP,
  BloodlineAttachSheet,
  attachableSubtitle,
  formatBloodlineAttachValue,
  type BloodlineAttachValue,
} from "@components/features/bloodline/BloodlineAttachSheet";
import type { AttachableBloodline, BloodlineLinkSummary } from "@libs/shared/bloodline-card";
import { PEDIGREE_GENERATION_HELP, type PedigreeNote } from "@libs/shared/pedigree-note";

const summary = (over: Partial<BloodlineLinkSummary> = {}): BloodlineLinkSummary => ({
  id: 5,
  name: "강산 라인",
  speciesType: "왕사슴벌레",
  originLabel: "충남 공주",
  creator: { id: 7, name: "강산" },
  sellerRelation: "creator",
  receivedAt: null,
  ...over,
});

describe("BloodlineLinkRow (상품·경매 상세 혈통 행)", () => {
  it("만든 사람이 판매자면 이름 · 산지, 관계, 부모·누대 3줄을 그리고 뿌리 혈통 상세로 간다", () => {
    render(
      <BloodlineLinkRow
        bloodline={summary()}
        pedigreeNote={{ generation: "F3", sireMm: 81.2, damMm: 47.5 }}
      />
    );
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/bloodline-management/card/5");
    expect(link).toHaveTextContent("혈통");
    expect(link).toHaveTextContent("강산 라인 · 충남 공주");
    expect(screen.getByText("판매자가 만든 혈통")).toBeInTheDocument();
    expect(screen.getByText("누대 F3 · 부 81.2mm · 모 47.5mm · 판매자 입력")).toBeInTheDocument();
  });

  it("출처 카드를 받은 판매자는 받은 날(한국 시간 MM.DD)을, 그 외는 만든 사람 혈통만 보인다", () => {
    expect(
      bloodlineLinkRelationText(
        summary({ sellerRelation: "received", receivedAt: "2026-09-11T16:30:00.000Z" })
      )
    ).toBe("강산님 혈통 · 판매자가 09.12 출처 카드 받음");
    expect(bloodlineLinkRelationText(summary({ sellerRelation: "received", receivedAt: null }))).toBe(
      "강산님 혈통 · 판매자가 출처 카드 받음"
    );
    expect(bloodlineLinkRelationText(summary({ sellerRelation: "holder" }))).toBe("강산님 혈통");
    expect(bloodlineLinkRelationText(summary({ sellerRelation: "none" }))).toBe("강산님 혈통");
    expect(formatBloodlineMonthDay("nope")).toBe("");
  });

  it("산지·부모 정보가 없으면 그 부분을 그리지 않고, 저장값이 규칙에 안 맞아도 줄을 생략한다", () => {
    const { container } = render(
      <BloodlineLinkRow bloodline={summary({ originLabel: null, sellerRelation: "holder" })} pedigreeNote={null} />
    );
    expect(container.textContent).toBe("혈통강산 라인강산님 혈통");
    expect(bloodlinePedigreeLine({ sireMm: 0 })).toBeNull();
    expect(bloodlinePedigreeLine({})).toBeNull();
    expect(bloodlinePedigreeLine({ sireMm: "81.2" })).toBe("부 81.2mm · 판매자 입력");
  });

  it("미리보기와 href null 은 링크를 걸지 않는다", () => {
    const { rerender } = render(<BloodlineLinkRow bloodline={summary()} preview />);
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByTestId("bloodline-link-preview")).toBeInTheDocument();
    rerender(<BloodlineLinkRow bloodline={summary()} href={null} />);
    expect(screen.queryByRole("link")).toBeNull();
  });
});

function FieldsHarness({ initial = {}, disabled }: { initial?: PedigreeNote; disabled?: boolean }) {
  const [note, setNote] = useState<PedigreeNote>(initial);
  const read = readPedigreeNoteInput(note);
  return (
    <>
      <PedigreeNoteFields value={note} onChange={setNote} disabled={disabled} />
      <output aria-label="note">{JSON.stringify(note)}</output>
      <output aria-label="read">{read === "invalid" ? "invalid" : JSON.stringify(read)}</output>
    </>
  );
}

describe("PedigreeNoteFields (부·모·누대 3칸)", () => {
  const sire = () => screen.getByLabelText("부 크기(mm)") as HTMLInputElement;
  const dam = () => screen.getByLabelText("모 크기(mm)") as HTMLInputElement;
  const generation = () => screen.getByLabelText("누대") as HTMLSelectElement;
  const read = () => screen.getByLabelText("read").textContent;

  it("81.25·0·501 은 danger 오류를 보이고, 81.2·47.5·F3 은 통과한다", () => {
    render(<FieldsHarness />);
    expect(screen.getByText("부모·누대 (선택)")).toBeInTheDocument();
    expect(screen.getByText(PEDIGREE_GENERATION_HELP)).toBeInTheDocument();
    expect(read()).toBe("null");

    for (const bad of ["81.25", "0", "501"]) {
      fireEvent.change(sire(), { target: { value: bad } });
      expect(sire().value).toBe(bad);
      expect(sire()).toHaveAttribute("aria-invalid", "true");
      expect(screen.getByRole("alert")).toHaveTextContent(PEDIGREE_MM_ERROR_MESSAGE);
      expect(read()).toBe("invalid");
    }

    fireEvent.change(sire(), { target: { value: "81.2" } });
    fireEvent.change(dam(), { target: { value: "47.5" } });
    fireEvent.change(generation(), { target: { value: "F3" } });
    expect(sire()).not.toHaveAttribute("aria-invalid");
    expect(screen.queryByRole("alert")).toBeNull();
    expect(JSON.parse(read() ?? "")).toEqual({ sireMm: 81.2, damMm: 47.5, generation: "F3" });
  });

  it("입력 중인 소수점은 칸에 남기고, 숫자·소수점 하나만 받는다. 비우면 키를 없앤다", () => {
    render(<FieldsHarness initial={{ sireMm: 80, generation: "unknown" }} />);
    expect(sire().value).toBe("80");
    expect(generation().value).toBe("unknown");
    expect(generation()).toHaveTextContent("모름");

    fireEvent.change(sire(), { target: { value: "81." } });
    expect(sire().value).toBe("81.");
    expect(JSON.parse(screen.getByLabelText("note").textContent ?? "")).toEqual({
      sireMm: 81,
      generation: "unknown",
    });

    fireEvent.change(sire(), { target: { value: "" } });
    fireEvent.change(generation(), { target: { value: "" } });
    expect(screen.getByLabelText("note").textContent).toBe("{}");
    expect(sanitizePedigreeMmInput("8a1,5.2")).toBe("81.52");
  });

  it("disabled 면 3칸을 막고 오류를 보이지 않는다", () => {
    render(<FieldsHarness initial={{ sireMm: 0 }} disabled />);
    expect(sire()).toBeDisabled();
    expect(dam()).toBeDisabled();
    expect(generation()).toBeDisabled();
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

const mineItem: AttachableBloodline = {
  rootId: 1,
  name: "강산 라인",
  speciesType: "왕사슴벌레",
  originLabel: "충남 공주",
  creator: { id: 7, name: "강산" },
  relation: "mine",
};

const receivedItem: AttachableBloodline = {
  rootId: 2,
  name: "오닉스 라인",
  speciesType: "헤라클레스",
  originLabel: null,
  creator: { id: 9, name: "박도윤" },
  relation: "received",
  lineCardId: 20,
  receivedFrom: { id: 11, name: "도윤파파" },
  receivedAt: "2026-09-12T03:00:00.000Z",
};

const swrFetcher = jest.fn();

function renderSheet(value: BloodlineAttachValue = { rootId: null, note: {} }, open = true) {
  const onApply = jest.fn();
  const onClose = jest.fn();
  const utils = render(
    <SWRConfig value={{ provider: () => new Map(), fetcher: swrFetcher, dedupingInterval: 0 }}>
      <BloodlineAttachSheet open={open} onClose={onClose} value={value} onApply={onApply} />
    </SWRConfig>
  );
  return { ...utils, onApply, onClose };
}

const applyButton = () => screen.queryByRole("button", { name: "붙이기" });

describe("BloodlineAttachSheet (혈통 붙이기 시트)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseUser.mockReturnValue({ user: { id: 7 }, isLoading: false });
    swrFetcher.mockResolvedValue({ success: true, attachable: [mineItem, receivedItem] });
  });

  it("닫혀 있으면 아무것도 그리지 않고 부르지도 않는다", () => {
    renderSheet(undefined, false);
    expect(screen.queryByText("혈통 붙이기")).toBeNull();
    expect(swrFetcher).not.toHaveBeenCalled();
  });

  it("두 그룹 라디오 행을 그리고, 고르기 전에는 3칸과 붙이기를 막는다", async () => {
    renderSheet();
    expect(screen.getByRole("heading", { name: "혈통 붙이기" })).toBeInTheDocument();
    expect(screen.getByText(BLOODLINE_ATTACH_HELP)).toBeInTheDocument();
    expect(screen.getByTestId("bloodline-attach-skeleton")).toBeInTheDocument();
    expect(swrFetcher).toHaveBeenCalledWith("/api/bloodline-cards?mode=attach");

    await screen.findByText("강산 라인");
    expect(screen.getByText("내가 만든 혈통")).toBeInTheDocument();
    expect(screen.getByText("받은 출처 카드")).toBeInTheDocument();
    expect(screen.getByText("헤라클레스 · 도윤파파님에게서 받음")).toBeInTheDocument();
    expect(screen.getAllByRole("radio")).toHaveLength(2);
    expect(applyButton()).toBeDisabled();
    expect(screen.getByLabelText("부 크기(mm)")).toBeDisabled();
    expect(screen.queryByText("상세에 이렇게 보여요")).toBeNull();
    expect(screen.queryByRole("button", { name: "연결 안 함" })).toBeNull();
  });

  it("받은 출처 카드를 고르고 3칸을 채우면 미리보기가 상세 행과 같고, 붙이기로 정리된 값을 넘긴다", async () => {
    const { onApply } = renderSheet();
    fireEvent.click(await screen.findByRole("radio", { name: /오닉스 라인/ }));
    expect(screen.getByRole("radio", { name: /오닉스 라인/ })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByText("상세에 이렇게 보여요")).toBeInTheDocument();
    expect(screen.getByText("박도윤님 혈통 · 판매자가 09.12 출처 카드 받음")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("부 크기(mm)"), { target: { value: "81.25" } });
    expect(applyButton()).toBeDisabled();

    fireEvent.change(screen.getByLabelText("부 크기(mm)"), { target: { value: "81.2" } });
    fireEvent.change(screen.getByLabelText("모 크기(mm)"), { target: { value: "47.5" } });
    fireEvent.change(screen.getByLabelText("누대"), { target: { value: "F3" } });
    expect(screen.getByText("누대 F3 · 부 81.2mm · 모 47.5mm · 판매자 입력")).toBeInTheDocument();
    expect(applyButton()).toBeEnabled();

    fireEvent.click(applyButton()!);
    expect(onApply).toHaveBeenCalledWith({
      rootId: 2,
      note: { sireMm: 81.2, damMm: 47.5, generation: "F3" },
      bloodline: receivedItem,
    });
  });

  it("내가 만든 혈통을 고르면 미리보기 관계가 '판매자가 만든 혈통'이다", async () => {
    const { onApply } = renderSheet();
    fireEvent.click(await screen.findByRole("radio", { name: /강산 라인/ }));
    expect(screen.getByText("판매자가 만든 혈통")).toBeInTheDocument();
    fireEvent.click(applyButton()!);
    expect(onApply).toHaveBeenCalledWith({ rootId: 1, note: {}, bloodline: mineItem });
  });

  it("만든 혈통이 없으면 만들기 행, 받은 출처 카드가 없으면 그 그룹을 그리지 않는다", async () => {
    swrFetcher.mockResolvedValue({ success: true, attachable: [] });
    renderSheet();
    const create = await screen.findByRole("link", { name: /아직 만든 혈통이 없어요/ });
    expect(create).toHaveAttribute("href", "/bloodline-cards/create");
    expect(create).toHaveTextContent("혈통 만들기");
    expect(screen.queryByText("받은 출처 카드")).toBeNull();
    expect(applyButton()).toBeDisabled();
  });

  it("이미 붙였으면 '연결 안 함'이 보이고, 고른 행을 다시 누르면 선택이 풀려 '연결 안 함'만 남는다", async () => {
    const { onApply } = renderSheet({ rootId: 1, note: { generation: "F2" } });
    const row = await screen.findByRole("radio", { name: /강산 라인/ });
    expect(row).toHaveAttribute("aria-checked", "true");
    expect((screen.getByLabelText("누대") as HTMLSelectElement).value).toBe("F2");
    expect(screen.getByRole("button", { name: "연결 안 함" })).toBeInTheDocument();
    expect(applyButton()).toBeEnabled();

    fireEvent.click(row);
    expect(row).toHaveAttribute("aria-checked", "false");
    expect(applyButton()).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "연결 안 함" }));
    expect(onApply).toHaveBeenCalledWith({ rootId: null, note: {}, bloodline: null });
  });

  it("조회에 실패하면 '불러오지 못했어요'와 다시 시도를 보인다", async () => {
    swrFetcher.mockRejectedValueOnce(new Error("boom"));
    renderSheet();
    expect(await screen.findByText("불러오지 못했어요")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }));
    await screen.findByText("강산 라인");
    await waitFor(() => expect(swrFetcher).toHaveBeenCalledTimes(2));
  });
});

describe("붙이기 표시 문자열", () => {
  it("행 부제와 등록 폼 값", () => {
    expect(attachableSubtitle(mineItem)).toBe("왕사슴벌레");
    expect(attachableSubtitle({ ...receivedItem, receivedFrom: undefined, speciesType: null })).toBe(
      "박도윤님에게서 받음"
    );
    expect(formatBloodlineAttachValue("강산 라인", { generation: "F3", sireMm: 81.2 })).toBe(
      "강산 라인 · F3 · 부 81.2mm"
    );
    expect(formatBloodlineAttachValue("강산 라인", {})).toBe("강산 라인");
  });
});
