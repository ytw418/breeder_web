import type { NextApiResponse } from "next";
import { Prisma } from "@prisma/client";
import {
  BLOODLINE_ERRORS,
  type BloodlineErrorCode,
} from "@libs/shared/bloodline-errors";

/**
 * 혈통 API 오류 → { status, message, errorCode }. 모든 혈통 오류 응답은 `errorCode` 를 싣는다
 * (libs/shared/bloodline-errors.ts). 응답은 sendBloodlineError 로 보낸다.
 */
export interface BloodlineApiError {
  status: number;
  message: string;
  errorCode: BloodlineErrorCode;
}

const fromCode = (errorCode: BloodlineErrorCode, message?: string): BloodlineApiError => ({
  status: BLOODLINE_ERRORS[errorCode].status,
  message: message ?? BLOODLINE_ERRORS[errorCode].message,
  errorCode,
});

/** Postgres 오류 코드: 42P01 relation(테이블) 없음, 42703 column 없음. raw 쿼리(P2010)에서 meta.code 로 온다. */
const MISSING_RELATION_PG_CODES = new Set(["42P01", "42703"]);

/**
 * 테이블·컬럼이 없는 오류만 "준비 중(503)" 으로 본다. 마이그레이션 전에 코드가 먼저 배포된 경우다.
 * (예전에는 메시지에 bloodlinecard 가 들어가기만 해도 503 으로 바꿔 Prisma 검증 오류 같은 진짜 오류를 가렸다.)
 */
const isMissingSchemaError = (error: Prisma.PrismaClientKnownRequestError) => {
  if (error.code === "P2021" || error.code === "P2022") return true;
  if (error.code === "P2010") {
    const pgCode = error.meta?.code;
    return typeof pgCode === "string" && MISSING_RELATION_PG_CODES.has(pgCode);
  }
  return false;
};

export function resolveBloodlineApiError(error: unknown, fallbackMessage: string): BloodlineApiError {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (isMissingSchemaError(error)) return fromCode("BLOODLINE_UNAVAILABLE");
    switch (error.code) {
      // 직렬화 충돌(P2034)·쓰기 충돌(P2032 계열)·유니크 경합(P2002)은 다시 시도하면 된다
      case "P2034":
      case "P2032":
      case "P2002":
        return fromCode("BLOODLINE_CONFLICT");
      case "P2025":
        return fromCode("BLOODLINE_NOT_FOUND");
      default:
        break;
    }
  }
  return fromCode("BLOODLINE_SERVER_ERROR", fallbackMessage);
}

export interface SendBloodlineErrorOptions {
  /** 표의 문구 대신 쓸 문구 */
  message?: string;
  /** 응답 타입이 요구하는 나머지 필드(예: 상세 { card: null, bloodlineSourceCard: null, parentLineCard: null }) */
  body?: Record<string, unknown>;
}

/** `{ success: false, ...body, error, errorCode }` 를 코드의 HTTP 상태로 보낸다. */
export function sendBloodlineError(
  res: NextApiResponse,
  errorCode: BloodlineErrorCode,
  options: SendBloodlineErrorOptions = {}
) {
  const spec = BLOODLINE_ERRORS[errorCode];
  return res.status(spec.status).json({
    success: false,
    ...options.body,
    error: options.message ?? spec.message,
    errorCode,
  });
}

/** catch 블록용: 오류를 분류해 그대로 보낸다. 로그는 호출처에서 남긴다. */
export function sendResolvedBloodlineError(
  res: NextApiResponse,
  error: unknown,
  fallbackMessage: string,
  body?: Record<string, unknown>
) {
  const resolved = resolveBloodlineApiError(error, fallbackMessage);
  return sendBloodlineError(res, resolved.errorCode, { message: resolved.message, body });
}
