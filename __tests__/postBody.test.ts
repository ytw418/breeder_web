import fs from "fs";
import path from "path";

import {
  countPostBodyText,
  parsePostBody,
  removePostBodyImage,
  serializePostBody,
  splitLinks,
  toPostPlainText,
  validatePostDescription,
  type ParsedPostBodyBlock,
  type PostBodyBlock,
} from "@libs/shared/post-body";

/** 앱 scripts/fixtures/post-body-cases.json 과 같은 파일이다(앱은 node --test 로 같은 케이스를 돈다). */
type Case = {
  name: string;
  description: string;
  images: string[];
  blocks: ParsedPostBodyBlock[];
  plainText: string;
  textCount: number;
  serialized?: { description: string; images: string[] };
};

const cases: Case[] = JSON.parse(
  fs.readFileSync(path.join(__dirname, "fixtures/post-body-cases.json"), "utf8")
);

const text = (value: string, style: Partial<{ size: "normal" | "large"; bold: boolean }> = {}) =>
  ({ type: "text", text: value, size: "normal", bold: false, ...style }) as const;

describe("post-body 공유 케이스", () => {
  it.each(cases.map((c) => [c.name, c] as const))("%s", (_name, c) => {
    expect(parsePostBody(c.description, c.images)).toEqual(c.blocks);
    expect(toPostPlainText(c.description)).toBe(c.plainText);
    expect(countPostBodyText(c.description)).toBe(c.textCount);

    const expected = c.serialized ?? { description: c.description, images: c.images };
    expect(serializePostBody(parsePostBody(c.description, c.images))).toEqual(expected);
    // 저장 형식은 다시 읽고 써도 그대로다.
    expect(serializePostBody(parsePostBody(expected.description, expected.images))).toEqual(expected);
  });
});

describe("serializePostBody", () => {
  it("사진 등장 순서로 번호와 images 를 다시 매긴다", () => {
    const blocks: PostBodyBlock<{ id: string }>[] = [
      text("앞"),
      { type: "image", image: { id: "y" } },
      text(""),
      { type: "image", image: { id: "x" } },
      text("뒤", { size: "large", bold: true }),
    ];
    expect(serializePostBody(blocks)).toEqual({
      description: "앞\n[[photo:1]]\n[[photo:2]]\n## **뒤**",
      images: [{ id: "y" }, { id: "x" }],
    });
  });

  it("표시로 읽힐 글자에만 백슬래시를 붙인다", () => {
    expect(serializePostBody([text("## 제목 아님")]).description).toBe("\\## 제목 아님");
    expect(serializePostBody([text("**굵게 아님**")]).description).toBe("\\**굵게 아님**");
    expect(serializePostBody([text("[[photo:2]]")]).description).toBe("\\[[photo:2]]");
    expect(serializePostBody([text("**굵게 아님**", { size: "large" })]).description).toBe(
      "## \\**굵게 아님**"
    );
    expect(serializePostBody([text("#해시태그")]).description).toBe("#해시태그");
    expect(serializePostBody([text("**먹이**는 젤리")]).description).toBe("**먹이**는 젤리");
    expect(serializePostBody([text("## 안쪽", { bold: true })]).description).toBe("**## 안쪽**");
  });

  it("블록 글자에 섞인 줄바꿈은 같은 스타일의 여러 줄로 저장한다", () => {
    expect(serializePostBody([text("가\n나", { bold: true })]).description).toBe("**가**\n**나**");
  });

  it("대표 사진은 본문 맨 위 사진이다", () => {
    const { images } = serializePostBody([
      text("설명"),
      { type: "image", image: "second-picked" },
      { type: "image", image: "first-picked" },
    ]);
    expect(images[0]).toBe("second-picked");
  });
});

describe("splitLinks", () => {
  it("http·https 주소만 링크로 나눈다", () => {
    expect(splitLinks("참고 https://a.com/x?y=1 와 http://b.kr")).toEqual([
      { type: "text", value: "참고 " },
      { type: "link", value: "https://a.com/x?y=1" },
      { type: "text", value: " 와 " },
      { type: "link", value: "http://b.kr" },
    ]);
  });

  it("끝에 붙은 문장부호는 링크에 넣지 않는다", () => {
    expect(splitLinks("여기(https://a.com/path).")).toEqual([
      { type: "text", value: "여기(" },
      { type: "link", value: "https://a.com/path" },
      { type: "text", value: ")." },
    ]);
  });

  it("주소 바로 뒤에 붙은 한글은 링크 밖이다", () => {
    expect(splitLinks("https://smartstore.naver.com/bredy에서 샀어요")).toEqual([
      { type: "link", value: "https://smartstore.naver.com/bredy" },
      { type: "text", value: "에서 샀어요" },
    ]);
  });

  it("링크가 없으면 글자 하나, 빈 글자는 빈 배열", () => {
    expect(splitLinks("ftp://x.com 은 아님")).toEqual([{ type: "text", value: "ftp://x.com 은 아님" }]);
    expect(splitLinks("")).toEqual([]);
  });
});

describe("validatePostDescription", () => {
  it("평문과 사진 표시가 있는 본문을 통과시킨다", () => {
    expect(validatePostDescription("열 글자 이상의 옛 평문 본문", 0)).toEqual({ ok: true });
    expect(validatePostDescription("앞 설명 열 글자 이상\n[[photo:1]]\n[[photo:2]]", 2)).toEqual({ ok: true });
  });

  it("사진만 있거나 글자가 10자 미만이면 짧다", () => {
    expect(validatePostDescription("[[photo:1]]", 1)).toMatchObject({
      ok: false,
      errorCode: "POST_DESCRIPTION_TOO_SHORT",
      message: "내용을 10자 이상 입력해주세요.",
    });
    expect(validatePostDescription("## **여덟글자입니다요**", 0)).toMatchObject({
      ok: false,
      errorCode: "POST_DESCRIPTION_TOO_SHORT",
    });
  });

  it("표시 기호를 뺀 글자가 2000자를 넘거나 저장 문자열이 4000자를 넘으면 길다", () => {
    expect(validatePostDescription("가".repeat(2000), 0)).toEqual({ ok: true });
    expect(validatePostDescription("가".repeat(2001), 0)).toMatchObject({
      ok: false,
      errorCode: "POST_DESCRIPTION_TOO_LONG",
      message: "내용은 2000자 이하로 입력해주세요.",
    });
    expect(validatePostDescription(`**${"가".repeat(1999)}**`, 0)).toEqual({ ok: true });
    const manyMarks = Array.from({ length: 900 }, () => "## **가**").join("\n");
    expect(validatePostDescription(manyMarks, 0)).toMatchObject({ errorCode: "POST_DESCRIPTION_TOO_LONG" });
  });

  it("사진 번호가 images 범위 밖이거나 중복이면 거절한다", () => {
    expect(validatePostDescription("열 글자 이상 설명입니다\n[[photo:2]]", 1)).toMatchObject({
      ok: false,
      errorCode: "POST_BODY_INVALID_PHOTO",
      message: "사진 정보가 올바르지 않습니다.",
    });
    expect(validatePostDescription("열 글자 이상 설명입니다\n[[photo:1]]\n[[photo:1]]", 1)).toMatchObject({
      errorCode: "POST_BODY_INVALID_PHOTO",
    });
    // 백슬래시로 감싼 글자는 사진 표시가 아니다.
    expect(validatePostDescription("열 글자 이상 설명입니다\n\\[[photo:5]]", 0)).toEqual({ ok: true });
  });
});

describe("removePostBodyImage", () => {
  it("사진 줄을 지우고 뒤 번호를 하나씩 당긴다", () => {
    expect(removePostBodyImage("가\n[[photo:1]]\n나\n[[photo:2]]\n[[photo:3]]", 1)).toBe(
      "가\n[[photo:1]]\n나\n[[photo:2]]"
    );
    expect(removePostBodyImage("[[photo:1]]\n가\n[[photo:2]]", 0)).toBe("가\n[[photo:1]]");
  });

  it("사진 표시가 없는 글은 그대로다", () => {
    expect(removePostBodyImage("옛 글 본문", 0)).toBe("옛 글 본문");
  });
});
