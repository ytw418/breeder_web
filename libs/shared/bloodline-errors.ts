/**
 * 혈통 API 오류 코드(설계 §3.0, PRD 부록 A-2). 서버는 모든 혈통 오류 응답에 `errorCode` 를 싣고,
 * 클라이언트(웹·앱)는 `errorCode` 로 문구를 고르며 모르는 코드면 서버 `error` 문자열을 그대로 보여 준다.
 * 앱은 이 표를 그대로 복사해 쓴다(문구를 바꾸면 앱도 같이 바꾼다).
 */

export const BLOODLINE_ERROR_CODES = [
  "BLOODLINE_AUTH_REQUIRED",
  "BLOODLINE_NOT_FOUND",
  "BLOODLINE_INVALID_NAME",
  "BLOODLINE_DUPLICATE_NAME",
  "BLOODLINE_SPECIES_REQUIRED",
  "BLOODLINE_INVALID_SPECIES",
  "BLOODLINE_IMAGE_REQUIRED",
  "BLOODLINE_INVALID_ORIGIN",
  "BLOODLINE_RECEIVER_REQUIRED",
  "BLOODLINE_RECEIVER_NOT_FOUND",
  "BLOODLINE_RECEIVER_INACTIVE",
  "BLOODLINE_RECEIVER_SELF",
  "BLOODLINE_BLOCKED",
  "BLOODLINE_FORBIDDEN",
  "BLOODLINE_ALREADY_SENT",
  "BLOODLINE_CONFLICT",
  "BLOODLINE_REVOKED",
  // 아래 둘은 설계 표 밖이다. 5xx 응답에도 errorCode 를 싣기 위해 둔다(AC-80).
  "BLOODLINE_UNAVAILABLE",
  "BLOODLINE_SERVER_ERROR",
] as const;

export type BloodlineErrorCode = (typeof BLOODLINE_ERROR_CODES)[number];

export interface BloodlineErrorSpec {
  status: number;
  message: string;
}

export const BLOODLINE_ERRORS: Record<BloodlineErrorCode, BloodlineErrorSpec> = {
  BLOODLINE_AUTH_REQUIRED: { status: 401, message: "로그인이 필요해요" },
  BLOODLINE_NOT_FOUND: { status: 404, message: "혈통을 찾을 수 없어요" },
  BLOODLINE_INVALID_NAME: { status: 400, message: "이름은 한글·영문·숫자·띄어쓰기로 2~40자예요" },
  BLOODLINE_DUPLICATE_NAME: { status: 409, message: "이미 사용 중인 이름이에요" },
  BLOODLINE_SPECIES_REQUIRED: { status: 400, message: "종을 골라 주세요" },
  BLOODLINE_INVALID_SPECIES: { status: 400, message: "고를 수 없는 종이에요" },
  BLOODLINE_IMAGE_REQUIRED: { status: 400, message: "대표 사진 1장이 필요해요" },
  BLOODLINE_INVALID_ORIGIN: { status: 400, message: "알 수 없는 지역이에요" },
  BLOODLINE_RECEIVER_REQUIRED: { status: 400, message: "받는 분을 골라 주세요" },
  BLOODLINE_RECEIVER_NOT_FOUND: { status: 404, message: "받는 분 닉네임을 찾을 수 없어요" },
  BLOODLINE_RECEIVER_INACTIVE: { status: 400, message: "지금은 카드를 받을 수 없는 분이에요" },
  BLOODLINE_RECEIVER_SELF: { status: 400, message: "나에게는 보낼 수 없어요" },
  BLOODLINE_BLOCKED: { status: 403, message: "보낼 수 없는 분이에요" },
  BLOODLINE_FORBIDDEN: { status: 403, message: "지금 보유한 분만 할 수 있어요" },
  BLOODLINE_ALREADY_SENT: { status: 409, message: "이미 받은 분이에요" },
  BLOODLINE_CONFLICT: { status: 409, message: "잠시 후 다시 시도해 주세요" },
  BLOODLINE_REVOKED: { status: 404, message: "운영 정책으로 회수된 혈통이에요" },
  BLOODLINE_UNAVAILABLE: { status: 503, message: "지금은 혈통 기능을 쓸 수 없어요. 잠시 후 다시 시도해 주세요" },
  BLOODLINE_SERVER_ERROR: { status: 500, message: "잠시 후 다시 시도해 주세요" },
};

/** 구 클라이언트(앱 create.tsx·웹 BloodlineCardCreateClient)가 문자열로 매칭하던 중복 이름 문구. */
export const BLOODLINE_LEGACY_DUPLICATE_NAME_MESSAGE = "이미 사용 중인 혈통 카드 이름입니다.";

export const isBloodlineErrorCode = (value: unknown): value is BloodlineErrorCode =>
  typeof value === "string" && Object.prototype.hasOwnProperty.call(BLOODLINE_ERRORS, value);

/** 5xx 코드는 서버가 상황별 문구("혈통을 만들지 못했어요" 등)를 함께 주므로 그 문구를 먼저 쓴다. */
const SERVER_MESSAGE_FIRST: ReadonlySet<BloodlineErrorCode> = new Set<BloodlineErrorCode>([
  "BLOODLINE_UNAVAILABLE",
  "BLOODLINE_SERVER_ERROR",
]);

/**
 * 클라이언트 표시 문구: 아는 코드면 표의 문구, 모르면 서버가 준 문구, 그것도 없으면 기본 문구.
 */
export function bloodlineErrorMessage(code?: string | null, serverMessage?: string | null): string {
  const server = serverMessage && serverMessage.trim() ? serverMessage : null;
  if (isBloodlineErrorCode(code)) {
    if (SERVER_MESSAGE_FIRST.has(code) && server) return server;
    return BLOODLINE_ERRORS[code].message;
  }
  return server ?? BLOODLINE_ERRORS.BLOODLINE_SERVER_ERROR.message;
}
