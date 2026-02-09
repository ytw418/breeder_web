"use client";

import { useRef, useState } from "react";
import { cn } from "@libs/client/utils";
import { Textarea } from "@components/ui/textarea";
import MarkdownPreview from "./MarkdownPreview";

interface MarkdownEditorProps {
  id?: string;
  value: string;
  onChange: (nextValue: string) => void;
  placeholder?: string;
  rows?: number;
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

const toolbarButtonClass =
  "px-2.5 py-1.5 text-xs rounded-md border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white";

const modeButtonClass =
  "px-3 py-1.5 text-xs font-semibold rounded-md transition-colors";

const MarkdownEditor = ({
  id,
  value,
  onChange,
  placeholder = "상품 설명을 입력해주세요",
  rows = 8,
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

  return (
    <div className="rounded-xl border border-gray-200 bg-white">
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-gray-100 bg-gray-50 rounded-t-xl">
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={() => wrapSelection("**")}
            disabled={isPreviewMode}
            className={toolbarButtonClass}
          >
            굵게
          </button>
          <button
            type="button"
            onClick={() => wrapSelection("`")}
            disabled={isPreviewMode}
            className={toolbarButtonClass}
          >
            코드
          </button>
          <button
            type="button"
            onClick={() => prefixLine("- ")}
            disabled={isPreviewMode}
            className={toolbarButtonClass}
          >
            목록
          </button>
          <button
            type="button"
            onClick={() => prefixLine("1. ")}
            disabled={isPreviewMode}
            className={toolbarButtonClass}
          >
            번호
          </button>
          <button
            type="button"
            onClick={() => prefixLine("## ")}
            disabled={isPreviewMode}
            className={toolbarButtonClass}
          >
            제목
          </button>
          <button
            type="button"
            onClick={() => wrapSelection("[", "](https://)", "링크텍스트")}
            disabled={isPreviewMode}
            className={toolbarButtonClass}
          >
            링크
          </button>
          <button
            type="button"
            onClick={insertTemplate}
            disabled={isPreviewMode}
            className={cn(toolbarButtonClass, "text-primary border-primary/20")}
          >
            템플릿
          </button>
        </div>

        <div className="inline-flex rounded-lg bg-white border border-gray-200 p-0.5">
          <button
            type="button"
            onClick={() => setMode("write")}
            className={cn(
              modeButtonClass,
              mode === "write" ? "bg-gray-900 text-white" : "text-gray-500"
            )}
          >
            작성
          </button>
          <button
            type="button"
            onClick={() => setMode("preview")}
            className={cn(
              modeButtonClass,
              mode === "preview" ? "bg-gray-900 text-white" : "text-gray-500"
            )}
          >
            미리보기
          </button>
        </div>
      </div>

      <div className="p-3">
        {mode === "write" ? (
          <Textarea
            id={id}
            ref={textareaRef}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder={placeholder}
            rows={rows}
            className="min-h-[180px] focus-visible:ring-1"
          />
        ) : (
          <MarkdownPreview
            content={value}
            className="min-h-[180px] rounded-lg border border-gray-100 bg-gray-50 p-4"
          />
        )}
      </div>
    </div>
  );
};

export default MarkdownEditor;
