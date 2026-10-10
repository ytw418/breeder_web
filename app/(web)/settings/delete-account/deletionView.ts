import { toAuctionPath } from "@libs/auction-route";
import { getProductPath } from "@libs/product-route";

/** GET/POST /api/users/me/deletion 응답(pages/api/users/me/deletion.ts). */
export type DeletionBlockerCode =
  | "AUCTION_SELLING_ACTIVE"
  | "AUCTION_TOP_BIDDER"
  | "AUCTION_SETTLING_SELLER"
  | "AUCTION_SETTLING_WINNER"
  | "PRODUCT_RESERVED";

export interface DeletionBlocker {
  code: DeletionBlockerCode;
  message: string;
  items: { id: number; title: string; endAt?: string }[];
}

export interface DeletionEligibilityResponse {
  success: boolean;
  eligible?: boolean;
  purgeAfterDays?: number;
  blockers?: DeletionBlocker[];
  errorCode?: string;
  message?: string;
}

export interface DeleteAccountResponse {
  success: boolean;
  errorCode?: string;
  message?: string;
  blockers?: DeletionBlocker[];
}

export const DEFAULT_PURGE_DAYS = 30;

export const DELETION_REASONS = [
  "자주 사용하지 않아요",
  "원하는 개체가 없어요",
  "거래가 불편해요",
  "개인정보가 걱정돼요",
  "기타",
] as const;

/** 화면 아래쪽(체크리스트 다음) 영역에 무엇을 그릴지. */
export type DeletionView = "loading" | "error" | "admin" | "blocked" | "eligible";

export function getDeletionView({
  isLoading,
  error,
  data,
}: {
  isLoading: boolean;
  error?: unknown;
  data?: DeletionEligibilityResponse;
}): DeletionView {
  if (isLoading && !data) return "loading";
  if (!data) return error ? "error" : "loading";
  if (!data.success) return "error";
  if (data.errorCode === "ADMIN_ACCOUNT_CANNOT_SELF_DELETE") return "admin";
  if (data.blockers?.length) return "blocked";
  return "eligible";
}

/** 탈퇴하기 버튼을 누를 수 있는지. 서버가 eligible 이라고 답했을 때만. */
export const canRequestDeletion = (view: DeletionView, data: DeletionEligibilityResponse | undefined, pending: boolean) =>
  view === "eligible" && Boolean(data?.eligible) && !pending;

/** 막는 항목으로 가는 링크: 예약중 분양글은 분양글 상세, 나머지는 경매 상세. */
export const blockerHref = (blocker: Pick<DeletionBlocker, "code">, item: { id: number; title: string }) =>
  blocker.code === "PRODUCT_RESERVED" ? getProductPath(item.id, item.title) : toAuctionPath(item.id, item.title);

/** POST 409(ACCOUNT_DELETION_BLOCKED) 응답을 받은 뒤 화면 상태를 막힘으로 바꾼다. */
export function applyBlockedResult(
  prev: DeletionEligibilityResponse | undefined,
  result: DeleteAccountResponse
): DeletionEligibilityResponse | undefined {
  if (result.errorCode !== "ACCOUNT_DELETION_BLOCKED" || !result.blockers) return prev;
  return {
    success: true,
    purgeAfterDays: prev?.purgeAfterDays ?? DEFAULT_PURGE_DAYS,
    eligible: false,
    blockers: result.blockers,
  };
}
