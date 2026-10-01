import type { ReportAction, ReportStatus, ReportTargetType } from "@prisma/client";

/**
 * 통합 신고(게시글·댓글·상품·채팅방·사용자) 공용 상수.
 * 서버 API 와 관리자 페이지가 함께 쓰고, 앱(bredy_app)은 같은 값을 복사해 쓴다.
 * 사유 문구를 바꾸면 앱 상수도 함께 바꿔야 한다(서버가 목록 밖 사유를 400 으로 거절).
 */

export type { ReportAction, ReportStatus, ReportTargetType };

export const REPORT_TARGET_TYPES = [
  "POST",
  "COMMENT",
  "PRODUCT",
  "CHAT_ROOM",
  "USER",
] as const satisfies readonly ReportTargetType[];

export const REPORT_STATUSES = [
  "OPEN",
  "RESOLVED",
  "REJECTED",
] as const satisfies readonly ReportStatus[];

export const REPORT_ACTIONS = [
  "NONE",
  "REMOVE_CONTENT",
  "BAN_USER",
  "REMOVE_CONTENT_AND_BAN",
] as const satisfies readonly ReportAction[];

export const OTHER_REASON = "기타";
export const REPORT_DETAIL_MAX = 500;
export const REPORT_DETAIL_MIN_FOR_OTHER = 5;

const CONTENT_REASONS = [
  "스팸·광고",
  "욕설·비하·혐오 표현",
  "음란·선정적 내용",
  "개인정보 노출",
  "허위 정보",
  OTHER_REASON,
] as const;

export const REPORT_REASONS: Record<ReportTargetType, readonly string[]> = {
  POST: CONTENT_REASONS,
  COMMENT: CONTENT_REASONS,
  PRODUCT: [
    "허위 매물·사기 의심",
    "거래 금지 품목(불법 개체)",
    "중복·도배 게시",
    "욕설·부적절 내용",
    OTHER_REASON,
  ],
  CHAT_ROOM: ["욕설·협박", "사기 의심", "스팸·광고", "음란 메시지", OTHER_REASON],
  USER: ["사칭", "사기 이력 의심", "반복적 욕설·괴롭힘", "스팸 계정", OTHER_REASON],
};

export const isReportTargetType = (value: unknown): value is ReportTargetType =>
  typeof value === "string" &&
  (REPORT_TARGET_TYPES as readonly string[]).includes(value);

export const isReportStatus = (value: unknown): value is ReportStatus =>
  typeof value === "string" && (REPORT_STATUSES as readonly string[]).includes(value);

export const isReportAction = (value: unknown): value is ReportAction =>
  typeof value === "string" && (REPORT_ACTIONS as readonly string[]).includes(value);

export const isValidReportReason = (type: ReportTargetType, reason: string) =>
  REPORT_REASONS[type].includes(reason);

/** 콘텐츠 삭제(REMOVE_CONTENT*) 를 적용할 수 있는 대상인지. 채팅방·사용자는 지울 콘텐츠가 없다. */
export const isRemovableReportTarget = (type: ReportTargetType) =>
  type === "POST" || type === "COMMENT" || type === "PRODUCT";

export const REPORT_TARGET_LABEL: Record<ReportTargetType, string> = {
  POST: "게시글",
  COMMENT: "댓글",
  PRODUCT: "상품",
  CHAT_ROOM: "채팅",
  USER: "사용자",
};

export const REPORT_STATUS_LABEL: Record<ReportStatus, string> = {
  OPEN: "접수",
  RESOLVED: "처리 완료",
  REJECTED: "기각",
};

export const REPORT_ACTION_LABEL: Record<ReportAction, string> = {
  NONE: "조치 없음",
  REMOVE_CONTENT: "콘텐츠 삭제",
  BAN_USER: "유저 영구정지",
  REMOVE_CONTENT_AND_BAN: "콘텐츠 삭제 + 영구정지",
};
