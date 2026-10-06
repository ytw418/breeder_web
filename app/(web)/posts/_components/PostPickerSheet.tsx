"use client";

import { BottomSheet } from "@components/app/BottomSheet";

/** 시안 A-karrot 선택 row 를 누르면 아래에서 올라오는 목록 시트(앱 PostPickerSheet). */
export type PostPickerOption = { id: string; name: string };

export function PostPickerSheet({
  open,
  title,
  options,
  selectedId,
  allowClear = false,
  clearLabel = "선택 안 함",
  onSelect,
  onClose,
}: {
  open: boolean;
  title: string;
  options: readonly PostPickerOption[];
  selectedId: string;
  allowClear?: boolean;
  clearLabel?: string;
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  const rows: PostPickerOption[] = allowClear
    ? [{ id: "", name: clearLabel }, ...options]
    : [...options];

  return (
    <BottomSheet open={open} onClose={onClose} title={title} ariaLabel={title} className="max-h-[70vh]">
      <ul>
        {rows.map((option) => {
          const active = option.id === selectedId;
          return (
            <li key={option.id || "__clear__"}>
              <button
                type="button"
                aria-pressed={active}
                onClick={() => onSelect(option.id)}
                className="flex h-14 w-full items-center justify-between px-4 text-left transition-colors hover:bg-app-surface"
              >
                <span
                  className={
                    active
                      ? "text-[16px] font-semibold text-app-brand"
                      : "text-[16px] font-normal text-app-text"
                  }
                >
                  {option.name}
                </span>
                {active ? (
                  <svg
                    width={20}
                    height={20}
                    viewBox="0 0 24 24"
                    fill="none"
                    className="text-app-brand"
                    aria-hidden="true"
                  >
                    <path
                      d="M5 12.5l4.5 4.5L19 7.5"
                      stroke="currentColor"
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>
    </BottomSheet>
  );
}

export default PostPickerSheet;
