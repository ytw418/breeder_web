"use client";

import { BottomSheet } from "@components/app/BottomSheet";
import { cn } from "@libs/client/utils";

export type ActionSheetAction = {
  key: string;
  label: string;
  destructive?: boolean;
  disabled?: boolean;
  onSelect: () => void;
};

/**
 * ⋮ 메뉴용 행 시트(앱 PostActionSheet 톤). 행 h56 16/500, 위험 동작은 app-danger 글자.
 * 행을 누르면 먼저 onClose() 로 시트를 닫고 onSelect() 를 부른다(이어서 확인 창·신고 시트를 띄우기 위해).
 */
export function ActionSheet({
  open,
  onClose,
  title,
  actions,
  cancelLabel = "취소",
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  actions: ActionSheetAction[];
  cancelLabel?: string;
}) {
  return (
    <BottomSheet open={open} onClose={onClose} title={title} ariaLabel={title ?? "더보기 메뉴"}>
      <ul className="pb-2">
        {actions.map((action) => (
          <li key={action.key}>
            <button
              type="button"
              disabled={action.disabled}
              onClick={() => {
                onClose();
                action.onSelect();
              }}
              className={cn(
                "flex h-14 w-full items-center px-4 text-left text-[16px] font-medium transition-colors hover:bg-app-surface disabled:cursor-not-allowed disabled:opacity-40",
                action.destructive ? "text-app-danger" : "text-app-text"
              )}
            >
              {action.label}
            </button>
          </li>
        ))}
        <li className="mt-1 border-t border-app-line">
          <button
            type="button"
            onClick={onClose}
            className="flex h-14 w-full items-center justify-center text-[16px] font-medium text-app-muted transition-colors hover:bg-app-surface"
          >
            {cancelLabel}
          </button>
        </li>
      </ul>
    </BottomSheet>
  );
}

export default ActionSheet;
