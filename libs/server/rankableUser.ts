import type { Prisma } from "@prisma/client";
import { ADMIN_EMAIL_ID_PREFIX } from "@libs/shared/adminEmail";

/** 운영 계정 role. 크루(FAKE_USER)·관리자(ADMIN·SUPER_USER). */
export const OPERATOR_ROLES = ["FAKE_USER", "ADMIN", "SUPER_USER"] as const;

/**
 * 랭킹·칭호·TOP 브리더·배지·인기글 집계에 넣을 사용자.
 * 운영 계정(위 role, 관리자 이메일 ytw418*)과 테스트 계정(provider test_user)은 뺀다 —
 * 운영 글이 상위 자리를 차지하면 회원들이 재미없다(2026-10-16 사용자 결정). 홈 찬반 토론 카드는 운영 큐레이션이라 이 조건을 쓰지 않는다.
 */
export const RANKABLE_USER_WHERE: Prisma.UserWhereInput = {
  status: "ACTIVE",
  role: { notIn: [...OPERATOR_ROLES] },
  provider: { not: "test_user" },
  // 이메일이 없는 회원은 남기고, 관리자 이메일만 뺀다(NOT 만 쓰면 이메일 null 행도 빠진다).
  AND: [{ OR: [{ email: null }, { NOT: { email: { startsWith: ADMIN_EMAIL_ID_PREFIX } } }] }],
};
