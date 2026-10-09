import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { SWRConfig } from "swr";
import {
  ProductForm,
  buildProductBloodlineFields,
  type ProductFormInitial,
} from "@/app/(web)/products/_components/ProductForm";


const mockUseUser = jest.fn();
const mockAuthFetch = jest.fn();
jest.mock("hooks/useUser", () => ({ __esModule: true, default: () => mockUseUser() }), {
  virtual: true,
});
jest.mock(
  "hooks/useConfirmLeave",
  () => ({ useConfirmLeave: () => ({ leave: (fn: () => void) => fn(), dialog: null }) }),
  { virtual: true }
);
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn(), refresh: jest.fn() }),
}));
jest.mock("@libs/client/authFetch", () => ({
  authFetch: (...args: unknown[]) => mockAuthFetch(...args),
}));
jest.mock("@libs/client/toast", () => ({
  toast: { success: jest.fn(), error: jest.fn(), info: jest.fn() },
}));
jest.mock("@components/features/product/MarkdownEditor", () => ({
  __esModule: true,
  default: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <textarea aria-label="설명" value={value} onChange={(e) => onChange(e.target.value)} />
  ),
}));
jest.mock("@components/features/MainLayout", () => ({
  __esModule: true,
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  toLoginHref: (next: string) => `/login?next=${encodeURIComponent(next)}`,
}));


const attachable = [
  {
    rootId: 5,
    name: "강산 라인",
    speciesType: "왕사슴벌레",
    originLabel: "충남 공주",
    creator: { id: 7, name: "강산" },
    relation: "mine",
  },
  {
    rootId: 9,
    name: "백두 라인",
    speciesType: "넓적사슴벌레",
    originLabel: null,
    creator: { id: 3, name: "백두" },
    relation: "received",
    lineCardId: 31,
    receivedFrom: { id: 3, name: "백두" },
    receivedAt: "2026-09-11T16:30:00.000Z",
  },
];

const renderForm = (props: { product?: ProductFormInitial; initialFree?: boolean } = {}) =>
  render(
    <SWRConfig
      value={{
        provider: () => new Map(),
        dedupingInterval: 0,
        fetcher: async () => ({ success: true, attachable }),
      }}
    >
      <ProductForm {...props} />
    </SWRConfig>
  );

const editProduct = (over: Partial<ProductFormInitial> = {}): ProductFormInitial => ({
  id: 11,
  name: "왕사슴 애벌레",
  price: 30000,
  description: "건강한 3령 애벌레입니다. 직거래 가능합니다.",
  photos: ["photo-1"],
  category: "사슴벌레",
  productType: "생물",
  ...over,
});

const lastBody = () => {
  const call = mockAuthFetch.mock.calls[mockAuthFetch.mock.calls.length - 1];
  return JSON.parse(call[1].body);
};

beforeEach(() => {
  mockUseUser.mockReturnValue({ user: { id: 7 } });
  mockAuthFetch.mockReset();
  mockAuthFetch.mockResolvedValue({
    ok: true,
    json: async () => ({ success: true, product: { id: 11 } }),
  });
});

describe("buildProductBloodlineFields", () => {
  const base: Parameters<typeof buildProductBloodlineFields>[0] = {
    isEdit: false,
    productType: "생물",
    rootId: null,
    note: {},
    initialRootId: null,
    initialNote: {},
  };

  it("등록: 붙이지 않았거나 용품이면 혈통 키가 없다", () => {
    expect(buildProductBloodlineFields(base)).toEqual({});
    expect(buildProductBloodlineFields({ ...base, productType: "용품", rootId: 5 })).toEqual({});
  });

  it("등록: 붙이면 id 와 부모 정보(없으면 null)를 싣는다", () => {
    expect(buildProductBloodlineFields({ ...base, rootId: 5 })).toEqual({
      bloodlineRootId: 5,
      pedigreeNote: null,
    });
    expect(
      buildProductBloodlineFields({ ...base, rootId: 5, note: { generation: "F3" as const, sireMm: 81.2 } })
    ).toEqual({ bloodlineRootId: 5, pedigreeNote: { generation: "F3", sireMm: 81.2 } });
  });

  it("수정: 바뀐 게 없으면 키가 없고, 용품이면 null, 해제면 null", () => {
    const edit = { ...base, isEdit: true, rootId: 5, initialRootId: 5, note: { generation: "F3" as const }, initialNote: { generation: "F3" as const } };
    expect(buildProductBloodlineFields(edit)).toEqual({});
    expect(buildProductBloodlineFields({ ...edit, productType: "용품" })).toEqual({ bloodlineRootId: null });
    expect(buildProductBloodlineFields({ ...edit, rootId: null, note: {} })).toEqual({ bloodlineRootId: null });
    expect(buildProductBloodlineFields({ ...edit, note: { generation: "F4" as const } })).toEqual({
      bloodlineRootId: 5,
      pedigreeNote: { generation: "F4" },
    });
    expect(buildProductBloodlineFields({ ...edit, rootId: 9, note: {} })).toEqual({
      bloodlineRootId: 9,
      pedigreeNote: null,
    });
    // 회수·숨김돼 화면에 안 보이던 연결은 손대지 않는다
    expect(
      buildProductBloodlineFields({ ...base, isEdit: true, rootId: null, initialRootId: null })
    ).toEqual({});
  });
});

describe("ProductForm 혈통 행", () => {
  it("생물일 때만 '혈통 / 붙이기' 행이 보인다", () => {
    renderForm();
    expect(screen.queryByRole("button", { name: /혈통/ })).toBeNull();
    fireEvent.click(screen.getByRole("radio", { name: "생물" }));
    const row = screen.getByRole("button", { name: /혈통/ });
    expect(row).toHaveTextContent("혈통");
    expect(row).toHaveTextContent("붙이기");
    fireEvent.click(screen.getByRole("radio", { name: "용품" }));
    expect(screen.queryByRole("button", { name: /혈통/ })).toBeNull();
  });

  it("시트에서 고르고 3칸을 채워 붙이면 행 값이 바뀌고 수정 요청에 실린다", async () => {
    renderForm({ product: editProduct() });
    fireEvent.click(screen.getByRole("button", { name: /혈통/ }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(await within(dialog).findByRole("radio", { name: /강산 라인/ }));
    fireEvent.change(within(dialog).getByLabelText("부 크기(mm)"), { target: { value: "81.2" } });
    fireEvent.change(within(dialog).getByLabelText("누대"), { target: { value: "F3" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "붙이기" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(screen.getByRole("button", { name: /혈통/ })).toHaveTextContent("강산 라인 · F3 · 부 81.2mm");

    fireEvent.click(screen.getByRole("button", { name: "수정하기" }));
    await waitFor(() => expect(mockAuthFetch).toHaveBeenCalled());
    expect(lastBody().data).toMatchObject({ bloodlineRootId: 5, pedigreeNote: { sireMm: 81.2, generation: "F3" } });
  });

  it("수정 화면에서 아무것도 안 바꾸고 저장하면 혈통 키가 없다(혈통이 남는다)", async () => {
    renderForm({
      product: editProduct({ bloodlineRootId: 5, bloodlineName: "강산 라인", pedigreeNote: { generation: "F3" as const } }),
    });
    expect(screen.getByRole("button", { name: /혈통/ })).toHaveTextContent("강산 라인 · F3");
    fireEvent.click(screen.getByRole("button", { name: "수정하기" }));
    await waitFor(() => expect(mockAuthFetch).toHaveBeenCalled());
    const data = lastBody().data;
    expect(data).not.toHaveProperty("bloodlineRootId");
    expect(data).not.toHaveProperty("pedigreeNote");
  });

  it("수정 화면에서 용품으로 바꾸면 bloodlineRootId: null 이 실린다", async () => {
    renderForm({ product: editProduct({ bloodlineRootId: 5, bloodlineName: "강산 라인" }) });
    fireEvent.click(screen.getByRole("radio", { name: "용품" }));
    fireEvent.click(screen.getByRole("button", { name: "수정하기" }));
    await waitFor(() => expect(mockAuthFetch).toHaveBeenCalled());
    expect(lastBody().data.bloodlineRootId).toBeNull();
    expect(lastBody().data).not.toHaveProperty("pedigreeNote");
  });

  it("붙인 혈통이 붙이기 목록에 없어도(그 뒤 넘김) '지금 연결된 혈통'으로 남아 부모·누대를 고칠 수 있다", async () => {
    // 혈통 77 은 판매자가 붙인 뒤 다른 분에게 넘겨 attachable 에 없다
    renderForm({
      product: editProduct({
        bloodlineRootId: 77,
        bloodlineName: "한라 라인",
        pedigreeNote: { generation: "F2" as const },
        bloodlineSummary: {
          id: 77,
          name: "한라 라인",
          speciesType: "왕사슴벌레",
          originLabel: "제주",
          creator: { id: 7, name: "강산" },
          sellerRelation: "none",
          receivedAt: null,
        },
      }),
    });
    fireEvent.click(screen.getByRole("button", { name: /혈통/ }));
    const dialog = await screen.findByRole("dialog");
    expect(await within(dialog).findByText("지금 연결된 혈통")).toBeInTheDocument();
    const current = within(dialog).getByRole("radio", { name: /한라 라인/ });
    expect(current).toHaveAttribute("aria-checked", "true");
    // 3칸이 열려 있고 '붙이기'가 보인다(예전에는 '연결 안 함'만 남았다)
    const generation = within(dialog).getByLabelText("누대");
    expect(generation).not.toBeDisabled();
    fireEvent.change(generation, { target: { value: "F3" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "붙이기" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(screen.getByRole("button", { name: /혈통/ })).toHaveTextContent("한라 라인 · F3");

    fireEvent.click(screen.getByRole("button", { name: "수정하기" }));
    await waitFor(() => expect(mockAuthFetch).toHaveBeenCalled());
    // 같은 혈통 id 와 바뀐 부모 정보를 싣는다(서버는 같은 id 면 권한을 다시 보지 않는다)
    expect(lastBody().data).toMatchObject({ bloodlineRootId: 77, pedigreeNote: { generation: "F3" } });
  });

  it("'연결 안 함' 을 누르면 행이 '붙이기' 로 돌아가고 해제가 실린다", async () => {
    renderForm({ product: editProduct({ bloodlineRootId: 5, bloodlineName: "강산 라인" }) });
    fireEvent.click(screen.getByRole("button", { name: /혈통/ }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "연결 안 함" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(screen.getByRole("button", { name: /혈통/ })).toHaveTextContent("붙이기");
    fireEvent.click(screen.getByRole("button", { name: "수정하기" }));
    await waitFor(() => expect(mockAuthFetch).toHaveBeenCalled());
    expect(lastBody().data.bloodlineRootId).toBeNull();
  });
});

describe("ProductForm 등록 요청", () => {
  const fillRequired = (type: "생물" | "용품") => {
    fireEvent.change(screen.getByLabelText("제목"), { target: { value: "왕사슴 애벌레" } });
    fireEvent.click(screen.getByRole("button", { name: "곤충" }));
    fireEvent.click(screen.getByRole("radio", { name: type }));
    fireEvent.change(screen.getByLabelText("가격"), { target: { value: "30000" } });
    fireEvent.change(screen.getByLabelText("설명"), {
      target: { value: "건강한 3령 애벌레입니다. 직거래 가능합니다." },
    });
  };

  it("생물에 혈통을 붙여 등록하면 id 와 부모 정보가 실린다", async () => {
    renderForm();
    fillRequired("생물");
    fireEvent.click(screen.getByRole("button", { name: /혈통/ }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(await within(dialog).findByRole("radio", { name: /백두 라인/ }));
    fireEvent.change(within(dialog).getByLabelText("모 크기(mm)"), { target: { value: "47.5" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "붙이기" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    fireEvent.click(screen.getByRole("button", { name: "분양 등록하기" }));
    await waitFor(() => expect(mockAuthFetch).toHaveBeenCalled());
    expect(mockAuthFetch.mock.calls[0][0]).toBe("/api/products");
    expect(lastBody()).toMatchObject({ productType: "생물", bloodlineRootId: 9, pedigreeNote: { damMm: 47.5 } });
  });

  it("혈통을 붙였다가 용품으로 바꿔 등록하면 혈통 값이 없다", async () => {
    renderForm();
    fillRequired("생물");
    fireEvent.click(screen.getByRole("button", { name: /혈통/ }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.click(await within(dialog).findByRole("radio", { name: /강산 라인/ }));
    fireEvent.click(within(dialog).getByRole("button", { name: "붙이기" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    fireEvent.click(screen.getByRole("radio", { name: "용품" }));
    fireEvent.click(screen.getByRole("button", { name: "분양 등록하기" }));
    await waitFor(() => expect(mockAuthFetch).toHaveBeenCalled());
    expect(lastBody()).not.toHaveProperty("bloodlineRootId");
    expect(lastBody()).not.toHaveProperty("pedigreeNote");
  });
});
