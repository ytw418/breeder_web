const mockClient = {
  user: { findUnique: jest.fn() },
};
jest.mock("@libs/server/client", () => ({
  __esModule: true,
  default: mockClient,
}));

import {
  NICKNAME_MAX_LENGTH,
  NICKNAME_MIN_LENGTH,
  NICKNAME_TAKEN_MESSAGE,
  validateNickname,
} from "@libs/shared/nickname";
import {
  checkNickname,
  isNicknameAvailable,
  isUniqueNameError,
} from "@libs/server/nickname";

beforeEach(() => {
  jest.clearAllMocks();
});

describe("validateNickname", () => {
  it("앞뒤 공백을 지운 이름을 돌려준다", () => {
    expect(validateNickname("  브리디  ")).toEqual({ ok: true, name: "브리디" });
  });

  it.each([undefined, null, "", "   "])("빈 값(%p)은 EMPTY", (raw) => {
    expect(validateNickname(raw)).toEqual({
      ok: false,
      code: "EMPTY",
      reason: "닉네임을 입력해주세요.",
    });
  });

  it("최대 10글자까지 허용하고 넘으면 TOO_LONG", () => {
    expect(NICKNAME_MIN_LENGTH).toBe(1);
    expect(NICKNAME_MAX_LENGTH).toBe(10);
    expect(validateNickname("가".repeat(10))).toEqual({ ok: true, name: "가".repeat(10) });
    expect(validateNickname(` ${"가".repeat(10)} `)).toEqual({ ok: true, name: "가".repeat(10) });
    expect(validateNickname("가".repeat(11))).toEqual({
      ok: false,
      code: "TOO_LONG",
      reason: "닉네임은 최대 10글자까지 입력할 수 있어요.",
    });
  });

  it.each([
    "탈퇴한 사용자",
    "탈퇴한 사용자#3",
    " 탈퇴한 사용자1",
    // 보이는 모양만 같은 변형(사칭): 다른 공백·전각 공백·연속 공백·공백 없음·0폭 문자·한글 채움 문자
    "탈퇴한\u00A0사용자",
    "탈퇴한\u3000사용자",
    "탈퇴한  사용자",
    "탈퇴한사용자",
    "탈퇴한\u200B 사용자",
    "탈\u200D퇴한 사용자",
    "탈퇴한\u3164사용자",
    "\uFEFF탈퇴한 사용자",
  ])(
    "탈퇴 표시용 이름(%s)은 RESERVED",
    (raw) => {
      expect(validateNickname(raw)).toEqual({
        ok: false,
        code: "RESERVED",
        reason: "사용할 수 없는 닉네임입니다.",
      });
    }
  );

  it.each(["탈퇴 왕", "사용자1", "브리디 김"])("비슷하지만 다른 이름(%s)은 허용한다", (raw) => {
    expect(validateNickname(raw)).toEqual({ ok: true, name: raw });
  });

  it("문자열이 아니면 문자열로 바꿔 검사한다", () => {
    expect(validateNickname(1234)).toEqual({ ok: true, name: "1234" });
  });
});

describe("isNicknameAvailable", () => {
  it("아무도 안 쓰면 사용 가능", async () => {
    mockClient.user.findUnique.mockResolvedValue(null);
    await expect(isNicknameAvailable("브리디", 7)).resolves.toBe(true);
    expect(mockClient.user.findUnique).toHaveBeenCalledWith({
      where: { name: "브리디" },
      select: { id: true },
    });
  });

  it("본인의 현재 닉네임이면 사용 가능", async () => {
    mockClient.user.findUnique.mockResolvedValue({ id: 7 });
    await expect(isNicknameAvailable("브리디", 7)).resolves.toBe(true);
  });

  it("다른 유저가 쓰고 있으면 불가", async () => {
    mockClient.user.findUnique.mockResolvedValue({ id: 8 });
    await expect(isNicknameAvailable("브리디", 7)).resolves.toBe(false);
  });
});

describe("isUniqueNameError", () => {
  const p2002 = (target: unknown) =>
    Object.assign(new Error("Unique constraint failed"), { code: "P2002", meta: { target } });

  it("name 컬럼의 unique 위반(P2002)만 true", () => {
    expect(isUniqueNameError(p2002(["name"]))).toBe(true);
    expect(isUniqueNameError(p2002("User_name_key"))).toBe(true);
    expect(isUniqueNameError(p2002(["email"]))).toBe(false);
    expect(isUniqueNameError(Object.assign(new Error("x"), { code: "P2025" }))).toBe(false);
    expect(isUniqueNameError(new Error("boom"))).toBe(false);
    expect(isUniqueNameError(null)).toBe(false);
  });
});

describe("checkNickname", () => {
  it("형식 오류는 DB 를 조회하지 않고 사유를 돌려준다", async () => {
    await expect(checkNickname("", 7)).resolves.toEqual({
      available: false,
      code: "EMPTY",
      reason: "닉네임을 입력해주세요.",
    });
    expect(mockClient.user.findUnique).not.toHaveBeenCalled();
  });

  it("다른 유저가 쓰면 TAKEN", async () => {
    mockClient.user.findUnique.mockResolvedValue({ id: 8 });
    await expect(checkNickname(" 브리디 ", 7)).resolves.toEqual({
      available: false,
      code: "TAKEN",
      reason: NICKNAME_TAKEN_MESSAGE,
    });
    expect(NICKNAME_TAKEN_MESSAGE).toBe("중복된 닉네임입니다.");
    expect(mockClient.user.findUnique).toHaveBeenCalledWith({
      where: { name: "브리디" },
      select: { id: true },
    });
  });

  it("사용 가능하면 다듬은 이름과 본인 현재 닉네임 여부를 돌려준다", async () => {
    mockClient.user.findUnique.mockResolvedValueOnce(null);
    await expect(checkNickname(" 새이름 ", 7)).resolves.toEqual({
      available: true,
      name: "새이름",
      isCurrent: false,
    });

    mockClient.user.findUnique.mockResolvedValueOnce({ id: 7 });
    await expect(checkNickname("브리디", 7)).resolves.toEqual({
      available: true,
      name: "브리디",
      isCurrent: true,
    });
  });
});
