import client from "@libs/server/client";
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

/** 형식 검사 → 중복 검사. 형식 오류면 DB 를 조회하지 않는다. */
export async function checkNickname(raw: unknown, selfId: number): Promise<NicknameCheckResult> {
  const validation = validateNickname(raw);
  if (!validation.ok) {
    return { available: false, code: validation.code, reason: validation.reason };
  }

  const ownerId = await findNameOwnerId(validation.name);
  if (ownerId !== null && ownerId !== selfId) {
    return { available: false, code: "TAKEN", reason: NICKNAME_TAKEN_MESSAGE };
  }
  return { available: true, name: validation.name, isCurrent: ownerId === selfId };
}
