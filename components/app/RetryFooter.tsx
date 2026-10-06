"use client";

/**
 * 무한 스크롤 목록 바닥: 불러오는 중 → 스피너, 다음 페이지 실패 → "다시 시도", 더 있음 → "더 보기"(선택).
 * 더 없으면 아무것도 그리지 않는다.
 */
export function RetryFooter({
  loading = false,
  error = false,
  hasMore = false,
  onRetry,
  onLoadMore,
}: {
  loading?: boolean;
  error?: boolean | unknown;
  hasMore?: boolean;
  onRetry: () => void;
  onLoadMore?: () => void;
}) {
  if (loading) {
    return (
      <div className="flex h-16 items-center justify-center" role="status" aria-label="불러오는 중">
        <span className="h-5 w-5 animate-spin rounded-full border-2 border-app-border border-t-app-muted" />
      </div>
    );
  }
  if (error) {
    return (
      <div className="flex flex-col items-center gap-2 py-4">
        <p className="text-[13px] text-app-muted">목록을 더 불러오지 못했어요.</p>
        <button
          type="button"
          onClick={onRetry}
          className="h-9 rounded-md bg-app-surface px-4 text-[14px] font-semibold text-app-text"
        >
          다시 시도
        </button>
      </div>
    );
  }
  if (hasMore && onLoadMore) {
    return (
      <div className="flex justify-center py-4">
        <button
          type="button"
          onClick={onLoadMore}
          className="h-9 rounded-md bg-app-surface px-4 text-[14px] font-semibold text-app-text"
        >
          더 보기
        </button>
      </div>
    );
  }
  return null;
}

export default RetryFooter;
