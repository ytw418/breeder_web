import { findBlockedWord } from "@libs/shared/contentFilter";
import { maskContactsInText } from "@libs/shared/contactInText";
import { isGroupedWithPrevious, townPromptsFor, townQuietMinutes, townTitle } from "@libs/shared/townTalk";

describe("금칙어", () => {
  it("띄어쓰기·기호를 끼워도 잡고, 정상 낱말(시발점)은 통과한다", () => {
    expect(findBlockedWord("씨 발")).toBe("씨발");
    expect(findBlockedWord("병.신같네")).toBe("병신");
    expect(findBlockedWord("여기가 시발점이에요")).toBeNull();
    expect(findBlockedWord("레게 합사 괜찮나요")).toBeNull();
  });
});

describe("글 속 연락처 가림", () => {
  it("전화번호·오픈채팅 링크를 가린다", () => {
    expect(maskContactsInText("연락 010-1234-5678 주세요").text).toBe("연락 010-****-5678 주세요");
    expect(maskContactsInText("01012345678").text).toBe("010-****-5678");
    expect(maskContactsInText("https://open.kakao.com/o/abc 여기로").text).toBe("(오픈채팅 링크는 가렸어요) 여기로");
    expect(maskContactsInText("구피 3마리 5000원").masked).toBe(false);
  });
});

describe("사랑방 규칙", () => {
  it("제목은 시 이름 + 근처 사랑방(군은 '근처'를 한 번만)", () => {
    expect(townTitle("서울")).toBe("서울 근처 사랑방");
    expect(townTitle("보은군 근처")).toBe("보은군 근처 사랑방");
  });
  it("1분 안 같은 사람은 묶고, 30분 넘게 조용하면 분을 준다", () => {
    const a = { userId: 1, createdAt: "2026-10-15T00:00:00Z" };
    expect(isGroupedWithPrevious(a, { userId: 1, createdAt: "2026-10-15T00:00:40Z" })).toBe(true);
    expect(isGroupedWithPrevious(a, { userId: 2, createdAt: "2026-10-15T00:00:40Z" })).toBe(false);
    const now = Date.parse("2026-10-15T01:00:00Z");
    expect(townQuietMinutes("2026-10-15T00:40:00Z", now)).toBeNull();
    expect(townQuietMinutes("2026-10-15T00:20:00Z", now)).toBe(40);
  });
  it("대화 거리는 날마다 3개, 같은 날엔 같다", () => {
    const day = Date.parse("2026-10-15T03:00:00Z");
    expect(townPromptsFor(day)).toHaveLength(3);
    expect(townPromptsFor(day)).toEqual(townPromptsFor(day + 3600_000));
    expect(townPromptsFor(day)).not.toEqual(townPromptsFor(day + 86_400_000));
  });
});
