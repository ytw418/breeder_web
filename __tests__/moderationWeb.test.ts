import {
  MODERATION_LIST_KEY_PREFIXES,
  adminActionKeys,
  moderationConfirmText,
} from "@libs/client/moderation";
import { swrKeyHasPrefix, updateInfiniteWhere, revalidateWhere } from "@libs/client/swrRevalidate";
import { isFollowListKey, withFollowListRow } from "@libs/client/followState";

describe("관리자 조치 규칙(앱 useAdminModeration 과 같음)", () => {
  it("관리자만 항목이 있고, 숨김이면 '숨김 해제', 아니면 '숨기기' 다음 '삭제'", () => {
    expect(adminActionKeys({ isAdmin: false, isHidden: false })).toEqual([]);
    expect(adminActionKeys({ isAdmin: true, isHidden: false })).toEqual(["admin-hide", "admin-delete"]);
    expect(adminActionKeys({ isAdmin: true, isHidden: true })).toEqual(["admin-unhide", "admin-delete"]);
  });

  it("확인 문구는 대상에 맞는 조사를 쓴다", () => {
    expect(moderationConfirmText("hide", "POST").title).toBe("이 게시글을 숨길까요?");
    expect(moderationConfirmText("hide", "AUCTION").title).toBe("이 경매를 숨길까요?");
    expect(moderationConfirmText("unhide", "COMMENT").title).toBe("이 댓글의 숨김을 해제할까요?");
    expect(moderationConfirmText("delete", "PRODUCT")).toEqual({
      title: "이 상품을 삭제할까요?",
      description: "관리자 권한으로 삭제합니다. 삭제 후에는 복구할 수 없습니다.",
      confirmText: "삭제",
    });
  });

  it("조치 뒤 목록·프로필 키를 다시 받는다", () => {
    expect(swrKeyHasPrefix("$inf$/api/posts?page=1", MODERATION_LIST_KEY_PREFIXES.POST)).toBe(true);
    expect(swrKeyHasPrefix("/api/home/feed?scope=public", MODERATION_LIST_KEY_PREFIXES.PRODUCT)).toBe(true);
    expect(swrKeyHasPrefix("/api/users/3/auctions?page=1", MODERATION_LIST_KEY_PREFIXES.AUCTION)).toBe(true);
    expect(swrKeyHasPrefix("/api/chat", MODERATION_LIST_KEY_PREFIXES.COMMENT)).toBe(false);
  });
});

describe("무한 목록 캐시 갱신(전역 mutate 필터는 $inf$ 키를 건너뛴다)", () => {
  const makeCache = (entries: [string, unknown][]) => {
    const store = new Map(entries.map(([key, data]) => [key, { data } as Record<string, unknown>]));
    return {
      store,
      cache: {
        keys: () => store.keys(),
        get: (key: string) => store.get(key),
        set: (key: string, value: Record<string, unknown>) => void store.set(key, value),
        delete: (key: string) => void store.delete(key),
      },
    };
  };

  it("팔로우 목록 행은 키를 직접 찾아 그 사람 행만 바꾼다", async () => {
    const pages = [{ users: [{ id: 1, isFollowing: false }, { id: 2, isFollowing: false }] }];
    const { cache } = makeCache([
      ["$inf$/api/users/3/followers?page=1&size=20", pages],
      ["$inf$/api/posts?page=1", [[]]],
    ]);
    const mutate = jest.fn().mockResolvedValue(undefined);
    updateInfiniteWhere({ cache, mutate } as never, isFollowListKey, (current?: typeof pages) =>
      withFollowListRow(current, 2, true)
    );
    expect(mutate).toHaveBeenCalledTimes(1);
    const [key, updater, options] = mutate.mock.calls[0];
    expect(key).toBe("$inf$/api/users/3/followers?page=1&size=20");
    expect(options).toEqual({ revalidate: false });
    expect(updater(pages)[0].users[1]).toEqual({ id: 2, isFollowing: true });
  });

  it("사진 고정 뒤 사진 목록(무한 목록)도 모든 페이지를 다시 받는다", () => {
    const { cache, store } = makeCache([
      ["$inf$/api/users/3/posts?media=photo&page=1&size=20", [[]]],
      ["$inf$/api/users/3/posts?page=1&size=20", [[]]],
    ]);
    const mutate = jest.fn().mockResolvedValue(undefined);
    revalidateWhere({ cache, mutate } as never, (key) => /\/api\/users\/\d+\/posts\?media=photo/.test(key));
    expect(mutate).toHaveBeenCalledWith("$inf$/api/users/3/posts?media=photo&page=1&size=20");
    expect(mutate).not.toHaveBeenCalledWith("$inf$/api/users/3/posts?page=1&size=20");
    expect(store.get("$inf$/api/users/3/posts?media=photo&page=1&size=20")?._i).toBe(true);
  });
});
