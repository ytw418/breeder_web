import client from "@libs/server/client";
import { isAdminEmail } from "@libs/shared/adminEmail";
import { isReservedUserName } from "@libs/shared/deletedUser";
import {
  NICKNAME_TAKEN_MESSAGE,
  validateNickname,
  type NicknameRejectCode,
} from "@libs/shared/nickname";

/** 닉네임을 쓰고 있는 유저 id. 아무도 안 쓰면 null */
async function findNameOwnerId(name: string): Promise<number | null> {
  const row = await client.user.findUnique({
    where: { name },
    select: { id: true },
  });
  return row?.id ?? null;
}

/** 아무도 안 쓰거나 본인의 현재 닉네임이면 사용 가능 */
export async function isNicknameAvailable(name: string, selfId: number): Promise<boolean> {
  const ownerId = await findNameOwnerId(name);
  return ownerId === null || ownerId === selfId;
}

/** 검사와 저장 사이에 같은 이름이 먼저 저장돼 User.name unique 를 어긴 경우 */
export function isUniqueNameError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const { code, meta } = error as { code?: unknown; meta?: { target?: unknown } };
  if (code !== "P2002") return false;
  const target = meta?.target;
  if (Array.isArray(target)) return target.includes("name");
  return typeof target === "string" && target.includes("name");
}

export type NicknameCheckResult =
  | { available: true; name: string; /** 본인의 현재 닉네임과 같음(저장 생략 가능) */ isCurrent: boolean }
  | { available: false; code: NicknameRejectCode; reason: string };

/**
 * 형식 검사 → 중복 검사. 빈 값·길이 오류면 DB 를 조회하지 않는다.
 * viewerEmail: 바꾸는 사람의 이메일. 운영자 이메일 계정은 운영자 낱말(브리디·운영 등)을 쓸 수 있다.
 * 예약어·금칙어에 걸려도 이미 내 닉네임이면 그대로 둔다 — 규칙이 생기기 전에 정한 이름으로도 프로필(소개 등)을 저장할 수 있게.
 */
export async function checkNickname(
  raw: unknown,
  selfId: number,
  { viewerEmail }: { viewerEmail?: string | null } = {}
): Promise<NicknameCheckResult> {
  const validation = validateNickname(raw, { allowReserved: isAdminEmail(viewerEmail) });
  if (!validation.ok) {
    // 탈퇴 표시용 이름("탈퇴한 사용자…")은 누구의 지금 이름도 될 수 없어 DB 를 보지 않고 거절한다.
    const name = String(raw).trim();
    if (validation.code === "RESERVED" && !isReservedUserName(name)) {
      if ((await findNameOwnerId(name)) === selfId) return { available: true, name, isCurrent: true };
    }
    return { available: false, code: validation.code, reason: validation.reason };
  }

  const ownerId = await findNameOwnerId(validation.name);
  if (ownerId !== null && ownerId !== selfId) {
    return { available: false, code: "TAKEN", reason: NICKNAME_TAKEN_MESSAGE };
  }
  return { available: true, name: validation.name, isCurrent: ownerId === selfId };
}
