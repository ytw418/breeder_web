import { leadingMention, mentionPrefill } from "@libs/shared/comment-mention";

// 앱 scripts/web-tests/commentMention.test.ts 와 같은 파일(앱 사본 src/lib/comment-mention.ts 를 같은 입력으로 본다).
describe("답글의 답글 '@닉네임'(post-upload 2026-10-21)", () => {
  it("입력칸 글자로 시작하면 이름과 나머지를 떼고, 지웠거나 이름이 이어지면 멘션이 아니다", () => {
    expect(leadingMention(`${mentionPrefill("구피네")}저도 그래요`, "구피네")).toEqual({ name: "구피네", rest: "저도 그래요" });
    expect(leadingMention("@구피네", "구피네")).toEqual({ name: "구피네", rest: "" });
    expect(leadingMention("저도 그래요", "구피네")).toBeNull();
    expect(leadingMention("@구피네집 안녕", "구피네")).toBeNull();
    expect(leadingMention("@구피네 안녕", null)).toBeNull();
  });
});
