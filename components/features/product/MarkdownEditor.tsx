"use client";

import { useRef, useState } from "react";
import { cn } from "@libs/client/utils";
import MarkdownPreview from "./MarkdownPreview";

interface MarkdownEditorProps {
  id?: string;
  value: string;
  onChange: (nextValue: string) => void;
  placeholder?: string;
  rows?: number;
  /** 오류 상태면 테두리를 app-danger 로. */
  hasError?: boolean;
}

const DESCRIPTION_TEMPLATE = `## 개체 정보
- 종:
- 성별:
- 크기/중량:
- 우화일/입양일:

## 사육 상태
- 먹이:
- 사육 온도/습도:
- 특이사항:

## 거래 안내
- 거래 방식: (직거래/택배)
- 거래 가능 지역:
- 기타 안내:
`;

/** 툴바 칩(앱 MarkdownEditor ToolbarChip): h32 r16 px12 13/500, 비활성 0.4. */
function ToolbarChip({
  label,
  onClick,
  disabled,
  accent,
  active,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  accent?: boolean;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active === undefined ? undefined : active}
      className={cn(
        "inline-flex h-8 shrink-0 items-center justify-center whitespace-nowrap rounded-2xl border px-3 text-[13px] font-medium transition-opacity disabled:cursor-not-allowed disabled:opacity-40",
        active
          ? "border-app-inverse bg-app-inverse text-app-inverse-text"
          : cn("border-app-border bg-app-bg", accent ? "text-app-brand" : "text-app-text")
      )}
    >
      {label}
    </button>
  );
}

const MarkdownEditor = ({
  id,
  value,
  onChange,
  placeholder = "상품 설명을 입력해주세요",
  rows = 8,
  hasError = false,
}: MarkdownEditorProps) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [mode, setMode] = useState<"write" | "preview">("write");
  const isPreviewMode = mode === "preview";

  const updateValueWithSelection = (
    updater: (args: {
      selected: string;
      before: string;
      after: string;
    }) => {
      next: string;
      selectionStart?: number;
      selectionEnd?: number;
    }
  ) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const full = value || "";
    const before = full.slice(0, start);
    const selected = full.slice(start, end);
    const after = full.slice(end);

    const result = updater({ selected, before, after });
    onChange(result.next);

    requestAnimationFrame(() => {
      textarea.focus();
      if (
        typeof result.selectionStart === "number" &&
        typeof result.selectionEnd === "number"
      ) {
        textarea.setSelectionRange(result.selectionStart, result.selectionEnd);
      }
    });
  };

  const wrapSelection = (prefix: string, suffix = prefix, fallback = "텍스트") => {
    updateValueWithSelection(({ selected, before, after }) => {
      const body = selected || fallback;
      const wrapped = `${prefix}${body}${suffix}`;
      const selectionStart = before.length + prefix.length;
      const selectionEnd = selectionStart + body.length;
      return {
        next: `${before}${wrapped}${after}`,
        selectionStart,
        selectionEnd,
      };
    });
  };

  const prefixLine = (prefix: string) => {
    updateValueWithSelection(({ selected, before, after }) => {
      const target = selected || "내용";
      const lines = target.split("\n");
      const prefixed = lines.map((line) => `${prefix}${line}`).join("\n");
      const selectionStart = before.length;
      const selectionEnd = selectionStart + prefixed.length;
      return {
        next: `${before}${prefixed}${after}`,
        selectionStart,
        selectionEnd,
      };
    });
  };

  const insertTemplate = () => {
    const hasContent = Boolean(value.trim());
    const next = hasContent ? `${value}\n\n${DESCRIPTION_TEMPLATE}` : DESCRIPTION_TEMPLATE;
    onChange(next);
    setMode("write");
    requestAnimationFrame(() => textareaRef.current?.focus());
  };

  const editorMinHeight = Math.max(rows * 22, 180);

  // 앱과 같은 구성: 32px 칩 툴바 한 줄(가로 스크롤, 마지막 칩이 작성/미리보기 토글) + 입력칸.
  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-1.5 overflow-x-auto scrollbar-hide">
        <ToolbarChip label="굵게" disabled={isPreviewMode} onClick={() => wrapSelection("**")} />
        <ToolbarChip label="코드" disabled={isPreviewMode} onClick={() => wrapSelection("`")} />
        <ToolbarChip label="목록" disabled={isPreviewMode} onClick={() => prefixLine("- ")} />
        <ToolbarChip label="번호" disabled={isPreviewMode} onClick={() => prefixLine("1. ")} />
        <ToolbarChip label="제목" disabled={isPreviewMode} onClick={() => prefixLine("## ")} />
        <ToolbarChip
          label="링크"
          disabled={isPreviewMode}
          onClick={() => wrapSelection("[", "](https://)", "링크텍스트")}
        />
        <ToolbarChip label="템플릿" accent disabled={isPreviewMode} onClick={insertTemplate} />
        <ToolbarChip
          label={isPreviewMode ? "작성" : "미리보기"}
          active={isPreviewMode}
          onClick={() => setMode(isPreviewMode ? "write" : "preview")}
        />
      </div>

      {mode === "write" ? (
        <textarea
          id={id}
          ref={textareaRef}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          rows={rows}
          aria-invalid={hasError || undefined}
          style={{ minHeight: editorMinHeight }}
          className={cn(
            "w-full resize-y rounded-lg border bg-app-bg px-3.5 py-3 text-[15px] leading-[22px] text-app-text placeholder:text-app-caption focus:outline-none focus:ring-0",
            hasError ? "border-app-danger focus:border-app-danger" : "border-app-border focus:border-app-text"
          )}
        />
      ) : (
        <div
          style={{ minHeight: editorMinHeight, maxHeight: Math.max(editorMinHeight, 260) }}
          className={cn(
            "overflow-y-auto rounded-lg border bg-app-gap p-3.5",
            hasError ? "border-app-danger" : "border-app-border"
          )}
        >
          <MarkdownPreview content={value} emptyClassName="border-0 bg-transparent p-0" />
        </div>
      )}
    </div>
  );
};

export default MarkdownEditor;
