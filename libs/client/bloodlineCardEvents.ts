import { authFetch } from "@libs/client/authFetch";
import type { BloodlineCardEventsResponse } from "@libs/shared/bloodline-card";
import { normalizeDeletedUserNames } from "@libs/shared/deletedUser";

type BloodlineCardEvents = BloodlineCardEventsResponse["events"];

/**
 * 혈통카드 이벤트 이력을 받는다. 실패(HTTP 오류·success=false·네트워크)는 예외로 던진다.
 * 탈퇴 유저 이름("탈퇴한 사용자#<id>") 정규화를 여기서 한다.
 */
export async function loadBloodlineCardEvents(
  cardId: number | string,
  limit: number
): Promise<BloodlineCardEvents> {
  const response = await authFetch(
    `/api/bloodline-cards/${cardId}/events?limit=${limit}`
  );
  const payload = normalizeDeletedUserNames(
    (await response.json().catch(() => null)) as BloodlineCardEventsResponse | null
  );
  if (!response.ok || !payload?.success) {
    throw new Error(payload?.error || "혈통 이벤트를 불러오지 못했습니다.");
  }
  return payload.events || [];
}

/**
 * 혈통카드 이벤트 이력. SWR fetcher 를 거치지 않고 여러 카드를 직접 불러오는 화면(카드 상세·이벤트 타임라인)이 쓴다.
 * 실패 응답은 빈 배열(네트워크 예외는 그대로 던진다).
 */
export async function fetchBloodlineCardEvents(
  cardId: number | string,
  limit: number
): Promise<BloodlineCardEvents> {
  const response = await authFetch(
    `/api/bloodline-cards/${cardId}/events?limit=${limit}`
  );
  const payload = normalizeDeletedUserNames(
    (await response.json()) as BloodlineCardEventsResponse
  );
  return payload?.success ? payload.events || [] : [];
}

/**
 * 여러 카드의 이벤트를 모아 최신순으로 정렬한다(앱 events.tsx 와 같은 규칙).
 * 카드별 실패는 건너뛰되, 전부 실패하면 "이벤트 없음" 대신 오류로 던진다.
 */
export async function loadMergedBloodlineEvents(
  cardIds: number[],
  limit: number,
  loader: typeof loadBloodlineCardEvents = loadBloodlineCardEvents
): Promise<BloodlineCardEvents> {
  if (cardIds.length === 0) return [];
  let failed = 0;
  let firstError: unknown = null;
  const loaded = await Promise.all(
    cardIds.map((cardId) =>
      loader(cardId, limit).catch((error) => {
        failed += 1;
        firstError ??= error;
        return [] as BloodlineCardEvents;
      })
    )
  );
  if (failed === cardIds.length) {
    throw firstError instanceof Error
      ? firstError
      : new Error("혈통 이벤트를 불러오지 못했습니다.");
  }
  // 같은 이벤트가 여러 카드 응답에 함께 오면(예: 라인 카드와 원본 혈통) 한 번만 보여 준다.
  const seen = new Set<number | string>();
  return loaded
    .flat()
    .filter((event) => {
      if (seen.has(event.id)) return false;
      seen.add(event.id);
      return true;
    })
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime());
}
