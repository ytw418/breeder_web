import { isAdminEmail } from "@libs/shared/adminEmail";

describe("isAdminEmail — 운영 메일함 두 개만 운영자", () => {
  it("기존 운영 계정 두 개를 통과시킨다", () => {
    expect(isAdminEmail("ytw418@gmail.com")).toBe(true);
    expect(isAdminEmail("ytw418@naver.com")).toBe(true);
  });

  it("대소문자·공백·gmail 별칭은 통과시킨다", () => {
    expect(isAdminEmail("  YTW418@Naver.com ")).toBe(true);
    expect(isAdminEmail("ytw418+crew@gmail.com")).toBe(true);
  });

  it("ytw418 로 시작하는 남의 아이디·다른 도메인은 막는다", () => {
    expect(isAdminEmail("ytw418abc@gmail.com")).toBe(false);
    expect(isAdminEmail("ytw418@daum.net")).toBe(false);
    expect(isAdminEmail("ytw418+x@naver.com")).toBe(false);
  });

  it("아이디 중간에 ytw418 이 있거나 도메인에만 있으면 막는다", () => {
    expect(isAdminEmail("aytw418@gmail.com")).toBe(false);
    expect(isAdminEmail("user@ytw418.com")).toBe(false);
    expect(isAdminEmail("ytw41@gmail.com")).toBe(false);
  });

  it("비어 있거나 @ 가 없으면 막는다", () => {
    expect(isAdminEmail("")).toBe(false);
    expect(isAdminEmail(null)).toBe(false);
    expect(isAdminEmail(undefined)).toBe(false);
    expect(isAdminEmail("ytw418")).toBe(false);
  });
});
