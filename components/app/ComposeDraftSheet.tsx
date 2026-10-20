"use client";

import { BottomSheet } from "@components/app/BottomSheet";
import { composeDraftLabel } from "@libs/client/composeDraft";
import { getTimeAgoString } from "@libs/client/utils";

/**
 * 글쓰기·분양 등록을 열었을 때 쓰던 글이 있으면 묻는 시트(앱 ComposeDraftSheet, 시안 post-upload/A2-karrot.html ⑥).
 * 제목 16/700 · 보조 '제목 앞 20자 · 3분 전' 13 muted · '새로 쓰기'(surface)·'이어 쓰기'(brand).
 * 바깥·Esc 는 '이어 쓰기'로 본다(쓴 글을 잃지 않게).
 */
export function ComposeDraftSheet({
  open,
  title,
  savedAt,
  onResume,
  onDiscard,
}: {
  open: boolean;
  title: string;
  savedAt: string;
  onResume: () => void;
  onDiscard: () => void;
}) {
  const saved = new Date(savedAt);
  const when = Number.isNaN(saved.getTime()) ? "" : getTimeAgoString(saved);
  return (
    <BottomSheet open={open} onClose={onResume} ariaLabel="쓰던 글이 있어요">
      <div className="px-4 pb-5">
        <h2 className="text-[16px] font-bold text-app-text">쓰던 글이 있어요</h2>
        <p className="mt-1.5 truncate text-[13px] text-app-muted">
          {composeDraftLabel(title)}
          {when ? ` · ${when}` : ""}
        </p>
        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onDiscard}
            className="h-[52px] flex-1 rounded-md bg-app-surface text-[16px] font-semibold text-app-text"
          >
            새로 쓰기
          </button>
          <button
            type="button"
            onClick={onResume}
            className="h-[52px] flex-1 rounded-md bg-app-brand text-[16px] font-semibold text-white"
          >
            이어 쓰기
          </button>
        </div>
      </div>
    </BottomSheet>
  );
}

export default ComposeDraftSheet;
