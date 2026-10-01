import type { NextApiRequest, NextApiResponse } from "next";

const storedUser = {
  id: 1,
  snsId: "4242",
  provider: "kakao",
  phone: "010-0000-0000",
  email: "user@example.com",
  name: "브리더",
  avatar: null,
  _count: {
    followers: 0,
    following: 0,
    products: 0,
    posts: 0,
    Comments: 0,
    insectRecords: 0,
    receivedReviews: 0,
    createdBloodlineCards: 0,
    ownedBloodlineCards: 0,
  },
};
const mockClient = {
  user: { findUnique: jest.fn(() => Promise.resolve(storedUser)) },
  follow: { findFirst: jest.fn(() => Promise.resolve(null)) },
  userBadge: { findMany: jest.fn(() => Promise.resolve([])) },
};
jest.mock("@libs/server/client", () => ({
  __esModule: true,
  default: mockClient,
}));
jest.mock("@libs/server/auth", () => ({
  withAuth: (handler: unknown) => handler,
}));
jest.mock("@libs/server/breeder-programs", () => ({
  getActiveBreederProgramsByUserId: () => Promise.resolve([]),
  getSortedActiveBreederProgramSummaries: () => [],
}));

import handler from "../pages/api/users/[id]/index";

async function call(user?: NextApiRequest["user"]) {
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
    { method: "GET", headers: {}, query: { id: "1" }, body: {}, user } as unknown as NextApiRequest,
    res as unknown as NextApiResponse
  );
  return res;
}

describe("GET /api/users/[id] 공개 프로필", () => {
  it("다른 사람에게 snsId·전화번호·이메일을 주지 않는다", async () => {
    const res = await call();
    expect(res.statusCode).toBe(200);
    expect(res.body.user).not.toHaveProperty("snsId");
    expect(res.body.user.phone).toBeNull();
    expect(res.body.user.email).toBeNull();
  });

  it("본인에게도 snsId 는 주지 않는다", async () => {
    const res = await call({ id: 1 } as NextApiRequest["user"]);
    expect(res.body.user).not.toHaveProperty("snsId");
    expect(res.body.user.email).toBe("user@example.com");
  });
});
