import {
  EMPTY_SUPPORT_PREFILL,
  parseSupportPrefill,
  supportPrefillKey,
} from "../app/(web)/support/supportPrefill";

describe("parseSupportPrefill", () => {
  it("쿼리가 없으면 빈 값 + 버그 제보", () => {
    expect(parseSupportPrefill(new URLSearchParams(""))).toEqual(
      EMPTY_SUPPORT_PREFILL,
    );
    expect(parseSupportPrefill(null)).toEqual(EMPTY_SUPPORT_PREFILL);
  });

  it("type/title/description/contactEmail 를 채운다", () => {
    const params = new URLSearchParams({
      type: "DEV_TEAM_REQUEST",
      title: "제휴 문의",
      description: "내용\n두 줄",
      contactEmail: " a@b.com ",
    });
    expect(parseSupportPrefill(params)).toEqual({
      type: "DEV_TEAM_REQUEST",
      title: "제휴 문의",
      description: "내용\n두 줄",
      contactEmail: "a@b.com",
    });
  });

  it("알 수 없는 type 은 버그 제보로", () => {
    expect(parseSupportPrefill(new URLSearchParams("type=HACK")).type).toBe(
      "BUG_REPORT",
    );
  });

  it("프리필이 다르면 키가 다르다", () => {
    const a = parseSupportPrefill(new URLSearchParams("title=a"));
    const b = parseSupportPrefill(new URLSearchParams("title=b"));
    expect(supportPrefillKey(a)).not.toBe(supportPrefillKey(b));
  });
});
