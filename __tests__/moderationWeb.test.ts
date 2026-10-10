import {
  MODERATION_LIST_KEY_PREFIXES,
  adminActionKeys,
  moderationConfirmText,
} from "@libs/client/moderation";
import { swrKeyHasPrefix } from "@libs/client/swrRevalidate";

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
      title: "이 분양글을 삭제할까요?",
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
