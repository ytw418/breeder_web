const AUCTION_ERROR_MESSAGES: Record<string, string> = {
  AUCTION_AUTH_REQUIRED: "로그인이 필요합니다.",
  AUCTION_REQUIRED_FIELDS: "필수 항목을 모두 입력해주세요.",
  AUCTION_INVALID_START_PRICE: "시작가를 확인해주세요.",
  AUCTION_INVALID_END_AT: "유효한 종료 시간을 선택해주세요.",
  AUCTION_DURATION_OUT_OF_RANGE:
    "경매 기간은 등록 시점 기준 1시간~72시간 사이여야 합니다.",
  AUCTION_SELLER_RESTRICTED: "현재 계정 상태에서는 경매 등록이 제한됩니다.",
  AUCTION_CONTACT_REQUIRED_HIGH_PRICE:
    "고가 경매는 연락처(전화/이메일) 정보가 필요합니다.",
  AUCTION_ACTIVE_LIMIT_EXCEEDED: "동시 진행 경매는 최대 100개까지 등록할 수 있습니다.",
  AUCTION_INVALID_PHOTO_COUNT: "사진은 최소 1장, 최대 5장까지 등록할 수 있습니다.",
  AUCTION_DUPLICATE_RECENT:
    "동일한 내용의 경매가 이미 등록되었습니다. 기존 경매를 공유하거나 수정해주세요.",
  AUCTION_CREATE_FAILED: "경매 등록 중 오류가 발생했습니다.",
  AUCTION_INVALID_ID: "유효하지 않은 경매 ID입니다.",
  AUCTION_INVALID_ACTION: "유효하지 않은 요청입니다.",
  AUCTION_OWNER_RESTRICTED: "현재 계정 상태에서는 경매 수정이 제한됩니다.",
  AUCTION_NOT_FOUND: "경매를 찾을 수 없습니다.",
  AUCTION_EDIT_NOT_ALLOWED:
    "진행중 상태에서 등록 후 10분 이내, 입찰이 없는 경우에만 수정할 수 있습니다.",
  AUCTION_DURATION_OUT_OF_RANGE_UPDATE:
    "경매 기간은 수정 시점 기준 1시간~72시간 사이여야 합니다.",
  AUCTION_UPDATE_FAILED: "경매 수정 중 오류가 발생했습니다.",
  BID_AUTH_REQUIRED: "로그인이 필요합니다.",
  BID_INVALID_REQUEST: "유효하지 않은 요청입니다.",
  BID_ACCOUNT_RESTRICTED: "현재 계정 상태에서는 입찰이 제한됩니다.",
  BID_AUCTION_NOT_FOUND: "경매를 찾을 수 없습니다.",
  BID_AUCTION_CLOSED: "이미 종료된 경매입니다.",
  BID_SELF_NOT_ALLOWED: "본인 경매에는 입찰할 수 없습니다.",
  BID_TOP_BIDDER_CANNOT_REBID: "현재 최고 입찰자는 다시 입찰할 수 없습니다.",
  BID_AMOUNT_NOT_INTEGER: "입찰 금액은 1원 이상의 정수여야 합니다.",
  BID_AMOUNT_RULE_VIOLATION: "입찰 금액 단위를 확인해주세요.",
  BID_PROCESS_FAILED: "입찰 처리 중 오류가 발생했습니다.",
  REPORT_AUTH_REQUIRED: "로그인이 필요합니다.",
  REPORT_INVALID_AUCTION_ID: "유효하지 않은 경매입니다.",
  REPORT_INVALID_REASON: "신고 사유를 선택해주세요.",
  REPORT_INVALID_DETAIL_LENGTH: "신고 내용은 5자 이상 500자 이하로 입력해주세요.",
  REPORT_ACCOUNT_RESTRICTED: "현재 계정 상태에서는 신고할 수 없습니다.",
  REPORT_AUCTION_NOT_FOUND: "경매를 찾을 수 없습니다.",
  REPORT_SELF_NOT_ALLOWED: "본인 경매는 신고할 수 없습니다.",
  REPORT_ALREADY_EXISTS: "이미 접수된 신고가 있습니다. 운영자 검토를 기다려주세요.",
};

export const getAuctionErrorMessage = (
  errorCode?: string,
  fallback?: string
) => {
  if (errorCode && AUCTION_ERROR_MESSAGES[errorCode]) {
    return AUCTION_ERROR_MESSAGES[errorCode];
  }
  return fallback || "요청 처리 중 오류가 발생했습니다.";
};
