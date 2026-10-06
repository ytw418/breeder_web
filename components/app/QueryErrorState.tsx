"use client";

import { cn } from "@libs/client/utils";

/**
 * 조회 실패 상태: 오류 문구 + "다시 시도"(앱 QueryErrorState 와 같은 문구).
 * 데이터가 없는 상태에서 오류일 때만 쓴다(실제 빈 데이터는 EmptyState).
 */
export function QueryErrorState({
  title = "불러오지 못했어요",
  description = "네트워크 상태를 확인하고 다시 시도해 주세요.",
  onRetry,
  className,
}: {
  title?: string;
  description?: string;
  onRetry: () => void;
  className?: string;
}) {
  return (
    <div role="alert" className={cn("flex flex-col items-center px-4 py-10 text-center", className)}>
      <p className="text-[16px] font-semibold tracking-[-0.3px] text-app-text">{title}</p>
      <p className="mt-1.5 text-[14px] tracking-[-0.2px] text-app-muted">{description}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-4 h-11 rounded-md bg-app-surface px-[18px] text-[14px] font-semibold text-app-text"
      >
        다시 시도
      </button>
    </div>
  );
}

export default QueryErrorState;
