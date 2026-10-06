import {
  canSubmitPost,
  filterPickedPhotos,
  getPostMenuActionKeys,
  hasComposerChanges,
  isNoticePost,
  validatePostForm,
  type ComposerPhoto,
  type PostComposerInitial,
} from "@/app/(web)/posts/_lib/postComposer";

const values = (over: Partial<Parameters<typeof validatePostForm>[0]> = {}) => ({
  title: "제목입니다",
  description: "열 글자 이상의 본문입니다.",
  category: "자유",
  species: "",
  ...over,
});

const file = (name: string, type: string, size = 1000) => {
  const f = new File(["x"], name, { type });
  Object.defineProperty(f, "size", { value: size });
  return f;
};

describe("validatePostForm", () => {
  it("passes valid input", () => {
    expect(validatePostForm(values())).toEqual({});
  });
  it("uses app copy for each rule", () => {
    expect(validatePostForm(values({ category: "" })).category).toBe("카테고리를 선택해주세요.");
    expect(validatePostForm(values({ title: "  " })).title).toBe("제목을 입력해주세요.");
    expect(validatePostForm(values({ title: "가" })).title).toBe("제목은 2자 이상 입력해주세요.");
    expect(validatePostForm(values({ title: "가".repeat(81) })).title).toBe(
      "제목은 80자 이하로 입력해주세요."
    );
    expect(validatePostForm(values({ description: "" })).description).toBe("내용을 입력해주세요.");
    expect(validatePostForm(values({ description: "짧아" })).description).toBe(
      "내용을 10자 이상 입력해주세요."
    );
    expect(validatePostForm(values({ description: "가".repeat(2001) })).description).toBe(
      "내용은 2000자 이하로 입력해주세요."
    );
  });
});

describe("hasComposerChanges / canSubmitPost", () => {
  const initial: PostComposerInitial = { ...values(), postId: 1, imageIds: ["a", "b"] };
  const remote = (id: string): ComposerPhoto => ({ kind: "remote", key: id, id });

  it("create: dirty when anything typed or photo attached", () => {
    expect(hasComposerChanges(values({ title: "", description: "" }), [], null)).toBe(false);
    expect(hasComposerChanges(values({ title: "a", description: "" }), [], null)).toBe(true);
    expect(hasComposerChanges(values({ title: "", description: "" }), [remote("a")], null)).toBe(true);
  });

  it("edit: unchanged when same values and same remote photos in order", () => {
    expect(hasComposerChanges(values(), [remote("a"), remote("b")], initial)).toBe(false);
    expect(hasComposerChanges(values(), [remote("b"), remote("a")], initial)).toBe(true);
    expect(hasComposerChanges(values(), [remote("a")], initial)).toBe(true);
    expect(hasComposerChanges(values({ species: "곤충" }), [remote("a"), remote("b")], initial)).toBe(
      true
    );
  });

  it("submit requires category/title/body, and a change in edit mode", () => {
    expect(canSubmitPost({ values: values(), submitting: false, isEdit: false, changed: true })).toBe(true);
    expect(canSubmitPost({ values: values({ category: "" }), submitting: false, isEdit: false, changed: true })).toBe(false);
    expect(canSubmitPost({ values: values(), submitting: true, isEdit: false, changed: true })).toBe(false);
    expect(canSubmitPost({ values: values(), submitting: false, isEdit: true, changed: false })).toBe(false);
  });
});

describe("filterPickedPhotos", () => {
  it("drops non-images and >10MB files and caps at 10 total", () => {
    const result = filterPickedPhotos(
      [file("a.png", "image/png"), file("b.txt", "text/plain"), file("c.jpg", "image/jpeg", 11 * 1024 * 1024)],
      0
    );
    expect(result.accepted.map((f) => f.name)).toEqual(["a.png"]);
    expect(result.invalidType).toBe(true);
    expect(result.oversized).toBe(true);
    expect(result.overflow).toBe(false);

    const capped = filterPickedPhotos([file("a.png", "image/png"), file("b.png", "image/png")], 9);
    expect(capped.accepted).toHaveLength(1);
    expect(capped.overflow).toBe(true);
  });
});

describe("post menu", () => {
  it("own post: edit/delete first", () => {
    expect(getPostMenuActionKeys({ isOwn: true, isNotice: false, hasAuthor: true, authorBlocked: false })).toEqual([
      "edit",
      "delete",
      "share",
      "copy-link",
    ]);
  });
  it("notice: share/copy only, even for own", () => {
    expect(getPostMenuActionKeys({ isOwn: true, isNotice: true, hasAuthor: true, authorBlocked: false })).toEqual([
      "share",
      "copy-link",
    ]);
    expect(getPostMenuActionKeys({ isOwn: false, isNotice: true, hasAuthor: true, authorBlocked: false })).toEqual([
      "share",
      "copy-link",
    ]);
  });
  it("others: report + block (block hidden when already blocked)", () => {
    expect(getPostMenuActionKeys({ isOwn: false, isNotice: false, hasAuthor: true, authorBlocked: false })).toEqual([
      "share",
      "copy-link",
      "report",
      "block",
    ]);
    expect(getPostMenuActionKeys({ isOwn: false, isNotice: false, hasAuthor: true, authorBlocked: true })).toEqual([
      "share",
      "copy-link",
      "report",
    ]);
  });
  it("isNoticePost", () => {
    expect(isNoticePost({ category: "공지", title: "x" })).toBe(true);
    expect(isNoticePost({ category: "자유", title: "[공지] x" })).toBe(true);
    expect(isNoticePost({ category: "자유", title: "x" })).toBe(false);
  });
});
