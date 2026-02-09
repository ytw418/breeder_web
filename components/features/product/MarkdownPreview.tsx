"use client";

import React, { Fragment } from "react";
import Link from "next/link";
import { cn } from "@libs/client/utils";

interface MarkdownPreviewProps {
  content: string;
  className?: string;
  emptyText?: string;
}

const linkPattern = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/;
const boldPattern = /\*\*([^*]+)\*\*/;
const codePattern = /`([^`]+)`/;

const renderInline = (text: string, keyPrefix: string): React.ReactNode[] => {
  const nodes: React.ReactNode[] = [];
  let remaining = text;
  let index = 0;

  const combinedPattern = new RegExp(
    `${linkPattern.source}|${boldPattern.source}|${codePattern.source}`
  );

  while (remaining.length > 0) {
    const match = combinedPattern.exec(remaining);
    if (!match) {
      nodes.push(
        <Fragment key={`${keyPrefix}-plain-${index}`}>{remaining}</Fragment>
      );
      break;
    }

    const fullMatch = match[0];
    const matchIndex = match.index;
    const [before] = [remaining.slice(0, matchIndex)];

    if (before) {
      nodes.push(
        <Fragment key={`${keyPrefix}-before-${index}`}>{before}</Fragment>
      );
      index += 1;
    }

    const linkMatch = fullMatch.match(linkPattern);
    const boldMatch = fullMatch.match(boldPattern);
    const codeMatch = fullMatch.match(codePattern);

    if (linkMatch) {
      const [, label, href] = linkMatch;
      nodes.push(
        <Link
          key={`${keyPrefix}-link-${index}`}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary underline underline-offset-2 break-all"
        >
          {label}
        </Link>
      );
    } else if (boldMatch) {
      nodes.push(
        <strong key={`${keyPrefix}-bold-${index}`} className="font-semibold">
          {boldMatch[1]}
        </strong>
      );
    } else if (codeMatch) {
      nodes.push(
        <code
          key={`${keyPrefix}-code-${index}`}
          className="px-1.5 py-0.5 rounded bg-gray-100 text-[13px] font-mono"
        >
          {codeMatch[1]}
        </code>
      );
    }

    remaining = remaining.slice(matchIndex + fullMatch.length);
    index += 1;
  }

  return nodes;
};

const renderParagraph = (text: string, keyPrefix: string) => {
  const lines = text.split("\n");
  return lines.map((line, lineIndex) => (
    <Fragment key={`${keyPrefix}-line-${lineIndex}`}>
      {renderInline(line, `${keyPrefix}-inline-${lineIndex}`)}
      {lineIndex < lines.length - 1 && <br />}
    </Fragment>
  ));
};

const isHeading = (line: string) => /^#{1,3}\s+/.test(line);
const isUnordered = (line: string) => /^[-*]\s+/.test(line);
const isOrdered = (line: string) => /^\d+\.\s+/.test(line);

const MarkdownPreview = ({
  content,
  className,
  emptyText = "설명을 입력하면 이곳에 미리보기가 표시됩니다.",
}: MarkdownPreviewProps) => {
  const markdown = content?.trim() ?? "";

  if (!markdown) {
    return (
      <div
        className={cn(
          "rounded-xl border border-dashed border-gray-200 bg-gray-50 p-4 text-sm text-gray-400",
          className
        )}
      >
        {emptyText}
      </div>
    );
  }

  const lines = markdown.split("\n");
  const blocks: React.ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) {
      i += 1;
      continue;
    }

    if (isHeading(line)) {
      const level = line.match(/^#+/)?.[0].length ?? 1;
      const text = line.replace(/^#{1,3}\s+/, "").trim();
      const headingClass =
        level === 1
          ? "text-lg font-bold"
          : level === 2
          ? "text-base font-bold"
          : "text-sm font-semibold";
      blocks.push(
        <h3 key={`heading-${i}`} className={cn("text-gray-900", headingClass)}>
          {renderInline(text, `heading-${i}`)}
        </h3>
      );
      i += 1;
      continue;
    }

    if (isUnordered(line)) {
      const items: string[] = [];
      while (i < lines.length && isUnordered(lines[i])) {
        items.push(lines[i].replace(/^[-*]\s+/, ""));
        i += 1;
      }
      blocks.push(
        <ul
          key={`ul-${i}`}
          className="list-disc pl-5 space-y-1 text-sm text-gray-700"
        >
          {items.map((item, idx) => (
            <li key={`ul-item-${idx}`}>
              {renderInline(item, `ul-${i}-${idx}`)}
            </li>
          ))}
        </ul>
      );
      continue;
    }

    if (isOrdered(line)) {
      const items: string[] = [];
      while (i < lines.length && isOrdered(lines[i])) {
        items.push(lines[i].replace(/^\d+\.\s+/, ""));
        i += 1;
      }
      blocks.push(
        <ol
          key={`ol-${i}`}
          className="list-decimal pl-5 space-y-1 text-sm text-gray-700"
        >
          {items.map((item, idx) => (
            <li key={`ol-item-${idx}`}>
              {renderInline(item, `ol-${i}-${idx}`)}
            </li>
          ))}
        </ol>
      );
      continue;
    }

    const paragraphLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !isHeading(lines[i]) &&
      !isUnordered(lines[i]) &&
      !isOrdered(lines[i])
    ) {
      paragraphLines.push(lines[i]);
      i += 1;
    }

    blocks.push(
      <p key={`p-${i}`} className="text-sm text-gray-700 leading-relaxed">
        {renderParagraph(paragraphLines.join("\n"), `p-${i}`)}
      </p>
    );
  }

  return <div className={cn("space-y-3", className)}>{blocks}</div>;
};

export default MarkdownPreview;
