/**
 * 이미지 업로드 URL 발급 횟수 제한(2026-10-24 보안 점검). 로그인한 계정 하나가 URL 을 대량으로 받아
 * Cloudflare Images 저장 용량·요금을 쓰지 못하게 한다.
 * - 계정당 10분에 60장(게시글 사진 여러 장·다시 고르기를 넉넉히 덮는다).
 * - 서버 인스턴스 메모리로 센다(DB 변경 없음). 인스턴스가 여러 개면 조금 더 허용될 수 있지만, 한 계정이
 *   몰아서 보내는 남용은 대부분 같은 인스턴스로 들어와 막힌다.
 */
export const UPLOAD_WINDOW_MS = 10 * 60 * 1000;
export const UPLOAD_MAX_PER_WINDOW = 60;
export const UPLOAD_LIMIT_MESSAGE = "사진을 너무 많이 올리고 있어요. 잠시 후 다시 시도해 주세요.";

const recent = new Map<number, number[]>();

/** 이번 발급을 허용하면 true(허용한 것만 센다). */
export function takeUploadSlot(userId: number, now = Date.now()): boolean {
  const since = now - UPLOAD_WINDOW_MS;
  const times = (recent.get(userId) ?? []).filter((t) => t > since);
  if (times.length >= UPLOAD_MAX_PER_WINDOW) {
    recent.set(userId, times);
    return false;
  }
  times.push(now);
  recent.set(userId, times);
  if (recent.size > 5000) {
    recent.forEach((list, id) => {
      if (!list.some((t) => t > since)) recent.delete(id);
    });
  }
  return true;
}
