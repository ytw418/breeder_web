import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import type { User, role } from "@prisma/client";

/**
 * Bearer 토큰(access/refresh) 서명·검증 유틸.
 *
 * - access  : 짧은 수명(기본 30분). API 요청 시 Authorization 헤더로 전달.
 * - refresh : 긴 수명(기본 30일). access 만료 시 재발급에 사용.
 *
 * 사용자 선택에 따라 stateless JWT 방식이며 서버 DB에 토큰을 저장하지 않는다.
 * 대신 두 토큰 모두 User.tokenVersion 을 tv 클레임으로 담고, 정지·차단·탈퇴 시
 * tokenVersion 을 올려 모든 기기의 토큰을 한 번에 무효화한다(withAuth·refresh 에서 비교).
 */

export type TokenType = "access" | "refresh";

/** access 토큰에 담는 유저 정보 (기존 세션 user와 동일 형태) */
export interface AuthUser {
  id: number;
  snsId: string;
  provider: string;
  phone: string | null;
  email: string | null;
  name: string;
  avatar: string | null;
  createdAt: Date;
  updatedAt: Date;
  /** 토큰에는 없고 withAuth 가 DB 에서 채운다(관리자 판별용). */
  role?: role;
}

export interface AccessTokenPayload extends JWTPayload {
  type: "access";
  user: AuthUser;
  /** 발급 시점의 User.tokenVersion. 없으면(구 토큰) 0 으로 본다. */
  tv?: number;
}

export interface RefreshTokenPayload extends JWTPayload {
  type: "refresh";
  sub: string; // userId
  /** 발급 시점의 User.tokenVersion. 없으면(구 토큰) 0 으로 본다. */
  tv?: number;
}

/** prisma User 에서 토큰/응답에 담을 필드만 추린다(status·role·tokenVersion 등은 담지 않는다). */
export function toAuthUser(
  user: Pick<
    User,
    | "id"
    | "snsId"
    | "provider"
    | "phone"
    | "email"
    | "name"
    | "avatar"
    | "createdAt"
    | "updatedAt"
  >
): AuthUser {
  return {
    id: user.id,
    snsId: user.snsId,
    provider: user.provider,
    phone: user.phone,
    email: user.email,
    name: user.name,
    avatar: user.avatar,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

function getSecret(type: TokenType): Uint8Array {
  // 전용 시크릿(JWT_ACCESS_SECRET/JWT_REFRESH_SECRET)이 있으면 우선 사용하고,
  // 없으면 세션 비밀번호(COOKIE_PASSWORD)를 재사용한다. 별도 env 설정 없이
  // 동작하도록 하되, COOKIE_PASSWORD 재사용 시에는 type별로 키를 분리 파생해
  // access/refresh 토큰 혼용을 차단한다.
  const dedicated =
    type === "access"
      ? process.env.JWT_ACCESS_SECRET
      : process.env.JWT_REFRESH_SECRET;

  const base = dedicated || process.env.COOKIE_PASSWORD;

  if (!base) {
    throw new Error(
      "JWT 서명용 시크릿이 없습니다. COOKIE_PASSWORD(또는 JWT_ACCESS_SECRET/JWT_REFRESH_SECRET) 환경변수를 설정하세요."
    );
  }

  // 전용 시크릿은 그대로, 공용(COOKIE_PASSWORD) 재사용 시에는 type 접미사로 분리
  const material = dedicated ? base : `${base}:${type}`;
  return new TextEncoder().encode(material);
}

function getTtlSeconds(type: TokenType): number {
  if (type === "access") {
    return Number(process.env.JWT_ACCESS_TTL) || 60 * 30; // 30분
  }
  return Number(process.env.JWT_REFRESH_TTL) || 60 * 60 * 24 * 30; // 30일
}

/** access 토큰 만료(초) — 클라이언트 응답에 함께 내려주기 위함 */
export const ACCESS_TOKEN_TTL_SECONDS = getTtlSeconds("access");

/**
 * access 토큰 발급. 유저 정보를 담아 라우트에서 프로필 조회 없이 사용한다.
 * tv(tokenVersion) 는 withAuth 가 DB 값과 비교해 정지·차단·탈퇴된 토큰을 막는 데 쓴다.
 */
export async function signAccessToken(
  user: AuthUser,
  tokenVersion: number
): Promise<string> {
  const ttl = getTtlSeconds("access");
  return new SignJWT({ type: "access", user, tv: tokenVersion })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(user.id))
    .setIssuedAt()
    .setExpirationTime(`${ttl}s`)
    .sign(getSecret("access"));
}

/** refresh 토큰 발급. userId 와 tv(tokenVersion) 만 담는다. */
export async function signRefreshToken(
  userId: number,
  tokenVersion: number
): Promise<string> {
  const ttl = getTtlSeconds("refresh");
  return new SignJWT({ type: "refresh", tv: tokenVersion })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(userId))
    .setIssuedAt()
    .setExpirationTime(`${ttl}s`)
    .sign(getSecret("refresh"));
}

/** access/refresh 토큰을 한 번에 발급. tokenVersion 은 발급 시점의 User.tokenVersion. */
export async function issueTokens(
  user: AuthUser,
  tokenVersion: number
): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}> {
  const [accessToken, refreshToken] = await Promise.all([
    signAccessToken(user, tokenVersion),
    signRefreshToken(user.id, tokenVersion),
  ]);
  return { accessToken, refreshToken, expiresIn: getTtlSeconds("access") };
}

/** access 토큰 검증. 실패 시 null */
export async function verifyAccessToken(
  token: string
): Promise<AccessTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret("access"), {
      algorithms: ["HS256"],
    });
    if (payload.type !== "access" || !payload.user) return null;
    return payload as AccessTokenPayload;
  } catch {
    return null;
  }
}

/** refresh 토큰 검증. 실패 시 null */
export async function verifyRefreshToken(
  token: string
): Promise<RefreshTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret("refresh"), {
      algorithms: ["HS256"],
    });
    if (payload.type !== "refresh" || !payload.sub) return null;
    return payload as RefreshTokenPayload;
  } catch {
    return null;
  }
}

/** "Bearer xxx" 형태의 Authorization 헤더에서 토큰만 추출 */
export function extractBearerToken(
  authorization: string | undefined | null
): string | null {
  if (!authorization) return null;
  const [scheme, token] = authorization.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) return null;
  return token.trim();
}
