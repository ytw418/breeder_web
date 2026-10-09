/**
 * 게시글 본문(description) 형식 — 사진·글 블록.
 * - 앱 `src/lib/post-body.ts` 와 같은 파일이다. 고칠 때는 두 곳을 같이 고치고
 *   웹 `npx jest postBody` + 앱 `npm run test:post-body`(같은 케이스 JSON)로 확인한다.
 * - 플랫폼 import 를 두지 않는다. 앱 테스트가 Node 타입 스트리핑으로 돌리므로 enum·namespace 를 쓰지 않는다.
 *
 * 저장은 일반 텍스트이고 줄마다 뜻이 있다(docs/prd/post-upload.md 3절).
 * - `[[photo:N]]` 줄 전체 = images[N-1] 사진 자리(N 은 1부터). 범위 밖·중복이면 글자 줄
 * - `## ` 로 시작 = 크게, 줄 전체가 `**…**` = 굵게, 둘 다면 `## **…**`
 * - 위 표시처럼 보이는 사용자 글자는 앞에 `\` 를 하나 붙여 저장하고, 읽을 때 하나를 뗀다.
 * - images 순서 = 본문 등장 순서, 자리 표시가 없는 사진은 그 뒤(대표 = images[0]).
 */

export type PostBodyTextSize = "normal" | "large";

export type PostBodyTextBlock = {
  type: "text";
  text: string;
  size: PostBodyTextSize;
  bold: boolean;
};

export type PostBodyImageBlock<TImage = string> = { type: "image"; image: TImage };

export type PostBodyBlock<TImage = string> = PostBodyTextBlock | PostBodyImageBlock<TImage>;

/** 파싱 결과의 사진 칸은 images 안의 위치(뷰어 시작 장)를 함께 갖는다. */
export type ParsedPostBodyBlock =
  | PostBodyTextBlock
  | { type: "image"; image: string; imageIndex: number };

export const POST_BODY_TEXT_MIN = 10;
export const POST_BODY_TEXT_MAX = 2000;
/** 표시 기호까지 포함한 저장 문자열 상한(사진 10장·줄 표시 여유분). */
export const POST_BODY_RAW_MAX = 4000;

const LARGE_PREFIX = "## ";
const PHOTO_LINE = /^\[\[photo:([1-9]\d*)\]\]$/;
const BOLD_LINE = /^\*\*(.+)\*\*$/;
/** 표시로 읽힐 글자(앞에 백슬래시가 몇 개 있든). 저장할 때 백슬래시 하나를 더 붙인다. */
const NEEDS_ESCAPE = /^\\*(## |\*\*.+\*\*$|\[\[photo:[1-9]\d*\]\]$)/;
/** 백슬래시로 감싼 표시. 읽을 때 백슬래시 하나를 뗀다. */
const ESCAPED = /^\\+(## |\*\*.+\*\*$|\[\[photo:[1-9]\d*\]\]$)/;

const toLines = (description: string) => description.replace(/\r\n?/g, "\n").split("\n");

const photoNumberOf = (line: string): number | null => {
  const match = PHOTO_LINE.exec(line);
  return match ? Number(match[1]) : null;
};

/** 글자 줄 하나를 스타일과 글자로 나눈다(사진 줄 판정은 호출하는 쪽에서 먼저 한다). */
const parseTextLine = (line: string): PostBodyTextBlock => {
  let rest = line;
  let size: PostBodyTextSize = "normal";
  if (rest.startsWith(LARGE_PREFIX)) {
    size = "large";
    rest = rest.slice(LARGE_PREFIX.length);
  }
  if (ESCAPED.test(rest)) {
    return { type: "text", text: rest.slice(1), size, bold: false };
  }
  const bold = BOLD_LINE.exec(rest);
  if (bold) return { type: "text", text: bold[1], size, bold: true };
  return { type: "text", text: rest, size, bold: false };
};

/**
 * 저장된 본문을 블록으로 읽는다. 자리 표시가 없는 사진(옛 글·웹에서 붙인 사진)은 끝에 순서대로 붙인다.
 */
export function parsePostBody(description: string, images: readonly string[]): ParsedPostBodyBlock[] {
  const blocks: ParsedPostBodyBlock[] = [];
  const used = new Set<number>();
  const source = description ?? "";
  if (source.length) {
    for (const line of toLines(source)) {
      const n = photoNumberOf(line);
      if (n !== null && n <= images.length && !used.has(n)) {
        used.add(n);
        blocks.push({ type: "image", image: images[n - 1], imageIndex: n - 1 });
        continue;
      }
      blocks.push(parseTextLine(line));
    }
  }
  images.forEach((image, imageIndex) => {
    if (!used.has(imageIndex + 1)) blocks.push({ type: "image", image, imageIndex });
  });
  return blocks;
}

const escapeText = (text: string) => (NEEDS_ESCAPE.test(text) ? `\\${text}` : text);

const serializeTextLine = (block: PostBodyTextBlock, text: string) => {
  if (!text.length) return "";
  const body = block.bold ? `**${text}**` : escapeText(text);
  return block.size === "large" ? `${LARGE_PREFIX}${body}` : body;
};

/**
 * 블록을 저장 형식으로 만든다. 사진은 등장 순서로 1부터 번호를 다시 매기고 images 도 그 순서다.
 * 사진 칸 바로 앞·뒤의 빈 줄과 문서 앞뒤의 빈 줄은 저장하지 않는다.
 */
export function serializePostBody<TImage>(
  blocks: readonly PostBodyBlock<TImage>[]
): { description: string; images: TImage[] } {
  const images: TImage[] = [];
  const lines: string[] = [];
  blocks.forEach((block, index) => {
    if (block.type === "image") {
      images.push(block.image);
      lines.push(`[[photo:${images.length}]]`);
      return;
    }
    // 블록 글자에 줄바꿈이 섞여 와도 줄마다 같은 스타일로 나눠 저장한다.
    const parts = block.text.split(/\r\n?|\n/);
    const isEmpty = parts.every((part) => !part.length);
    if (isEmpty) {
      const prev = blocks[index - 1];
      const next = blocks[index + 1];
      if (prev?.type === "image" || next?.type === "image") return;
      lines.push("");
      return;
    }
    for (const part of parts) lines.push(serializeTextLine(block, part));
  });
  while (lines.length && lines[0] === "") lines.shift();
  while (lines.length && lines[lines.length - 1] === "") lines.pop();
  return { description: lines.join("\n"), images };
}

/** 표시 기호를 뺀 글자 줄들(사진 줄은 빠진다). */
const textLinesOf = (description: string) =>
  toLines(description ?? "")
    .filter((line) => photoNumberOf(line) === null)
    .map((line) => parseTextLine(line).text);

/** 목록 미리보기·검색 결과·OG·신고 발췌용 한 줄 글자. */
export function toPostPlainText(description: string): string {
  return textLinesOf(description).join(" ").replace(/\s+/g, " ").trim();
}

/** 검증용 글자 수. 표시 기호를 뺀 글자 줄을 줄바꿈으로 이어 trim 한 길이(옛 평문 글은 trim 길이와 같다). */
export function countPostBodyText(description: string): number {
  return textLinesOf(description).join("\n").trim().length;
}

/** http(s) 링크 경계. 끝에 붙은 문장부호와 한글은 링크에 넣지 않는다. */
const LINK_SOURCE = "https?:\\/\\/[A-Za-z0-9\\-._~:/?#[\\]@!$&'()*+,;=%]+";
const LINK_TRAILING = /[.,;:!?)\]'"]+$/;

export type PostBodyTextPart = { type: "text" | "link"; value: string };

export function splitLinks(text: string): PostBodyTextPart[] {
  const parts: PostBodyTextPart[] = [];
  // matchAll 반복자는 ES5 대상 빌드(jest)에서 for…of 로 돌지 않아 exec 로 돈다.
  const link = new RegExp(LINK_SOURCE, "g");
  let cursor = 0;
  let match: RegExpExecArray | null;
  while ((match = link.exec(text)) !== null) {
    const start = match.index;
    const url = match[0].replace(LINK_TRAILING, "");
    // 문장부호를 떼고 나니 주소가 비면("https://." 등) 글자로 둔다.
    if (!/^https?:\/\/[^/]/.test(url)) continue;
    if (start > cursor) parts.push({ type: "text", value: text.slice(cursor, start) });
    parts.push({ type: "link", value: url });
    cursor = start + url.length;
  }
  if (cursor < text.length) parts.push({ type: "text", value: text.slice(cursor) });
  return parts;
}

export type PostDescriptionErrorCode =
  | "POST_DESCRIPTION_TOO_SHORT"
  | "POST_DESCRIPTION_TOO_LONG"
  | "POST_BODY_INVALID_PHOTO";

export type PostDescriptionCheck =
  | { ok: true }
  | { ok: false; errorCode: PostDescriptionErrorCode; message: string };

/** 서버·클라 공용 본문 검증. 빈 값(필수)은 호출하는 쪽이 먼저 막는다. */
export function validatePostDescription(description: string, imageCount: number): PostDescriptionCheck {
  const count = countPostBodyText(description);
  if (count < POST_BODY_TEXT_MIN) {
    return {
      ok: false,
      errorCode: "POST_DESCRIPTION_TOO_SHORT",
      message: `내용을 ${POST_BODY_TEXT_MIN}자 이상 입력해주세요.`,
    };
  }
  if (count > POST_BODY_TEXT_MAX || description.length > POST_BODY_RAW_MAX) {
    return {
      ok: false,
      errorCode: "POST_DESCRIPTION_TOO_LONG",
      message: `내용은 ${POST_BODY_TEXT_MAX}자 이하로 입력해주세요.`,
    };
  }
  const seen = new Set<number>();
  for (const line of toLines(description)) {
    const n = photoNumberOf(line);
    if (n === null) continue;
    if (n > imageCount || seen.has(n)) {
      return { ok: false, errorCode: "POST_BODY_INVALID_PHOTO", message: "사진 정보가 올바르지 않습니다." };
    }
    seen.add(n);
  }
  return { ok: true };
}

/** images[index] 를 뺄 때 본문의 사진 줄을 지우고 뒤 번호를 하나씩 당긴다(웹 글쓰기 사진 X). */
export function removePostBodyImage(description: string, index: number): string {
  const removed = index + 1;
  const lines: string[] = [];
  for (const line of toLines(description)) {
    const n = photoNumberOf(line);
    if (n === removed) continue;
    lines.push(n !== null && n > removed ? `[[photo:${n - 1}]]` : line);
  }
  return lines.join("\n");
}
