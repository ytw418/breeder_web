/**
 * @jest-environment node
 */

/**
 * 혈통 서버 기반: 소유 판정(libs/server/bloodline-ownership — currentOwnerId 한 곳),
 * 보유자 거울 테이블 갱신, 오류 분류·응답(libs/server/bloodline-error).
 */
import { Prisma } from "@prisma/client";
import type { NextApiResponse } from "next";

const mockClient = {
  bloodlineCard: { findFirst: jest.fn(), findMany: jest.fn() },
  bloodlineCardOwner: { deleteMany: jest.fn(), create: jest.fn(), createMany: jest.fn() },
  $queryRaw: jest.fn(),
  $executeRaw: jest.fn(),
  $executeRawUnsafe: jest.fn(),
};
jest.mock("@libs/server/client", () => ({
  __esModule: true,
  default: mockClient,
}));

import {
  addCardOwner,
  fetchOwnedCardIds,
  isCardOwner,
  replaceCardOwner,
} from "@libs/server/bloodline-ownership";
import { resolveBloodlineApiError, sendBloodlineError } from "@libs/server/bloodline-error";

const knownError = (code: string, meta?: Record<string, unknown>) =>
  new Prisma.PrismaClientKnownRequestError(`prisma ${code}`, { code, clientVersion: "6.6.0", meta });

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

beforeEach(() => {
  jest.clearAllMocks();
});

describe("혈통 소유 판정", () => {
  it("소유 판정은 currentOwnerId 만 본다", async () => {
    mockClient.bloodlineCard.findFirst.mockResolvedValueOnce({ id: 3 });
    await expect(isCardOwner(3, 7)).resolves.toBe(true);
    expect(mockClient.bloodlineCard.findFirst).toHaveBeenCalledWith({
      where: { id: 3, currentOwnerId: 7 },
      select: { id: true },
    });

    // 이전 보유자(Owner 테이블에만 남은 사람)는 보유자가 아니다
    mockClient.bloodlineCard.findFirst.mockResolvedValueOnce(null);
    await expect(isCardOwner(3, 8)).resolves.toBe(false);

    mockClient.bloodlineCard.findMany.mockResolvedValueOnce([{ id: 1 }, { id: 2 }]);
    const owned = await fetchOwnedCardIds(7);
    expect(Array.from(owned).sort()).toEqual([1, 2]);
    expect(mockClient.bloodlineCard.findMany).toHaveBeenCalledWith({
      where: { currentOwnerId: 7 },
      select: { id: true },
    });

    expect(mockClient.$queryRaw).not.toHaveBeenCalled();
    expect(mockClient.$executeRaw).not.toHaveBeenCalled();
  });

  it("replaceCardOwner 는 지우고 한 행을 넣는다", async () => {
    const tx = {
      bloodlineCardOwner: { deleteMany: jest.fn(), create: jest.fn() },
    };
    await replaceCardOwner(tx as unknown as Prisma.TransactionClient, 5, 9);
    expect(tx.bloodlineCardOwner.deleteMany).toHaveBeenCalledWith({ where: { bloodlineCardId: 5 } });
    expect(tx.bloodlineCardOwner.create).toHaveBeenCalledTimes(1);
    expect(tx.bloodlineCardOwner.create).toHaveBeenCalledWith({
      data: { bloodlineCardId: 5, userId: 9 },
    });
    expect(tx.bloodlineCardOwner.deleteMany.mock.invocationCallOrder[0]).toBeLessThan(
      tx.bloodlineCardOwner.create.mock.invocationCallOrder[0]
    );
  });

  it("addCardOwner 는 이미 있으면 건너뛰고 한 행만 넣는다(생성용)", async () => {
    await addCardOwner(mockClient as unknown as Prisma.TransactionClient, 4, 7);
    expect(mockClient.bloodlineCardOwner.createMany).toHaveBeenCalledWith({
      data: [{ bloodlineCardId: 4, userId: 7 }],
      skipDuplicates: true,
    });
    expect(mockClient.bloodlineCardOwner.deleteMany).not.toHaveBeenCalled();
  });
});

describe("혈통 API 오류 분류", () => {
  it("P2021 만 503 으로 분류한다", () => {
    expect(resolveBloodlineApiError(knownError("P2021"), "실패")).toMatchObject({
      status: 503,
      errorCode: "BLOODLINE_UNAVAILABLE",
    });
    // 컬럼 없음(마이그레이션 전 코드 배포)과 raw 쿼리의 relation/column 없음도 같은 분류
    expect(resolveBloodlineApiError(knownError("P2022"), "실패").status).toBe(503);
    expect(resolveBloodlineApiError(knownError("P2010", { code: "42P01" }), "실패").status).toBe(503);

    // 메시지에 bloodlinecard 가 들어 있어도 일반 오류는 503 이 아니다
    const validation = new Error("Invalid `prisma.bloodlineCard.create()` invocation: Argument `name` is missing.");
    expect(resolveBloodlineApiError(validation, "혈통을 만들지 못했어요")).toEqual({
      status: 500,
      message: "혈통을 만들지 못했어요",
      errorCode: "BLOODLINE_SERVER_ERROR",
    });
    expect(resolveBloodlineApiError(knownError("P2010", { code: "23505" }), "실패").status).toBe(500);
    expect(resolveBloodlineApiError("문자열 오류", "실패").status).toBe(500);
  });

  it("직렬화 충돌·중복은 409 BLOODLINE_CONFLICT, 레코드 없음은 404", () => {
    for (const code of ["P2034", "P2032", "P2002"]) {
      expect(resolveBloodlineApiError(knownError(code), "실패")).toEqual({
        status: 409,
        message: "잠시 후 다시 시도해 주세요",
        errorCode: "BLOODLINE_CONFLICT",
      });
    }
    expect(resolveBloodlineApiError(knownError("P2025"), "실패")).toEqual({
      status: 404,
      message: "혈통을 찾을 수 없어요",
      errorCode: "BLOODLINE_NOT_FOUND",
    });
  });

  it("sendBloodlineError 는 코드의 상태·문구와 errorCode 를 싣는다", () => {
    const res = createRes();
    sendBloodlineError(res as unknown as NextApiResponse, "BLOODLINE_ALREADY_SENT");
    expect(res.statusCode).toBe(409);
    expect(res.body).toEqual({
      success: false,
      error: "이미 받은 분이에요",
      errorCode: "BLOODLINE_ALREADY_SENT",
    });

    const detail = createRes();
    sendBloodlineError(detail as unknown as NextApiResponse, "BLOODLINE_REVOKED", {
      body: { card: null, bloodlineSourceCard: null, parentLineCard: null },
    });
    expect(detail.statusCode).toBe(404);
    expect(detail.body).toEqual({
      success: false,
      card: null,
      bloodlineSourceCard: null,
      parentLineCard: null,
      error: "운영 정책으로 회수된 혈통이에요",
      errorCode: "BLOODLINE_REVOKED",
    });

    const custom = createRes();
    sendBloodlineError(custom as unknown as NextApiResponse, "BLOODLINE_DUPLICATE_NAME", {
      message: "이미 사용 중인 혈통 카드 이름입니다.",
    });
    expect(custom.statusCode).toBe(409);
    expect(custom.body).toMatchObject({
      error: "이미 사용 중인 혈통 카드 이름입니다.",
      errorCode: "BLOODLINE_DUPLICATE_NAME",
    });
  });
});
