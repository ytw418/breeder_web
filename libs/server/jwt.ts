import { SignJWT, jwtVerify, type JWTPayload } from "jose";

/**
 * Bearer 토큰(access/refresh) 서명·검증 유틸.
 *
 * - access  : 짧은 수명(기본 30분). API 요청 시 Authorization 헤더로 전달.
 * - refresh : 긴 수명(기본 30일). access 만료 시 재발급에 사용.
 *
 * 사용자 선택에 따라 stateless JWT 방식이며 서버 DB에 토큰을 저장하지 않는다.
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
}

export interface AccessTokenPayload extends JWTPayload {
  type: "access";
  user: AuthUser;
}

export interface RefreshTokenPayload extends JWTPayload {
  type: "refresh";
  sub: string; // userId
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
 * access 토큰 발급. 유저 정보를 그대로 담아 라우트에서 추가 DB 조회 없이 사용한다.
 */
export async function signAccessToken(user: AuthUser): Promise<string> {
  const ttl = getTtlSeconds("access");
  return new SignJWT({ type: "access", user })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(user.id))
    .setIssuedAt()
    .setExpirationTime(`${ttl}s`)
    .sign(getSecret("access"));
}

/** refresh 토큰 발급. userId만 담는다. */
export async function signRefreshToken(userId: number): Promise<string> {
  const ttl = getTtlSeconds("refresh");
  return new SignJWT({ type: "refresh" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(userId))
    .setIssuedAt()
    .setExpirationTime(`${ttl}s`)
    .sign(getSecret("refresh"));
}

/** access/refresh 토큰을 한 번에 발급 */
export async function issueTokens(user: AuthUser): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}> {
  const [accessToken, refreshToken] = await Promise.all([
    signAccessToken(user),
    signRefreshToken(user.id),
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
