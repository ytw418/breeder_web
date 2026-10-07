/**
 * @jest-environment node
 */
import type { NextApiRequest, NextApiResponse } from "next";

const mockClient = {
  user: { findUnique: jest.fn(), update: jest.fn() },
};
jest.mock("@libs/server/client", () => ({
  __esModule: true,
  default: mockClient,
}));
jest.mock("@libs/server/auth", () => ({
  withAuth: (handler: unknown) => handler,
}));
jest.mock("@libs/server/adminAccess", () => ({
  hasAdminAccess: jest.fn().mockResolvedValue(false),
}));

import meHandler from "../pages/api/users/me/index";

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

const me = { id: 7, name: "브리디" } as NextApiRequest["user"];

async function save(body: Record<string, unknown>) {
  const res = createRes();
  await meHandler(
    { method: "POST", headers: {}, query: {}, body, user: me } as NextApiRequest,
    res as unknown as NextApiResponse
  );
  return res;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockClient.user.update.mockResolvedValue({});
});

describe("POST /api/users/me 내 동네", () => {
  it("목록에 있는 시/도·시/군/구 조합이면 regionUpdatedAt 과 함께 저장한다", async () => {
    const res = await save({ regionSido: "서울특별시", regionSigungu: "강남구" });
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ success: true });
    expect(mockClient.user.update).toHaveBeenCalledTimes(1);
    const { data } = mockClient.user.update.mock.calls[0][0];
    expect(data).toMatchObject({ regionSido: "서울특별시", regionSigungu: "강남구" });
    expect(data.regionUpdatedAt).toBeInstanceOf(Date);
  });

  it("목록에 없는 조합이면 400 INVALID_REGION 이고 저장하지 않는다", async () => {
    const res = await save({ regionSido: "서울특별시", regionSigungu: "해운대구" });
    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({ success: false, errorCode: "INVALID_REGION" });
    expect(mockClient.user.update).not.toHaveBeenCalled();
  });

  it("둘 다 null 이면 동네를 지우고 노출도 끈다", async () => {
    const res = await save({ regionSido: null, regionSigungu: null, regionVisible: true });
    expect(res.body).toEqual({ success: true });
    expect(mockClient.user.update).toHaveBeenCalledTimes(1);
    expect(mockClient.user.update.mock.calls[0][0].data).toMatchObject({
      regionSido: null,
      regionSigungu: null,
      regionVisible: false,
    });
  });

  it("동네 없이 regionVisible:true 만 보내면 400 REGION_REQUIRED", async () => {
    mockClient.user.findUnique.mockResolvedValue({ regionSigungu: null });
    const res = await save({ regionVisible: true });
    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({ success: false, errorCode: "REGION_REQUIRED" });
    expect(mockClient.user.update).not.toHaveBeenCalled();
  });

  it("동네가 있으면 regionVisible 을 저장한다", async () => {
    mockClient.user.findUnique.mockResolvedValue({ regionSigungu: "강남구" });
    const res = await save({ regionVisible: true });
    expect(res.body).toEqual({ success: true });
    expect(mockClient.user.update).toHaveBeenCalledWith({
      where: { id: 7 },
      data: { regionVisible: true },
    });
  });

  it("동네와 regionVisible:true 를 함께 보내면 DB 조회 없이 둘 다 저장한다", async () => {
    const res = await save({
      regionSido: "경기도",
      regionSigungu: "수원시",
      regionVisible: true,
    });
    expect(res.body).toEqual({ success: true });
    expect(mockClient.user.findUnique).not.toHaveBeenCalled();
    expect(mockClient.user.update).toHaveBeenCalledTimes(2);
  });

  it("regionVisible:false 는 동네가 없어도 저장한다", async () => {
    const res = await save({ regionVisible: false });
    expect(res.body).toEqual({ success: true });
    expect(mockClient.user.findUnique).not.toHaveBeenCalled();
    expect(mockClient.user.update).toHaveBeenCalledWith({
      where: { id: 7 },
      data: { regionVisible: false },
    });
  });
});
