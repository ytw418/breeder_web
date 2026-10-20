import type { NextApiRequest, NextApiResponse } from "next";

/**
 * GET /api/landing-pages/[slug] — 관리자가 아직 올리지 않은 이용 규칙은 서버 기본본을 준다(2026-10-21).
 * 없으면 앱·웹 '이용 규칙'·'운영정책 보기'·'자세히' 링크가 '페이지를 찾을 수 없습니다'로 갔다.
 */

const mockFindFirst = jest.fn();
jest.mock("@libs/server/client", () => ({
  __esModule: true,
  default: { landingPage: { findFirst: (...args: unknown[]) => mockFindFirst(...args) } },
}));
jest.mock("@libs/server/auth", () => ({
  withAuth: (handler: unknown) => handler,
}));

import handler from "../pages/api/landing-pages/[slug]";

async function call(slug: string) {
  const res = {
    statusCode: 200,
    body: undefined as any,
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json(payload: unknown) {
      res.body = payload;
      return res;
    },
  };
  await handler(
    { method: "GET", headers: {}, query: { slug } } as unknown as NextApiRequest,
    res as unknown as NextApiResponse
  );
  return res;
}

it("관리자 랜딩 페이지가 없으면 이용 규칙은 기본본, 다른 slug 는 404", async () => {
  mockFindFirst.mockResolvedValue(null);

  const rules = await call("community-rules");
  expect(rules.statusCode).toBe(200);
  expect(rules.body.page).toEqual(
    expect.objectContaining({ slug: "community-rules", title: "브리디 이용 규칙", isPublished: true })
  );
  expect(rules.body.page.content).toContain("분양·경매에 올릴 수 없는 개체");

  const other = await call("no-such-page");
  expect(other.statusCode).toBe(404);
});
