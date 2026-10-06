/**
 * 브리디북 신청서 임시저장(localStorage). 연락처(전화번호·이메일)가 들어가므로 계정별 키로 나누고
 * 로그아웃·계정 전환 때 지운다(앱 src/lib/guinnessDraft.ts 와 같은 규칙).
 */

/** 계정 구분 없이 쓰던 예전 키. 누구 것인지 알 수 없어 복원하지 않고 지운다. */
export const LEGACY_GUINNESS_DRAFT_KEY = "guinness_submission_draft_v1";
export const GUINNESS_DRAFT_KEY_PREFIX = "guinness_submission_draft_v2";

export function getGuinnessDraftKey(userId: number): string {
  return `${GUINNESS_DRAFT_KEY_PREFIX}.${userId}`;
}

function getStorage(): Storage | null {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
}

export function deleteLegacyGuinnessDraft(storage: Storage | null = getStorage()) {
  try {
    storage?.removeItem(LEGACY_GUINNESS_DRAFT_KEY);
  } catch {
    // 정리 실패는 화면 진입을 막지 않는다.
  }
}

/**
 * 현재 계정이 아닌 임시저장을 모두 지운다(레거시 키 포함). 비로그인이면 전부 지운다.
 * 로그아웃 훅에서 지우지 못한 경우(다른 계정으로 로그인한 같은 브라우저)에도 남의 연락처가 복원되지 않게 한다.
 */
export function clearOtherGuinnessDrafts(
  currentUserId: number | null | undefined,
  storage: Storage | null = getStorage()
) {
  if (!storage) return;
  deleteLegacyGuinnessDraft(storage);
  const keep = currentUserId != null ? getGuinnessDraftKey(currentUserId) : null;
  try {
    const keys: string[] = [];
    for (let i = 0; i < storage.length; i += 1) {
      const key = storage.key(i);
      if (key && key.startsWith(`${GUINNESS_DRAFT_KEY_PREFIX}.`) && key !== keep) keys.push(key);
    }
    keys.forEach((key) => storage.removeItem(key));
  } catch {
    // noop
  }
}

/** 로그아웃 시 호출: 레거시 키와 해당 계정(없으면 전부)의 임시저장을 지운다. */
export function clearGuinnessDrafts(
  userId?: number | null,
  storage: Storage | null = getStorage()
) {
  if (!storage) return;
  deleteLegacyGuinnessDraft(storage);
  if (userId == null) {
    clearOtherGuinnessDrafts(null, storage);
    return;
  }
  try {
    storage.removeItem(getGuinnessDraftKey(userId));
  } catch {
    // noop
  }
}

export function readGuinnessDraft<T>(key: string, storage: Storage | null = getStorage()): T | null {
  if (!storage) return null;
  try {
    const saved = storage.getItem(key);
    return saved ? (JSON.parse(saved) as T) : null;
  } catch {
    try {
      storage.removeItem(key);
    } catch {
      // noop
    }
    return null;
  }
}

export function writeGuinnessDraft(key: string, value: unknown, storage: Storage | null = getStorage()) {
  try {
    storage?.setItem(key, JSON.stringify(value));
  } catch {
    // 저장 공간 부족 등은 무시
  }
}

export function removeGuinnessDraft(key: string, storage: Storage | null = getStorage()) {
  try {
    storage?.removeItem(key);
  } catch {
    // noop
  }
}
