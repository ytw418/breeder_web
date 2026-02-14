import { Prisma } from "@prisma/client";

interface BloodlineApiError {
  status: number;
  message: string;
}

const TABLE_NOT_READY_MESSAGE =
  "혈통카드 기능 준비가 아직 완료되지 않았습니다. 잠시 후 다시 시도하거나 관리자에게 DB 마이그레이션 적용을 요청해주세요.";

export function resolveBloodlineApiError(
  error: unknown,
  fallbackMessage: string
): BloodlineApiError {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case "P2002":
        return {
          status: 409,
          message: "대표 혈통카드는 유저당 1개만 생성할 수 있습니다.",
        };
      case "P2021":
        return {
          status: 503,
          message: TABLE_NOT_READY_MESSAGE,
        };
      case "P2025":
        return {
          status: 404,
          message: "요청한 혈통카드 데이터를 찾을 수 없습니다.",
        };
      case "P2003":
        return {
          status: 400,
          message: "혈통카드 데이터 연결이 올바르지 않습니다. 다시 시도해주세요.",
        };
      default:
        return {
          status: 500,
          message: fallbackMessage,
        };
    }
  }

  if (error instanceof Error) {
    const normalized = error.message.toLowerCase();
    if (
      normalized.includes("bloodlinecard") ||
      normalized.includes("bloodlinecardtransfer")
    ) {
      return {
        status: 503,
        message: TABLE_NOT_READY_MESSAGE,
      };
    }
  }

  return {
    status: 500,
    message: fallbackMessage,
  };
}
