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
  type EditorBlock,
} from "@libs/shared/post-body-editor";

/** 앱 scripts/test-post-body.mjs 의 에디터 케이스와 같다(앱은 node --test 로 돈다). */
const shape = (blocks: EditorBlock<string>[]) =>
  blocks.map((b) =>
    b.type === "image"
      ? `[${b.photo}]`
      : `${b.size === "large" ? "#" : ""}${b.bold ? "*" : ""}${b.text}`
  );

const make = (description: string, images: string[] = []) =>
  createEditorBlocks(description, images, (id) => id);

describe("post-body-editor", () => {
  it("createEditorBlocks: 처음·끝·사진 사이에 글자 칸을 채운다", () => {
    expect(shape(make(""))).toEqual([""]);
    expect(shape(make("[[photo:1]]\n[[photo:2]]", ["a", "b"]))).toEqual(["", "[a]", "", "[b]", ""]);
    expect(shape(make("## **제목**\n본문\n[[photo:1]]\n끝", ["a"]))).toEqual(["#*제목", "본문", "[a]", "끝"]);
    expect(shape(make("옛 글", ["a"]))).toEqual(["옛 글", "[a]", ""]);
  });

  it("splitEditorText: 엔터는 커서 뒤 글자를 새 줄로 내린다", () => {
    const blocks = make("## 준비물과 순서");
    const mid = splitEditorText(blocks, blocks[0].id, ["준비물과", " 순서"], 3)!;
    expect(shape(mid.blocks)).toEqual(["#준비물과", "# 순서"]);
    expect(mid.focus).toEqual({ id: mid.blocks[1].id, cursor: 0 });
    const end = splitEditorText(blocks, blocks[0].id, ["준비물과 순서", ""], 0)!;
    expect(shape(end.blocks)).toEqual(["#준비물과 순서", ""]);
  });

  it("splitEditorText: 여러 줄 붙여넣기는 줄마다 칸, 커서는 붙여넣은 글자 끝", () => {
    const blocks = make("가나");
    const r = splitEditorText(blocks, blocks[0].id, ["가x", "y", "z나"], 1)!;
    expect(shape(r.blocks)).toEqual(["가x", "y", "z나"]);
    expect(r.focus).toEqual({ id: r.blocks[2].id, cursor: 1 });
  });

  it("mergeEditorTextWithPrevious: 윗줄과 합치고, 윗칸이 사진이면 그대로", () => {
    const blocks = make("**앞줄**\n뒷줄\n[[photo:1]]\n사진 뒤", ["a"]);
    const merged = mergeEditorTextWithPrevious(blocks, blocks[1].id)!;
    expect(shape(merged.blocks)).toEqual(["*앞줄뒷줄", "[a]", "사진 뒤"]);
    expect(merged.focus).toEqual({ id: blocks[0].id, cursor: 2 });
    expect(mergeEditorTextWithPrevious(blocks, blocks[3].id)).toBeNull();
    expect(mergeEditorTextWithPrevious(blocks, blocks[0].id)).toBeNull();
    const withEmpty = make("\n## 제목");
    const r = mergeEditorTextWithPrevious(withEmpty, withEmpty[1].id)!;
    expect(shape(r.blocks)).toEqual(["#제목"]);
  });

  it("insertEditorPhotos: 커서에서 줄을 나누고 사진 여러 장을 넣는다", () => {
    const blocks = make("## 앞글뒷글");
    const r = insertEditorPhotos(blocks, { id: blocks[0].id, cursor: 2 }, ["p1", "p2", "p3"]);
    expect(shape(r.blocks)).toEqual(["#앞글", "[p1]", "", "[p2]", "", "[p3]", "#뒷글"]);
    expect(r.focus).toEqual({ id: r.blocks[6].id, cursor: 0 });
    expect(shape(insertEditorPhotos(blocks, null, ["p1"]).blocks)).toEqual(["#앞글뒷글", "[p1]", ""]);
    expect(editorBlocksToBody(r.blocks)).toEqual({
      description: "## 앞글\n[[photo:1]]\n[[photo:2]]\n[[photo:3]]\n## 뒷글",
      images: ["p1", "p2", "p3"],
    });
  });

  it("removeEditorPhoto: 사진과 뒤 빈 줄을 빼고 커서는 앞 줄 끝", () => {
    const blocks = make("앞\n[[photo:1]]\n[[photo:2]]\n뒤", ["a", "b"]);
    const r = removeEditorPhoto(blocks, blocks[1].id);
    expect(shape(r.blocks)).toEqual(["앞", "[b]", "뒤"]);
    expect(r.focus).toEqual({ id: blocks[0].id, cursor: 1 });
  });

  it("toggleEditorTextStyle·countEditorText·editorPhotoCount", () => {
    const blocks = make("열 글자 이상 본문\n[[photo:1]]", ["a"]);
    const styled = toggleEditorTextStyle(toggleEditorTextStyle(blocks, blocks[0].id, "size"), blocks[0].id, "bold");
    expect(editorBlocksToBody(styled).description).toBe("## **열 글자 이상 본문**\n[[photo:1]]");
    expect(countEditorText(styled)).toBe(10);
    expect(editorPhotoCount(styled)).toBe(1);
  });

  it("수정 화면 왕복이 같다", () => {
    const description = "## **준비물**\n리빙박스\n\n[[photo:1]]\n바닥재 https://a.com\n[[photo:2]]";
    const once = editorBlocksToBody(make(description, ["a", "b"]));
    expect(editorBlocksToBody(make(once.description, once.images))).toEqual(once);
  });

  it("interpretEditorLineChange: 지우기·엔터·일반 입력", () => {
    expect(interpretEditorLineChange("본문", "본문", true)).toEqual({ kind: "merge" });
    expect(interpretEditorLineChange("본문", "본문", false)).toEqual({
      kind: "text",
      text: "본문",
      sentinelLost: false,
    });
    expect(interpretEditorLineChange("가나", `${LINE_SENTINEL}가\n나`, true)).toEqual({
      kind: "split",
      lines: ["가", "나"],
    });
    expect(interpretEditorLineChange("가나다", "x", true)).toEqual({ kind: "text", text: "x", sentinelLost: true });
  });
});
