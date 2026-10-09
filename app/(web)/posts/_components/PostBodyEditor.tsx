"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { cn, makeImageUrl } from "@libs/client/utils";
import {
  LINE_SENTINEL,
  countEditorText,
  createEditorBlocks,
  editorBlocksToBody,
  editorPhotoCount,
  insertEditorPhotos,
  interpretEditorLineChange,
  mergeEditorTextWithPrevious,
  removeEditorPhoto,
  splitEditorText,
  toggleEditorTextStyle,
  updateEditorText,
  type EditorBlock,
  type EditorFocus,
  type EditorLineChange,
  type EditorTextBlock,
} from "@libs/shared/post-body-editor";
import type { ComposerPhoto } from "../_lib/postComposer";

/**
 * 게시글 본문 블록 에디터(줄 칸 + 사진 칸) — 앱 src/components/features/post/PostBodyEditor.tsx 와 같은 동작.
 * 상태 규칙은 libs/shared/post-body-editor.ts(앱과 같은 파일). 시안: 앱 design/mockups/post-upload/A2-karrot.html
 * - 엔터·여러 줄 붙여넣기·줄 맨 앞 지우기는 onChange 값으로만 알아챈다(모바일 키보드의 keydown 은 믿을 수 없다).
 *   두 번째 줄부터는 값 앞에 보이지 않는 글자를 둔다.
 * - 데스크톱은 위·아래 화살표로 줄 사이를 오간다.
 */

type LineSelection = { start: number; end: number };

let photoSeq = 0;
const nextPhotoKey = () => {
  photoSeq += 1;
  return `photo-${photoSeq}`;
};

export const toRemoteComposerPhoto = (id: string): ComposerPhoto => ({
  kind: "remote",
  key: `remote-${id}`,
  id,
});

export const toLocalComposerPhoto = (file: File): ComposerPhoto => ({
  kind: "local",
  key: nextPhotoKey(),
  file,
  previewUrl: URL.createObjectURL(file),
});

export function usePostBodyEditor(description: string, imageIds: readonly string[]) {
  const [blocks, setBlocks] = useState(() =>
    createEditorBlocks(description, imageIds, toRemoteComposerPhoto)
  );
  const [activeId, setActiveId] = useState<string | null>(null);
  const inputs = useRef(new Map<string, HTMLTextAreaElement>());
  const selections = useRef(new Map<string, LineSelection>());
  const pendingFocus = useRef<EditorFocus | null>(null);
  const blocksRef = useRef(blocks);
  useEffect(() => {
    blocksRef.current = blocks;
  }, [blocks]);

  // 화면을 떠날 때 새로 고른 사진의 미리보기 URL 을 정리한다.
  useEffect(
    () => () => {
      blocksRef.current.forEach((block) => {
        if (block.type === "image" && block.photo.kind === "local") {
          URL.revokeObjectURL(block.photo.previewUrl);
        }
      });
    },
    []
  );

  const placeCaret = (focus: EditorFocus, list: readonly EditorBlock<ComposerPhoto>[]) => {
    const index = list.findIndex((block) => block.id === focus.id);
    const el = inputs.current.get(focus.id);
    if (index < 0 || !el) return;
    const position = focus.cursor + (index > 0 ? 1 : 0);
    el.focus();
    el.setSelectionRange(position, position);
  };

  // 엔터·합치기처럼 줄이 바뀐 뒤 정한 줄·위치에 커서를 둔다.
  useEffect(() => {
    const focus = pendingFocus.current;
    if (!focus) return;
    pendingFocus.current = null;
    placeCaret(focus, blocks);
  }, [blocks]);

  const remember = (focus: EditorFocus) => {
    setActiveId(focus.id);
    selections.current.set(focus.id, { start: focus.cursor, end: focus.cursor });
  };

  const commitWithFocus = (next: EditorBlock<ComposerPhoto>[], focus: EditorFocus) => {
    pendingFocus.current = focus;
    remember(focus);
    setBlocks(next);
  };

  const changeLine = (id: string, change: EditorLineChange) => {
    const block = blocks.find((item) => item.id === id);
    if (!block || block.type !== "text") return;
    if (change.kind === "merge") {
      const merged = mergeEditorTextWithPrevious(blocks, id);
      if (merged) commitWithFocus(merged.blocks, merged.focus);
      // 윗칸이 사진이면 합치지 않고, 지워진 보이지 않는 글자를 되살린다.
      else commitWithFocus(blocks.map((item) => (item.id === id ? { ...item } : item)), { id, cursor: 0 });
      return;
    }
    if (change.kind === "split") {
      const selection = selections.current.get(id);
      const tail = Math.max(0, block.text.length - (selection?.end ?? block.text.length));
      const split = splitEditorText(blocks, id, change.lines, tail);
      if (split) commitWithFocus(split.blocks, split.focus);
      return;
    }
    const next = updateEditorText(blocks, id, change.text);
    if (change.sentinelLost) commitWithFocus(next, { id, cursor: change.text.length });
    else setBlocks(next);
  };

  /** 커서 자리(본문을 아직 안 눌렀으면 끝)에 사진을 넣는다. */
  const insertFiles = (files: File[]) => {
    const active = blocks.find((item) => item.id === activeId);
    const at =
      active && active.type === "text"
        ? { id: active.id, cursor: selections.current.get(active.id)?.start ?? active.text.length }
        : null;
    const result = insertEditorPhotos(blocks, at, files.map(toLocalComposerPhoto));
    remember(result.focus);
    setBlocks(result.blocks);
  };

  const removePhoto = (id: string) => {
    const target = blocks.find((item) => item.id === id);
    if (target?.type === "image" && target.photo.kind === "local") {
      URL.revokeObjectURL(target.photo.previewUrl);
    }
    const result = removeEditorPhoto(blocks, id);
    if (result.focus) remember(result.focus);
    setBlocks(result.blocks);
  };

  const toggleStyle = (style: "size" | "bold") => {
    if (!activeId) return;
    setBlocks(toggleEditorTextStyle(blocks, activeId, style));
    // 툴바를 눌러도 쓰던 줄에서 이어 쓸 수 있게 커서를 돌려놓는다.
    const selection = selections.current.get(activeId);
    pendingFocus.current = { id: activeId, cursor: selection?.start ?? 0 };
  };

  /** 위·아래 화살표: 이웃 글자 줄로 커서를 옮긴다(사진 칸은 건너뛴다). */
  const moveLine = (id: string, direction: -1 | 1) => {
    const index = blocks.findIndex((item) => item.id === id);
    for (let i = index + direction; i >= 0 && i < blocks.length; i += direction) {
      const target = blocks[i];
      if (target.type !== "text") continue;
      const focus = { id: target.id, cursor: direction < 0 ? target.text.length : 0 };
      remember(focus);
      placeCaret(focus, blocks);
      return true;
    }
    return false;
  };

  /** 본문 아래 빈 곳을 누르면 마지막 줄 끝에 커서를 둔다. */
  const focusEnd = () => {
    const last = blocks[blocks.length - 1];
    if (!last || last.type !== "text") return;
    const focus = { id: last.id, cursor: last.text.length };
    remember(focus);
    placeCaret(focus, blocks);
  };

  const active = blocks.find((item) => item.id === activeId);
  return {
    blocks,
    activeBlock: active?.type === "text" ? (active as EditorTextBlock) : null,
    photoCount: editorPhotoCount(blocks),
    textCount: countEditorText(blocks),
    toBody: () => editorBlocksToBody(blocks),
    changeLine,
    focusLine: setActiveId,
    selectLine: (id: string, selection: LineSelection) => selections.current.set(id, selection),
    registerInput: (id: string, el: HTMLTextAreaElement | null) => {
      if (el) inputs.current.set(id, el);
      else inputs.current.delete(id);
    },
    insertFiles,
    removePhoto,
    toggleStyle,
    moveLine,
    /** 제목 칸을 누르면 툴바의 크기·굵게가 본문 줄에 걸리지 않게 한다. */
    clearActive: () => setActiveId(null),
    focusEnd,
  };
}

export type PostBodyEditorState = ReturnType<typeof usePostBodyEditor>;

function TextLine({
  block,
  withSentinel,
  placeholder,
  disabled,
  editor,
}: {
  block: EditorTextBlock;
  withSentinel: boolean;
  placeholder?: string;
  disabled: boolean;
  editor: PostBodyEditorState;
}) {
  const ref = useRef<HTMLTextAreaElement | null>(null);
  const offset = withSentinel ? 1 : 0;
  const value = withSentinel ? `${LINE_SENTINEL}${block.text}` : block.text;

  // 줄은 내용에 맞춰 늘어난다.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value, block.size, block.bold]);

  const recordSelection = (el: HTMLTextAreaElement) => {
    // 보이지 않는 글자 앞에 커서가 서면 지우기로 윗줄과 합칠 수 없으니 뒤로 옮긴다.
    if (withSentinel && el.selectionStart === 0 && el.selectionEnd === 0) {
      el.setSelectionRange(1, 1);
    }
    editor.selectLine(block.id, {
      start: Math.max(0, el.selectionStart - offset),
      end: Math.max(0, el.selectionEnd - offset),
    });
  };

  return (
    <textarea
      ref={(el) => {
        ref.current = el;
        editor.registerInput(block.id, el);
      }}
      rows={1}
      value={value}
      disabled={disabled}
      placeholder={placeholder}
      aria-label={block.size === "large" ? "본문 큰 글씨 줄" : "본문 줄"}
      onFocus={() => editor.focusLine(block.id)}
      onSelect={(event) => recordSelection(event.currentTarget)}
      onChange={(event) =>
        editor.changeLine(block.id, interpretEditorLineChange(block.text, event.target.value, withSentinel))
      }
      onKeyDown={(event) => {
        if (event.nativeEvent.isComposing) return;
        const el = event.currentTarget;
        if (event.key === "ArrowUp" && el.selectionStart <= offset && el.selectionEnd <= offset) {
          if (editor.moveLine(block.id, -1)) event.preventDefault();
        } else if (event.key === "ArrowDown" && el.selectionStart === el.value.length) {
          if (editor.moveLine(block.id, 1)) event.preventDefault();
        }
      }}
      className={cn(
        "block w-full resize-none overflow-hidden border-0 bg-transparent p-0 text-app-text outline-none placeholder:text-app-caption focus:ring-0",
        block.size === "large" ? "text-[20px] leading-[30px]" : "text-[16px] leading-[26px]",
        block.bold ? "font-bold" : "font-normal"
      )}
    />
  );
}

export function PostBodyEditor({
  editor,
  disabled,
  placeholder,
}: {
  editor: PostBodyEditorState;
  disabled: boolean;
  placeholder: string;
}) {
  const { blocks } = editor;
  const first = blocks[0];
  const showPlaceholder = blocks.length === 1 && first?.type === "text" && !first.text;
  const imageIds = blocks.filter((block) => block.type === "image").map((block) => block.id);

  return (
    <div>
      {blocks.map((block, index) =>
        block.type === "image" ? (
          <div key={block.id} className="relative my-2 overflow-hidden rounded-md bg-app-placeholder">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={block.photo.kind === "remote" ? makeImageUrl(block.photo.id, "public") : block.photo.previewUrl}
              alt={`본문 사진 ${imageIds.indexOf(block.id) + 1}`}
              className="block h-auto max-h-[200vw] w-full object-cover"
            />
            <button
              type="button"
              aria-label={`본문 사진 ${imageIds.indexOf(block.id) + 1} 빼기`}
              disabled={disabled}
              onClick={() => editor.removePhoto(block.id)}
              className="absolute right-2 top-2 grid h-[22px] w-[22px] place-items-center rounded-full bg-app-inverse text-app-inverse-text"
            >
              <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" strokeWidth={2.5} strokeLinecap="round" />
              </svg>
            </button>
          </div>
        ) : (
          <TextLine
            key={block.id}
            block={block}
            withSentinel={index > 0}
            placeholder={showPlaceholder ? placeholder : undefined}
            disabled={disabled}
            editor={editor}
          />
        )
      )}
    </div>
  );
}

function ToolButton({
  label,
  selected,
  disabled,
  onClick,
  children,
}: {
  label: string;
  selected?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={selected === undefined ? undefined : selected}
      disabled={disabled}
      // 본문 줄의 포커스를 뺏지 않게 누르는 순간 기본 동작(포커스 이동)을 막는다.
      onMouseDown={(event) => event.preventDefault()}
      onClick={onClick}
      className={cn(
        "grid h-11 w-11 place-items-center",
        disabled ? "text-app-caption" : selected ? "text-app-brand" : "text-app-text"
      )}
    >
      {children}
    </button>
  );
}

/** 하단 툴바 버튼: 카메라 · 크기(보통 ↔ 크게) · 굵게. 아이콘 path 는 시안 그대로. */
export function PostBodyToolbarButtons({
  editor,
  disabled,
  onPickPhotos,
}: {
  editor: PostBodyEditorState;
  disabled: boolean;
  onPickPhotos: () => void;
}) {
  const styleDisabled = disabled || !editor.activeBlock;
  const stroke = { strokeWidth: 1.5, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return (
    <>
      <ToolButton label="사진 넣기" disabled={disabled} onClick={onPickPhotos}>
        <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
          <path
            d="M3 8.5A2.5 2.5 0 015.5 6h1.7a1 1 0 00.83-.45l.94-1.4A1 1 0 019.8 3.7h4.4a1 1 0 01.83.45l.94 1.4a1 1 0 00.83.45h1.7A2.5 2.5 0 0121 8.5v8A2.5 2.5 0 0118.5 19h-13A2.5 2.5 0 013 16.5v-8z"
            {...stroke}
          />
          <circle cx={12} cy={12.5} r={3.5} strokeWidth={1.5} />
        </svg>
      </ToolButton>
      <ToolButton
        label="글자 크게"
        selected={editor.activeBlock?.size === "large"}
        disabled={styleDisabled}
        onClick={() => editor.toggleStyle("size")}
      >
        <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
          <path d="M21 14h-5" {...stroke} />
          <path d="M16 16v-3.5a2.5 2.5 0 015 0V16" {...stroke} />
          <path d="M4.5 13h6" {...stroke} />
          <path d="M3 16l4.5-9 4.5 9" {...stroke} />
        </svg>
      </ToolButton>
      <ToolButton
        label="굵게"
        selected={Boolean(editor.activeBlock?.bold)}
        disabled={styleDisabled}
        onClick={() => editor.toggleStyle("bold")}
      >
        <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
          <path d="M14 12a4 4 0 000-8H6v8" {...stroke} />
          <path d="M15 20a4 4 0 000-8H6v8z" {...stroke} />
        </svg>
      </ToolButton>
    </>
  );
}

/** 저장된 본문을 에디터 기준으로 다시 쓴 값(옛 글은 사진 자리 표시가 붙는다). 수정 화면의 '바뀐 게 있나' 기준. */
export function normalizedPostBody(description: string, imageIds: readonly string[]) {
  return editorBlocksToBody(createEditorBlocks(description, imageIds, (id) => id));
}
