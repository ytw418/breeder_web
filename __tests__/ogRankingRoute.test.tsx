/** @jest-environment node */
import type { ReactElement } from "react";

const mockClient = {
  user: { findUnique: jest.fn() },
  auction: { findUnique: jest.fn() },
  bloodlineCard: { findUnique: jest.fn() },
};
jest.mock("@libs/server/client", () => ({
  __esModule: true,
  default: mockClient,
}));

const mockImageResponse = jest.fn();
jest.mock("next/og", () => ({
  ImageResponse: function ImageResponse(element: ReactElement) {
    mockImageResponse(element);
  },
}));

import { GET } from "../app/api/og/ranking/[type]/[id]/route";

/** 렌더 트리의 문자열 자식을 모두 모은다. */
function collectText(node: unknown): string[] {
  if (node == null || typeof node === "boolean") return [];
  if (typeof node === "string" || typeof node === "number") return [String(node)];
  if (Array.isArray(node)) return node.flatMap(collectText);
  const element = node as { props?: { children?: unknown } };
  return collectText(element.props?.children);
}

async function render(type: string, id: string) {
  await GET(new Request(`http://localhost/api/og/ranking/${type}/${id}`), {
    params: Promise.resolve({ type, id }),
  });
  return collectText(mockImageResponse.mock.calls[0][0]);
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("GET /api/og/ranking/breeder/[id]", () => {
  it("탈퇴한 브리더는 표시용 라벨로 그린다", async () => {
    mockClient.user.findUnique.mockResolvedValue({ name: "탈퇴한 사용자#12" });
    const texts = await render("breeder", "12");

    expect(texts).toContain("탈퇴한 사용자");
    expect(texts).not.toContain("탈퇴한 사용자#12");
  });

  it("일반 브리더 이름은 그대로, 없으면 기본 문구", async () => {
    mockClient.user.findUnique.mockResolvedValueOnce({ name: "브리디" });
    expect(await render("breeder", "3")).toContain("브리디");

    mockImageResponse.mockClear();
    mockClient.user.findUnique.mockResolvedValueOnce(null);
    expect(await render("breeder", "4")).toContain("브리더");
  });
});
