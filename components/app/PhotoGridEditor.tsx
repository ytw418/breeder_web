"use client";

import { useRef } from "react";
import { toast } from "@libs/client/toast";

export type PhotoItem = {
  /** 렌더 키(서버 이미지 id 나 로컬 임시 키). */
  key: string;
  /** 미리보기 주소(서버 이미지 URL 또는 URL.createObjectURL). */
  src: string;
  /** 아직 올리지 않은 로컬 파일. */
  file?: File;
};

/**
 * 사진 첨부 줄(앱 ProductPhotoPicker·게시글 작성 시안 .photos). 80x80 r6 썸네일 가로 스크롤.
 * - 맨 앞 "카메라 n/max" 칸을 누르면 파일 선택 → onAdd(files) (남은 장수만큼만 넘긴다)
 * - 첫 장에 "대표" 표시, 다른 사진을 누르면 맨 앞으로 옮겨 대표로 바꾼다(순서 변경)
 * - 오른쪽 위 x 로 삭제
 */
export function PhotoGridEditor({
  photos,
  onChange,
  max = 10,
  onAdd,
  label = "첫 번째 사진이 대표로 보여요. 사진을 누르면 대표로 바꿀 수 있어요",
  disabled = false,
}: {
  photos: PhotoItem[];
  onChange: (photos: PhotoItem[]) => void;
  max?: number;
  onAdd: (files: File[]) => void;
  /** 아래 안내 문구. 빈 문자열이면 숨긴다. */
  label?: string;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const remaining = Math.max(max - photos.length, 0);

  const makeRepresentative = (index: number) => {
    if (index === 0) return;
    const next = [...photos];
    const [picked] = next.splice(index, 1);
    onChange([picked, ...next]);
    toast.success("대표 사진으로 설정했어요");
  };

  const removePhoto = (index: number) => {
    onChange(photos.filter((_, i) => i !== index));
  };

  return (
    <div>
      <div className="flex gap-2 overflow-x-auto pr-1.5 pt-1.5 scrollbar-hide">
        {remaining > 0 ? (
          <button
            type="button"
            aria-label="사진 추가"
            disabled={disabled}
            onClick={() => inputRef.current?.click()}
            className="flex h-20 w-20 shrink-0 flex-col items-center justify-center gap-1 rounded-md border border-app-border bg-app-bg disabled:opacity-50"
          >
            <svg className="h-6 w-6 text-app-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.5"
                d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.414-.828A2 2 0 0110.93 3h2.14a2 2 0 011.664.89l.414.828A2 2 0 0016.07 7H17a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
              />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="text-[13px] text-app-muted">
              {photos.length}/{max}
            </span>
          </button>
        ) : null}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(event) => {
            const files = Array.from(event.target.files ?? []).slice(0, remaining);
            event.target.value = "";
            if (files.length) onAdd(files);
          }}
        />

        {photos.map((photo, index) => (
          <div key={photo.key} className="relative h-20 w-20 shrink-0 rounded-md bg-app-placeholder">
            <button
              type="button"
              disabled={disabled || index === 0}
              onClick={() => makeRepresentative(index)}
              aria-label={index === 0 ? "대표 사진" : `첨부 사진 ${index + 1}`}
              title={index === 0 ? undefined : "누르면 대표 사진으로 설정해요"}
              className="block h-20 w-20 overflow-hidden rounded-md disabled:cursor-default"
            >
              {/* 로컬 blob 미리보기도 그려야 해서 next/image 대신 img 를 쓴다. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photo.src} alt="" className="h-full w-full object-cover" />
              {index === 0 ? (
                <span className="pointer-events-none absolute bottom-1 left-1 flex h-[18px] items-center rounded-full bg-black/60 px-1.5 text-[11px] font-semibold text-white">
                  대표
                </span>
              ) : null}
            </button>
            <button
              type="button"
              aria-label={`첨부 사진 ${index + 1} 삭제`}
              disabled={disabled}
              onClick={() => removePhoto(index)}
              className="absolute -right-1.5 -top-1.5 grid h-[22px] w-[22px] place-items-center rounded-full bg-app-text text-app-bg"
            >
              <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeWidth="2.5" d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>
        ))}
      </div>
      {label ? <p className="mt-2 text-[13px] text-app-muted">{label}</p> : null}
    </div>
  );
}

export default PhotoGridEditor;
