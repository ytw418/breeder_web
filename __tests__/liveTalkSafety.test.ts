import { findBlockedWord } from "@libs/shared/contentFilter";
import { detectRiskyContact, maskContactsInText } from "@libs/shared/contactInText";
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
  it("은행 이름 가까이 있는 계좌번호만 가리고, 채팅 주의 감지는 계좌·카톡 아이디를 찾는다(감사 24번)", () => {
    expect(maskContactsInText("국민 123456-01-234567 로 입금").text).toBe("국민 (계좌번호는 가렸어요) 로 입금");
    expect(detectRiskyContact("선입금 부탁해요 카카오뱅크 3333-01-1234567")).toEqual({ account: true, openChat: false, kakaoId: false });
    expect(detectRiskyContact("카톡 아이디: bredy99 로 연락 주세요").kakaoId).toBe(true);
    // 전화번호·은행 이름 없는 숫자는 계좌가 아니다.
    expect(detectRiskyContact("입금 확인은 010-1234-5678 로 문자 주세요").account).toBe(false);
    expect(detectRiskyContact("주문번호 1234567890123 확인했어요").account).toBe(false);
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
