import type { NextApiRequest, NextApiResponse } from "next";
import { withDetailRevalidation } from "@libs/server/pageRevalidation";

const findUnique = jest.fn();
jest.mock("@libs/server/client", () => ({
  __esModule: true,
  default: { post: { findUnique: (...args: unknown[]) => findUnique(...args) } },
}));

const makeRes = () => {
  const order: string[] = [];
  type FakeRes = {
    statusCode: number;
    status: (code: number) => FakeRes;
    json: jest.Mock;
    revalidate: jest.Mock;
  };
  const res: FakeRes = {
    statusCode: 200,
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json: jest.fn(() => {
      order.push("json");
      return res;
    }),
    revalidate: jest.fn(async (path: string) => {
      order.push(`revalidate ${path}`);
    }),
  };
  return { res: res as unknown as NextApiResponse, raw: res, order };
};

describe("withDetailRevalidation", () => {
  const req = { method: "POST", query: { id: "7" } } as unknown as NextApiRequest;
  const wrap = (handler: (req: NextApiRequest, res: NextApiResponse) => unknown) =>
    withDetailRevalidation(handler, () => [{ type: "POST", id: 7 }]);

  it("글을 고치면 바뀌기 전·후 제목 주소를 다시 만든 뒤에 응답한다", async () => {
    findUnique.mockResolvedValueOnce({ title: "옛 제목" }).mockResolvedValueOnce({ title: "새 제목" });
    const { res, order } = makeRes();
    await wrap((_req, r) => r.json({ success: true }))(req, res);

    expect(order[order.length - 1]).toBe("json");
    expect(order).toEqual(
      expect.arrayContaining([
        `revalidate ${encodeURI("/posts/7-옛-제목")}`,
        `revalidate ${encodeURI("/posts/7-새-제목")}`,
        "revalidate /posts/7",
      ])
    );
  });

  it("실패한 요청은 다시 만들지 않고 그대로 응답한다", async () => {
    findUnique.mockResolvedValue({ title: "제목" });
    const { res, raw } = makeRes();
    const sendJson = raw.json;
    await wrap((_req, r) => r.status(403).json({ success: false }))(req, res);

    expect(raw.revalidate).not.toHaveBeenCalled();
    expect(sendJson).toHaveBeenCalledWith({ success: false });
  });
});
