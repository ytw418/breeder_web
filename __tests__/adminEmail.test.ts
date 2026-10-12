import { isAdminEmail } from "@libs/shared/adminEmail";

describe("isAdminEmail — 아이디가 ytw418 로 시작하는 이메일만 운영자", () => {
  it("기존 운영 계정 두 개를 통과시킨다", () => {
    expect(isAdminEmail("ytw418@gmail.com")).toBe(true);
    expect(isAdminEmail("ytw418@naver.com")).toBe(true);
  });

  it("ytw418 로 시작하는 다른 아이디·대소문자·공백도 통과시킨다", () => {
    expect(isAdminEmail("ytw418abc@gmail.com")).toBe(true);
    expect(isAdminEmail("  YTW418@Naver.com ")).toBe(true);
    expect(isAdminEmail("ytw418+crew@gmail.com")).toBe(true);
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
