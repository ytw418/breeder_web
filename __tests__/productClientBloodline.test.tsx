import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { SWRConfig } from "swr";
import ProductClient from "@/app/(web)/products/[id]/ProductClient";
import type { ItemDetailResponse } from "@/pages/api/products/[id]";


jest.mock("hooks/useUser", () => ({ __esModule: true, default: () => ({ user: null, isLoading: false }) }), { virtual: true });
jest.mock("hooks/useBlocks", () => ({ __esModule: true, default: () => ({ isBlocked: () => false, unblock: jest.fn(), isPending: false }) }), { virtual: true });
jest.mock("hooks/useConfirmDialog", () => ({ __esModule: true, default: () => ({ confirm: jest.fn(), confirmDialog: null }) }), { virtual: true });
jest.mock(
  "hooks/useAdminModeration",
  () => ({ __esModule: true, default: () => ({ isAdmin: false, actionsFor: () => [], confirmDialog: null, pending: false }) }),
  { virtual: true }
);
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn(), refresh: jest.fn() }),
  useParams: () => ({ id: "11" }),
}));
jest.mock("@libs/client/authFetch", () => ({ authFetch: jest.fn(() => new Promise(() => undefined)) }));
jest.mock("@libs/client/analytics", () => ({ ANALYTICS_EVENTS: {}, trackEvent: jest.fn() }));
jest.mock("@components/features/MainLayout", () => ({
  __esModule: true,
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  toLoginHref: (next: string) => `/login?next=${encodeURIComponent(next)}`,
}));
jest.mock("@components/features/product/MarkdownPreview", () => ({ __esModule: true, default: () => null }));
jest.mock("@components/features/image/ImageLightbox", () => ({ __esModule: true, default: () => null }));
jest.mock("@components/app/ImageCarousel", () => ({ ImageCarousel: () => null }));
jest.mock("@components/app/moderation/ReportSheet", () => ({ ReportSheet: () => null }));
jest.mock("@components/app/moderation/BlockConfirmDialog", () => ({ BlockConfirmDialog: () => null }));


const baseProduct = {
  id: 11,
  name: "왕사슴 애벌레",
  price: 30000,
  description: "설명",
  photos: [],
  category: "사슴벌레",
  productType: "생물",
  status: "판매중",
  createdAt: "2026-10-01T00:00:00.000Z",
  viewCount: 3,
  user: { id: 7, name: "강산", avatar: null },
};

const renderDetail = (product: Record<string, unknown>) =>
  render(
    <SWRConfig value={{ provider: () => new Map(), fetcher: () => new Promise(() => undefined) }}>
      <ProductClient
        success
        product={product as unknown as ItemDetailResponse["product"]}
        relatedProducts={[]}
      />
    </SWRConfig>
  );

it("bloodline 이 있으면 판매자 행 바로 아래 혈통 행이 보이고 뿌리 혈통 상세로 간다", () => {
  renderDetail({
    ...baseProduct,
    bloodlineRootId: 5,
    pedigreeNote: { generation: "F3", sireMm: 81.2, damMm: 47.5 },
    bloodline: {
      id: 5,
      name: "강산 라인",
      speciesType: "왕사슴벌레",
      originLabel: "충남 공주",
      creator: { id: 7, name: "강산" },
      sellerRelation: "creator",
      receivedAt: null,
    },
  });
  const seller = screen.getByRole("link", { name: "강산 프로필 보기" });
  const row = screen.getByRole("link", { name: /강산 라인/ });
  expect(row).toHaveAttribute("href", "/bloodline-management/card/5");
  expect(row).toHaveTextContent("강산 라인 · 충남 공주");
  expect(row).toHaveTextContent("분양자가 만든 혈통");
  expect(row).toHaveTextContent("누대 F3 · 부 81.2mm · 모 47.5mm · 분양자 입력");
  expect(seller.nextElementSibling).toBe(row);
});

it("bloodline 이 null 이거나 없으면 혈통 행이 없다", () => {
  const { unmount } = renderDetail({ ...baseProduct, bloodlineRootId: 5, bloodline: null });
  expect(screen.queryByText("혈통")).toBeNull();
  unmount();
  renderDetail(baseProduct);
  expect(screen.queryByText("혈통")).toBeNull();
});
