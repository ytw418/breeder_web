import { authFetch } from "@libs/client/authFetch";
import type { BloodlineCardEventsResponse } from "@libs/shared/bloodline-card";
import { normalizeDeletedUserNames } from "@libs/shared/deletedUser";

/**
 * 혈통카드 이벤트 이력. SWR fetcher 를 거치지 않고 여러 카드를 직접 불러오는 화면(카드 상세·이벤트 타임라인)이 쓴다.
 * 그래서 탈퇴 유저 이름("탈퇴한 사용자#<id>") 정규화를 여기서 한다. 실패 응답은 빈 배열.
 */
export async function fetchBloodlineCardEvents(
  cardId: number | string,
  limit: number
): Promise<BloodlineCardEventsResponse["events"]> {
  const response = await authFetch(
    `/api/bloodline-cards/${cardId}/events?limit=${limit}`
  );
  const payload = normalizeDeletedUserNames(
    (await response.json()) as BloodlineCardEventsResponse
  );
  return payload?.success ? payload.events || [] : [];
}
