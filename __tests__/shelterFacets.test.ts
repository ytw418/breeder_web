/**
 * GET /api/products/shelter-facets — 시/도·시·군·구·품종별 공고 수(많은 순). DB 는 모의다.
 */
import type { NextApiRequest, NextApiResponse } from "next";

const mockClient = { product: { groupBy: jest.fn() } };
jest.mock("@libs/server/client", () => ({ __esModule: true, default: mockClient }));
jest.mock("@libs/server/auth", () => ({ withAuth: (handler: unknown) => handler }));

import handler from "../pages/api/products/shelter-facets";

describe("GET /api/products/shelter-facets", () => {
  it("종과 시/도를 주면 시/도·시·군·구·품종을 많은 순으로 세고, 안 주면 해당 칸은 비운다", async () => {
    mockClient.product.groupBy.mockImplementation(async ({ by }: any) => {
      if (by[0] === "regionSido") return [
        { regionSido: "서울특별시", _count: { _all: 5 } },
        { regionSido: "경기도", _count: { _all: 9 } },
        { regionSido: null, _count: { _all: 1 } },
      ];
      if (by[0] === "regionSigungu") return [
        { regionSigungu: "화성시", _count: { _all: 4 } },
        { regionSigungu: "수원시", _count: { _all: 5 } },
      ];
      return [
        { externalBreed: "푸들", _count: { _all: 2 } },
        { externalBreed: "말티즈", _count: { _all: 7 } },
      ];
    });
    const call = async (query: Record<string, string>) => {
      const res: any = { headers: {}, setHeader: (k: string, v: string) => (res.headers[k.toLowerCase()] = v), json: (b: unknown) => ((res.body = b), res) };
      await handler({ method: "GET", headers: {}, query, body: {}, cookies: {} } as unknown as NextApiRequest, res as unknown as NextApiResponse);
      return res;
    };

    const res = await call({ category: "강아지", sido: "경기도" });
    expect(res.body).toEqual({
      success: true,
      total: 15,
      sido: [
        { name: "경기도", short: "경기", count: 9 },
        { name: "서울특별시", short: "서울", count: 5 },
      ],
      sigungu: [
        { name: "수원시", count: 5 },
        { name: "화성시", count: 4 },
      ],
      breed: [
        { name: "말티즈", count: 7 },
        { name: "푸들", count: 2 },
      ],
    });
    expect(res.headers["cache-control"]).toContain("s-maxage=300");
    expect(mockClient.product.groupBy.mock.calls[0][0].where).toMatchObject({ category: "강아지", isHidden: false, isDeleted: false });

    expect(await call({})).toMatchObject({ body: { sigungu: [], breed: [] } });
  });
});
