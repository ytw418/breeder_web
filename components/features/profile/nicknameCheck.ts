import { NICKNAME_MAX_LENGTH } from "@libs/shared/nickname";

/**
 * 프로필 수정 닉네임 사전 확인(앱 editProfile.tsx 와 같은 규칙).
 * - 입력이 멈추고 400ms 뒤 GET /api/users/check-name 으로 중복·예약어를 묻는다.
 * - 비었거나 10자를 넘거나 현재 닉네임과 같으면 묻지 않는다(idle).
 * - 5초 안에 답이 없거나 실패하면 끊고 idle 로 돌려 저장을 막지 않는다(저장 때 서버가 다시 판정).
 * - 늦게 도착한 이전 입력의 응답은 버린다.
 */
export type NameCheck = "idle" | "checking" | "available" | "unavailable";

export const NAME_CHECK_DEBOUNCE_MS = 400;
export const NAME_CHECK_TIMEOUT_MS = 5000;

export interface CheckNameResult {
  success: boolean;
  available?: boolean;
  reason?: string;
}

export type CheckNameRequest = (name: string, signal: AbortSignal) => Promise<CheckNameResult>;

/** 서버에 물어볼 입력인지. */
export function shouldCheckNickname(nextName: string, currentName?: string | null) {
  const trimmed = nextName.trim();
  if (!trimmed) return false;
  if (nextName.length > NICKNAME_MAX_LENGTH) return false;
  return trimmed !== (currentName ?? "");
}

export interface NicknameChecker {
  schedule: (nextName: string, currentName?: string | null) => void;
  cancel: () => void;
}

export function createNicknameChecker({
  request,
  onStatus,
  debounceMs = NAME_CHECK_DEBOUNCE_MS,
  timeoutMs = NAME_CHECK_TIMEOUT_MS,
}: {
  request: CheckNameRequest;
  /** reason 은 unavailable 일 때 화면에 보여 줄 사유. */
  onStatus: (status: NameCheck, reason?: string) => void;
  debounceMs?: number;
  timeoutMs?: number;
}): NicknameChecker {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let controller: AbortController | null = null;
  let seq = 0;

  const cancel = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    controller?.abort();
    controller = null;
  };

  const schedule = (nextName: string, currentName?: string | null) => {
    cancel();
    seq += 1;
    const mySeq = seq;
    if (!shouldCheckNickname(nextName, currentName)) {
      onStatus("idle");
      return;
    }
    const trimmed = nextName.trim();
    onStatus("checking");
    timer = setTimeout(() => {
      timer = null;
      const current = new AbortController();
      controller = current;
      const guard = setTimeout(() => {
        current.abort();
        if (mySeq === seq) onStatus("idle");
      }, timeoutMs);
      request(trimmed, current.signal)
        .then((res) => {
          if (mySeq !== seq || current.signal.aborted) return;
          if (!res.success || typeof res.available !== "boolean") {
            onStatus("idle");
            return;
          }
          if (!res.available) {
            onStatus("unavailable", res.reason || "사용할 수 없는 닉네임입니다.");
            return;
          }
          onStatus("available");
        })
        .catch(() => {
          // 네트워크 오류·시간 초과: 막지 않고 저장 시 서버가 판정한다.
          if (mySeq === seq) onStatus("idle");
        })
        .finally(() => {
          clearTimeout(guard);
          if (controller === current) controller = null;
        });
    }, debounceMs);
  };

  return { schedule, cancel };
}
