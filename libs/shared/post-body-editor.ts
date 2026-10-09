/**
 * 게시글 블록 에디터의 순수 상태 규칙(줄 칸·사진 칸). 화면 코드 없이 블록 배열만 다룬다.
 * - 웹 `libs/shared/post-body-editor.ts` 와 같은 파일이다. 고칠 때는 두 곳을 같이 고치고
 *   웹 `npx jest postBodyEditor` + 앱 `npm run test:post-body` 로 확인한다.
 * - 사진 값은 플랫폼마다 다르다(앱: 원격 id·로컬 asset, 웹: 원격 id·File). 그래서 TPhoto 로 둔다.
 * - 저장 형식은 ./post-body 가 정한다(docs/prd/post-upload.md 3절).
 *
 * 블록 배열 불변식(normalizeEditorBlocks): 글자 칸이 처음과 끝에 있고, 사진 칸 사이에는 글자 칸이 있다.
 * 사진 옆 빈 글자 칸은 커서를 둘 자리일 뿐이라 저장하지 않는다.
 */
import {
  countPostBodyText,
  parsePostBody,
  serializePostBody,
  type PostBodyBlock,
  type PostBodyTextSize,
} from "./post-body";

export type EditorTextBlock = {
  id: string;
  type: "text";
  text: string;
  size: PostBodyTextSize;
  bold: boolean;
};

export type EditorImageBlock<TPhoto> = { id: string; type: "image"; photo: TPhoto };

export type EditorBlock<TPhoto> = EditorTextBlock | EditorImageBlock<TPhoto>;

/** 상태를 바꾼 뒤 커서를 둘 곳(글자 칸 id, 표시 기호 없는 글자 기준 위치). */
export type EditorFocus = { id: string; cursor: number };

let blockSeq = 0;
/** 블록 id. 렌더 중이 아니라 초기화·이벤트 처리에서만 부른다. */
export const newEditorBlockId = () => `pb-${(blockSeq++).toString(36)}`;

export const editorTextBlock = (
  text = "",
  style: Partial<Pick<EditorTextBlock, "size" | "bold">> = {}
): EditorTextBlock => ({
  id: newEditorBlockId(),
  type: "text",
  text,
  size: style.size ?? "normal",
  bold: style.bold ?? false,
});

/** 처음·끝 글자 칸, 사진 사이 글자 칸을 채운다. 이미 맞으면 같은 배열을 돌려준다. */
export function normalizeEditorBlocks<TPhoto>(
  blocks: readonly EditorBlock<TPhoto>[]
): EditorBlock<TPhoto>[] {
  const next: EditorBlock<TPhoto>[] = [];
  let changed = false;
  blocks.forEach((block, index) => {
    const prev = next[next.length - 1];
    if (block.type === "image" && (index === 0 || prev?.type === "image")) {
      next.push(editorTextBlock());
      changed = true;
    }
    next.push(block);
  });
  if (!next.length || next[next.length - 1].type === "image") {
    next.push(editorTextBlock());
    changed = true;
  }
  return changed ? next : (blocks as EditorBlock<TPhoto>[]);
}

/** 저장된 본문(또는 새 글의 빈 본문)으로 에디터 블록을 만든다. */
export function createEditorBlocks<TPhoto>(
  description: string,
  imageIds: readonly string[],
  toPhoto: (imageId: string) => TPhoto
): EditorBlock<TPhoto>[] {
  const blocks = parsePostBody(description, imageIds).map(
    (block): EditorBlock<TPhoto> =>
      block.type === "image"
        ? { id: newEditorBlockId(), type: "image", photo: toPhoto(block.image) }
        : editorTextBlock(block.text, block),
  );
  return normalizeEditorBlocks(blocks);
}

const indexOfBlock = <TPhoto>(blocks: readonly EditorBlock<TPhoto>[], id: string) =>
  blocks.findIndex((block) => block.id === id);

export function updateEditorText<TPhoto>(
  blocks: readonly EditorBlock<TPhoto>[],
  id: string,
  text: string
): EditorBlock<TPhoto>[] {
  return blocks.map((block) =>
    block.id === id && block.type === "text" ? { ...block, text } : block
  );
}

/**
 * 줄 칸 하나가 여러 줄이 됐을 때(엔터·여러 줄 붙여넣기) 줄마다 칸으로 나눈다.
 * - 첫 줄은 원래 칸(같은 id·스타일)에 남는다.
 * - 가운데 줄은 보통 스타일. 마지막 줄은 커서 뒤 글자(tailLength > 0)가 있으면 원래 스타일을 잇고, 없으면 보통.
 * - 커서는 마지막 줄의 '커서 뒤 글자' 바로 앞.
 */
export function splitEditorText<TPhoto>(
  blocks: readonly EditorBlock<TPhoto>[],
  id: string,
  lines: readonly string[],
  tailLength: number
): { blocks: EditorBlock<TPhoto>[]; focus: EditorFocus } | null {
  const index = indexOfBlock(blocks, id);
  const current = blocks[index];
  if (!current || current.type !== "text" || lines.length < 2) return null;
  const created = lines.slice(1).map((line, i) => {
    const isLast = i === lines.length - 2;
    return isLast && tailLength > 0 ? editorTextBlock(line, current) : editorTextBlock(line);
  });
  const last = created[created.length - 1];
  const next = [
    ...blocks.slice(0, index),
    { ...current, text: lines[0] },
    ...created,
    ...blocks.slice(index + 1),
  ];
  return {
    blocks: next,
    focus: { id: last.id, cursor: Math.max(0, last.text.length - tailLength) },
  };
}

/**
 * 줄 칸 맨 앞에서 지우기. 윗칸이 글자면 합치고, 사진이거나 없으면 아무것도 하지 않는다(null).
 * 윗줄이 비어 있으면 윗줄을 지워 지금 줄의 스타일을 남긴다.
 */
export function mergeEditorTextWithPrevious<TPhoto>(
  blocks: readonly EditorBlock<TPhoto>[],
  id: string
): { blocks: EditorBlock<TPhoto>[]; focus: EditorFocus } | null {
  const index = indexOfBlock(blocks, id);
  const current = blocks[index];
  const prev = blocks[index - 1];
  if (!current || current.type !== "text" || !prev || prev.type !== "text") return null;
  if (!prev.text.length) {
    return {
      blocks: [...blocks.slice(0, index - 1), ...blocks.slice(index)],
      focus: { id: current.id, cursor: 0 },
    };
  }
  return {
    blocks: [
      ...blocks.slice(0, index - 1),
      { ...prev, text: prev.text + current.text },
      ...blocks.slice(index + 1),
    ],
    focus: { id: prev.id, cursor: prev.text.length },
  };
}

/**
 * 커서 자리에 사진을 넣는다. 커서가 없으면(본문을 아직 안 눌렀으면) 본문 끝에 넣는다.
 * 글자 칸은 커서에서 앞·뒤로 나뉘고, 뒤 칸이 다음 커서 자리다.
 */
export function insertEditorPhotos<TPhoto>(
  blocks: readonly EditorBlock<TPhoto>[],
  at: EditorFocus | null,
  photos: readonly TPhoto[]
): { blocks: EditorBlock<TPhoto>[]; focus: EditorFocus } {
  const images = photos.map(
    (photo): EditorImageBlock<TPhoto> => ({ id: newEditorBlockId(), type: "image", photo })
  );
  const index = at ? indexOfBlock(blocks, at.id) : -1;
  const current = blocks[index];
  if (!at || !current || current.type !== "text") {
    const after = editorTextBlock();
    return {
      blocks: normalizeEditorBlocks([...blocks, ...images, after]),
      focus: { id: after.id, cursor: 0 },
    };
  }
  const cursor = Math.min(Math.max(at.cursor, 0), current.text.length);
  const tail = current.text.slice(cursor);
  const after = tail.length ? editorTextBlock(tail, current) : editorTextBlock();
  return {
    blocks: normalizeEditorBlocks([
      ...blocks.slice(0, index),
      { ...current, text: current.text.slice(0, cursor) },
      ...images,
      after,
      ...blocks.slice(index + 1),
    ]),
    focus: { id: after.id, cursor: 0 },
  };
}

/** 사진 칸을 뺀다. 뒤 글자 칸이 비어 있으면 같이 지우고, 커서는 앞 글자 칸 끝. */
export function removeEditorPhoto<TPhoto>(
  blocks: readonly EditorBlock<TPhoto>[],
  id: string
): { blocks: EditorBlock<TPhoto>[]; focus: EditorFocus | null } {
  const index = indexOfBlock(blocks, id);
  if (index < 0 || blocks[index].type !== "image") return { blocks: [...blocks], focus: null };
  const prev = blocks[index - 1];
  const next = blocks[index + 1];
  const dropNext = prev?.type === "text" && next?.type === "text" && !next.text.length;
  const remaining = [
    ...blocks.slice(0, index),
    ...blocks.slice(index + (dropNext ? 2 : 1)),
  ];
  return {
    blocks: normalizeEditorBlocks(remaining),
    focus: prev?.type === "text" ? { id: prev.id, cursor: prev.text.length } : null,
  };
}

/** 커서가 있는 줄의 크기(보통 ↔ 크게)나 굵게를 바꾼다. */
export function toggleEditorTextStyle<TPhoto>(
  blocks: readonly EditorBlock<TPhoto>[],
  id: string,
  style: "size" | "bold"
): EditorBlock<TPhoto>[] {
  return blocks.map((block) => {
    if (block.id !== id || block.type !== "text") return block;
    return style === "size"
      ? { ...block, size: block.size === "large" ? "normal" : "large" }
      : { ...block, bold: !block.bold };
  });
}

const toBodyBlocks = <TPhoto>(blocks: readonly EditorBlock<TPhoto>[]): PostBodyBlock<TPhoto>[] =>
  blocks.map((block) =>
    block.type === "image"
      ? { type: "image", image: block.photo }
      : { type: "text", text: block.text, size: block.size, bold: block.bold }
  );

/** 저장할 본문과 본문 순서의 사진 목록. */
export function editorBlocksToBody<TPhoto>(
  blocks: readonly EditorBlock<TPhoto>[]
): { description: string; images: TPhoto[] } {
  return serializePostBody(toBodyBlocks(blocks));
}

/** 검증용 글자 수(표시 기호 제외). */
export function countEditorText<TPhoto>(blocks: readonly EditorBlock<TPhoto>[]): number {
  return countPostBodyText(editorBlocksToBody(blocks).description);
}

export function editorPhotoCount<TPhoto>(blocks: readonly EditorBlock<TPhoto>[]): number {
  return blocks.filter((block) => block.type === "image").length;
}

/**
 * 줄 칸 입력값 앞에 두는 보이지 않는 글자. 줄 맨 앞에서 지우기를 누르면 이 글자가 지워지는 것으로
 * '윗줄과 합치기'를 알아챈다(안드로이드 키보드마다 빈 칸의 지우기 키 이벤트가 오지 않을 수 있어서).
 * 첫 줄은 합칠 윗줄이 없으니 쓰지 않는다(placeholder 도 보이게).
 */
export const LINE_SENTINEL = "​";

export type EditorLineChange =
  | { kind: "merge" }
  | { kind: "split"; lines: string[] }
  | { kind: "text"; text: string; sentinelLost: boolean };

/** 줄 칸 입력값의 변화를 해석한다. 값을 바꾸는 건 엔터·지우기 경계뿐이라 한글 조합 중에는 그대로 둔다. */
export function interpretEditorLineChange(
  prevText: string,
  nextValue: string,
  withSentinel: boolean
): EditorLineChange {
  const raw = nextValue.split(LINE_SENTINEL).join("");
  const hasSentinel = nextValue.includes(LINE_SENTINEL);
  if (withSentinel && !hasSentinel && raw === prevText) return { kind: "merge" };
  if (/\r|\n/.test(raw)) return { kind: "split", lines: raw.split(/\r\n?|\n/) };
  return { kind: "text", text: raw, sentinelLost: withSentinel && !nextValue.startsWith(LINE_SENTINEL) };
}
