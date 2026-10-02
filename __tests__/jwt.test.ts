/** @jest-environment node */
import { SignJWT } from "jose";

import {
  issueTokens,
  signAccessToken,
  signRefreshToken,
  toAuthUser,
  verifyAccessToken,
  verifyRefreshToken,
  type AuthUser,
} from "@libs/server/jwt";

const COOKIE_PASSWORD = "jest-cookie-password-0123456789-abcdefghij";

const authUser: AuthUser = {
  id: 7,
  snsId: "kakao-7",
  provider: "kakao",
  phone: null,
  email: "seven@bredy.app",
  name: "브리더",
  avatar: null,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-02-01T00:00:00.000Z"),
};

beforeAll(() => {
  process.env.COOKIE_PASSWORD = COOKIE_PASSWORD;
  delete process.env.JWT_ACCESS_SECRET;
  delete process.env.JWT_REFRESH_SECRET;
});

/** tv 클레임이 생기기 전 방식으로 서명한 토큰 */
const legacySecret = (type: "access" | "refresh") =>
  new TextEncoder().encode(`${COOKIE_PASSWORD}:${type}`);

describe("jwt tokenVersion(tv) 클레임", () => {
  it("issueTokens 는 access/refresh 둘 다 tv 를 담는다", async () => {
    const tokens = await issueTokens(authUser, 3);

    const access = await verifyAccessToken(tokens.accessToken);
    const refresh = await verifyRefreshToken(tokens.refreshToken);

    expect(access?.tv).toBe(3);
    expect(access?.user.id).toBe(7);
    expect(refresh?.tv).toBe(3);
    expect(refresh?.sub).toBe("7");
    expect(tokens.expiresIn).toBeGreaterThan(0);
  });

  it("tv=0 도 클레임으로 남는다", async () => {
    const access = await verifyAccessToken(await signAccessToken(authUser, 0));
    const refresh = await verifyRefreshToken(await signRefreshToken(7, 0));
    expect(access?.tv).toBe(0);
    expect(refresh?.tv).toBe(0);
  });

  it("tv 가 없는 기존 토큰도 검증되고 tv 는 undefined 다", async () => {
    const legacyAccess = await new SignJWT({ type: "access", user: authUser })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("7")
      .setIssuedAt()
      .setExpirationTime("60s")
      .sign(legacySecret("access"));
    const legacyRefresh = await new SignJWT({ type: "refresh" })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("7")
      .setIssuedAt()
      .setExpirationTime("60s")
      .sign(legacySecret("refresh"));

    const access = await verifyAccessToken(legacyAccess);
    const refresh = await verifyRefreshToken(legacyRefresh);
    expect(access?.user.id).toBe(7);
    expect(access?.tv).toBeUndefined();
    expect(refresh?.sub).toBe("7");
    expect(refresh?.tv).toBeUndefined();
  });

  it("access 와 refresh 토큰은 서로 바꿔 쓸 수 없다", async () => {
    const tokens = await issueTokens(authUser, 1);
    expect(await verifyAccessToken(tokens.refreshToken)).toBeNull();
    expect(await verifyRefreshToken(tokens.accessToken)).toBeNull();
  });
});

describe("toAuthUser", () => {
  it("토큰에 담을 필드만 남기고 status·role·tokenVersion 등은 뺀다", () => {
    const row = {
      ...authUser,
      role: "ADMIN",
      status: "ACTIVE",
      tokenVersion: 4,
      suspendedUntil: null,
      deletedAt: null,
    };
    const result = toAuthUser(row);
    expect(result).toEqual(authUser);
    expect(result).not.toHaveProperty("status");
    expect(result).not.toHaveProperty("role");
    expect(result).not.toHaveProperty("tokenVersion");
    expect(result).not.toHaveProperty("suspendedUntil");
  });
});
