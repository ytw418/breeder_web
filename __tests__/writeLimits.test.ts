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

import {
  assertWriteAllowed,
  WRITE_LIMIT_DAILY_MESSAGE,
  WRITE_LIMIT_DUPLICATE_MESSAGE,
} from "@libs/server/writeLimits";

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

  it("분양글 카드가 새로 들어가는 메시지 본문만 같은 본문 한도에서 빼고, 카드 행은 세지 않는다", async () => {
    mockClient.message.count.mockResolvedValue(3);
    mockClient.user.findUnique.mockResolvedValue({ id: 500, email: null });
    const text = "아직 분양 중인가요?";

    await expect(assertWriteAllowed({ userId: 500, kind: "message", text, withNewProductCard: true })).resolves.toBeNull();
    expect(mockClient.message.count).not.toHaveBeenCalled();

    await expect(assertWriteAllowed({ userId: 500, kind: "message", text })).resolves.toMatchObject({
      error: WRITE_LIMIT_DUPLICATE_MESSAGE,
    });
    expect(mockClient.message.count.mock.calls[0][0].where.productId).toBeNull();
  });
});
