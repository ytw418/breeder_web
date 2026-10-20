/**
 * 작성 제한(2026-10-21 감사 24번): 가입 7일 미만은 분양글+경매 하루 3개, 운영자는 제외.
 */
const mockClient = {
  user: { findUnique: jest.fn() },
  product: { count: jest.fn() },
  auction: { count: jest.fn() },
  message: { count: jest.fn() },
  chatRoomMember: { count: jest.fn() },
};
jest.mock("@libs/server/client", () => ({ __esModule: true, default: mockClient }));

import { assertWriteAllowed, WRITE_LIMIT_DAILY_MESSAGE } from "@libs/server/writeLimits";

const DAY_MS = 24 * 60 * 60 * 1000;

describe("assertWriteAllowed", () => {
  it("가입 1일 계정의 오늘 4번째 분양글은 429, 운영자 이메일은 통과", async () => {
    mockClient.product.count.mockResolvedValue(2);
    mockClient.auction.count.mockResolvedValue(1);

    mockClient.user.findUnique.mockResolvedValueOnce({
      id: 500,
      email: null,
      createdAt: new Date(Date.now() - DAY_MS),
    });
    await expect(assertWriteAllowed({ userId: 500, kind: "product", text: "레오파드게코 분양" })).resolves.toEqual({
      status: 429,
      error: WRITE_LIMIT_DAILY_MESSAGE,
      errorCode: "WRITE_LIMIT_DAILY",
    });

    mockClient.user.findUnique.mockResolvedValueOnce({
      id: 1,
      email: "ytw418@gmail.com",
      createdAt: new Date(Date.now() - DAY_MS),
    });
    await expect(assertWriteAllowed({ userId: 1, kind: "product", text: "레오파드게코 분양" })).resolves.toBeNull();
  });
});
