/**
 * 관리자 조치(숨김·숨김 해제·삭제) 공용 규칙 — 앱 src/lib/moderation/useAdminModeration.ts 와 같은 문구·순서.
 * 서버: POST /api/admin/moderation { targetType, targetId, action }.
 */
export type ModerationTargetType = "POST" | "COMMENT" | "PRODUCT" | "AUCTION";
export type ModerationAction = "hide" | "unhide" | "delete";

/** 숨김 안내·확인 창에 쓰는 대상 이름 */
export const MODERATION_TARGET_LABEL: Record<ModerationTargetType, string> = {
  POST: "게시글",
  COMMENT: "댓글",
  PRODUCT: "분양글",
  AUCTION: "경매",
};

/** 확인 창 목적격(게시글을·댓글을·분양글을·경매를) */
const TARGET_OBJECT: Record<ModerationTargetType, string> = {
  POST: "게시글을",
  COMMENT: "댓글을",
  PRODUCT: "분양글을",
  AUCTION: "경매를",
};

export function moderationConfirmText(action: ModerationAction, type: ModerationTargetType) {
  if (action === "hide") {
    return {
      title: `이 ${TARGET_OBJECT[type]} 숨길까요?`,
      description: "운영 정책 위반으로 비공개 처리합니다. 작성자와 관리자에게만 보입니다.",
      confirmText: "숨기기",
    };
  }
  if (action === "unhide") {
    return {
      title: `이 ${MODERATION_TARGET_LABEL[type]}의 숨김을 해제할까요?`,
      description: "다시 모든 사용자에게 보입니다.",
      confirmText: "숨김 해제",
    };
  }
  return {
    title: `이 ${TARGET_OBJECT[type]} 삭제할까요?`,
    description: "관리자 권한으로 삭제합니다. 삭제 후에는 복구할 수 없습니다.",
    confirmText: "삭제",
  };
}

export const MODERATION_DONE_MESSAGE: Record<ModerationAction, string> = {
  hide: "숨김 처리했습니다.",
  unhide: "숨김을 해제했습니다.",
  delete: "삭제했습니다.",
};

export type AdminActionKey = "admin-hide" | "admin-unhide" | "admin-delete";

/** 관리자 ⋯ 항목: 숨김이면 '숨김 해제', 아니면 '숨기기', 그리고 '삭제'. 관리자가 아니면 없다. */
export function adminActionKeys({ isAdmin, isHidden }: { isAdmin: boolean; isHidden: boolean }): AdminActionKey[] {
  if (!isAdmin) return [];
  return [isHidden ? "admin-unhide" : "admin-hide", "admin-delete"];
}

/**
 * 조치 뒤 다시 받을 SWR 키 접두어(앱 LIST_KEYS). 숨김은 목록·검색·랭킹·프로필(작성자 본인 화면 포함)에서
 * 빠지거나 다시 들어온다. 상세는 화면이 따로 다시 받는다.
 */
export const MODERATION_LIST_KEY_PREFIXES: Record<ModerationTargetType, readonly string[]> = {
  POST: ["/api/posts", "/api/search", "/api/rankings", "/api/ranking", "/api/home/feed", "/api/users/"],
  COMMENT: ["/api/posts", "/api/users/"],
  PRODUCT: ["/api/products", "/api/home/feed", "/api/search", "/api/users/"],
  AUCTION: ["/api/auctions", "/api/home/feed", "/api/search", "/api/rankings", "/api/users/"],
};
