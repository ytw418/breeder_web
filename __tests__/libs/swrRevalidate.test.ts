import { revalidateByPrefix, swrKeyHasPrefix } from "@libs/client/swrRevalidate";

describe("swrKeyHasPrefix", () => {
  it("문자열·배열 첫 원소·무한 목록 키를 접두어로 판정한다", () => {
    expect(swrKeyHasPrefix("/api/users/5/posts?page=1", ["/api/users/"])).toBe(true);
    expect(swrKeyHasPrefix("$inf$/api/posts?page=1", ["/api/posts"])).toBe(true);
    expect(swrKeyHasPrefix(["bloodline-card-events", 1, 2], ["bloodline-card-events"])).toBe(true);
    expect(swrKeyHasPrefix("/api/chat", ["/api/posts"])).toBe(false);
    expect(swrKeyHasPrefix(null, ["/api/posts"])).toBe(false);
  });
});

describe("revalidateByPrefix", () => {
  it("일반 키는 전역 필터로, 무한 목록 키는 모든 페이지 다시 받기(_i)를 켜고 직접 재검증한다", () => {
    const store = new Map<string, Record<string, unknown>>([
      ["/api/users/5", { data: 1 }],
      ["$inf$/api/users/5/posts?page=1&size=20", { data: [[]] }],
      ["$inf$/api/chat?page=1", { data: [[]] }],
    ]);
    const cache = {
      keys: () => store.keys(),
      get: (key: string) => store.get(key),
      set: (key: string, value: Record<string, unknown>) => void store.set(key, value),
      delete: (key: string) => void store.delete(key),
    };
    const mutate = jest.fn().mockResolvedValue(undefined);

    revalidateByPrefix({ cache, mutate } as never, ["/api/users/"]);

    const filter = mutate.mock.calls[0][0] as (key: unknown) => boolean;
    expect(filter("/api/users/5")).toBe(true);
    expect(filter("/api/chat")).toBe(false);
    expect(mutate).toHaveBeenCalledWith("$inf$/api/users/5/posts?page=1&size=20");
    expect(mutate).not.toHaveBeenCalledWith("$inf$/api/chat?page=1");
    expect(store.get("$inf$/api/users/5/posts?page=1&size=20")?._i).toBe(true);
    expect(store.get("$inf$/api/chat?page=1")?._i).toBeUndefined();
  });
});
