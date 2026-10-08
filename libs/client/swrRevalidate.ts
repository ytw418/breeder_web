import type { Cache, useSWRConfig } from "swr";

type GlobalMutate = ReturnType<typeof useSWRConfig>["mutate"];

const INFINITE_PREFIX = "$inf$";

/** SWR 키(문자열·배열 첫 원소·useSWRInfinite "$inf$" 접두어)가 접두어 중 하나로 시작하는지. */
export function swrKeyHasPrefix(key: unknown, prefixes: readonly string[]): boolean {
  const raw = Array.isArray(key) ? key[0] : key;
  if (typeof raw !== "string") return false;
  const normalized = raw.startsWith(INFINITE_PREFIX) ? raw.slice(INFINITE_PREFIX.length) : raw;
  return prefixes.some((prefix) => normalized.startsWith(prefix));
}

/**
 * 접두어로 시작하는 SWR 키를 모두 다시 받게 한다(앱 queryClient.invalidateQueries 묶음과 같은 역할).
 * - 일반 키: 전역 mutate 필터로 재검증(마운트된 화면은 바로, 아니면 다시 열 때).
 * - useSWRInfinite 키: 전역 필터는 "$inf$" 키를 건너뛰므로 직접 찾는다. `_i`(모든 페이지 다시 받기)를
 *   켜 두면 지금 떠 있는 목록은 바로, 떠나 있던 목록은 다시 열 때 모든 페이지를 새로 받는다.
 */
export function revalidateByPrefix(
  { cache, mutate }: { cache: Cache; mutate: GlobalMutate },
  prefixes: readonly string[]
): void {
  void mutate((key: unknown) => swrKeyHasPrefix(key, prefixes));
  for (const key of Array.from(cache.keys())) {
    if (!key.startsWith(INFINITE_PREFIX) || !swrKeyHasPrefix(key, prefixes)) continue;
    const entry = cache.get(key);
    if (entry) cache.set(key, { ...entry, _i: true } as typeof entry);
    void mutate(key);
  }
}

/** 작성자 이름·사진 또는 내 활동 수가 바뀌면 다시 받아야 하는 목록·상세(앱 invalidateMyActivity + 피드). */
export const MY_ACTIVITY_KEY_PREFIXES = ["/api/users/"] as const;
export const POST_KEY_PREFIXES = ["/api/posts"] as const;
export const PROFILE_DEPENDENT_KEY_PREFIXES = [
  "/api/users/",
  "/api/posts",
  "/api/home/feed",
  "/api/products",
  "/api/auctions",
  "/api/search",
  "/api/ranking",
  "/api/rankings",
] as const;
export const BLOODLINE_LIST_KEY_PREFIXES = [
  "/api/bloodline-cards",
  "bloodline-card-events",
  "/api/users/",
] as const;
