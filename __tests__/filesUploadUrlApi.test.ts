import type { NextApiRequest, NextApiResponse } from "next";

/**
 * GET /api/files — Cloudflare direct_upload 일시 오류에 한 번 더 받아 본다.
 * 회귀: 첫 업로드에서 '이미지 업로드 URL을 가져오지 못했습니다'가 나고 다시 누르면 되던 문제(2026-10-21).
 */

jest.mock("@libs/server/auth", () => ({
  withAuth: (handler: unknown) => handler,
}));

import filesHandler from "../pages/api/files";

const fetchMock = global.fetch as jest.Mock;

function createRes() {
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
  return res;
}

async function call() {
  const res = createRes();
  await filesHandler(
    { method: "GET", headers: {}, query: {}, user: { id: 1 } } as unknown as NextApiRequest,
    res as unknown as NextApiResponse
  );
  return res;
}

const cloudflare = (status: number, body: unknown) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
});

beforeEach(() => {
  fetchMock.mockReset();
  jest.spyOn(console, "error").mockImplementation(() => undefined);
});

describe("GET /api/files", () => {
  it("Cloudflare 가 첫 시도에 실패하면 한 번 더 받아 업로드 URL 을 준다", async () => {
    fetchMock
      .mockResolvedValueOnce(cloudflare(500, { success: false, errors: [{ code: 5000 }] }))
      .mockResolvedValueOnce(
        cloudflare(200, { success: true, result: { id: "img-1", uploadURL: "https://upload.example/img-1" } })
      );

    const res = await call();

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ success: true, id: "img-1", uploadURL: "https://upload.example/img-1" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("두 번 다 실패하면 502", async () => {
    fetchMock.mockRejectedValue(new Error("fetch failed"));

    const res = await call();

    expect(res.statusCode).toBe(502);
    expect(res.body).toEqual({ success: false, error: "이미지 업로드 URL을 가져오지 못했습니다." });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
