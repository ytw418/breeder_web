/**
 * Jest 테스트 메서드 설명
 *
 * .toBeDefined() - 값이 undefined가 아닌지 확인
 * .mockResolvedValueOnce() - 비동기 함수의 한 번의 호출에 대해 특정 값을 반환하도록 설정
 * .toBeLessThanOrEqual() - 숫자나 문자열의 길이가 특정 값보다 작거나 같은지 확인
 * .toHaveBeenCalledTimes() - 함수가 특정 횟수만큼 호출되었는지 확인
 * .mockImplementation() - 함수의 동작을 모킹하여 특정 동작을 수행하도록 설정
 * .mockReturnValue() - 함수가 특정 값을 반환하도록 설정
 * .mockResolvedValue() - 비동기 함수가 특정 값을 반환하는 Promise를 반환하도록 설정
 * .mockRejectedValue() - 비동기 함수가 특정 에러를 발생시키는 Promise를 반환하도록 설정
 * .toHaveBeenCalledWith() - 함수가 특정 인자와 함께 호출되었는지 확인
 * .toHaveBeenCalled() - 함수가 호출되었는지 확인
 * .toHaveBeenLastCalledWith() - 함수가 마지막으로 특정 인자와 함께 호출되었는지 확인
 * .toHaveBeenNthCalledWith() - 함수가 n번째로 특정 인자와 함께 호출되었는지 확인
 */

import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import { UniqueName } from "@libs/server/UniqueName";
import client from "@libs/server/client";
import { randomUsername } from "@libs/client/randomName";
import { User } from "@prisma/client";

// Prisma 클라이언트 모킹
jest.mock("@libs/server/client", () => ({
  user: {
    findUnique: jest.fn(),
  },
}));

describe("UniqueName 함수", () => {
  beforeEach(() => {
    // 테스트 전 모든 모킹 초기화
    jest.clearAllMocks();
  });

  it("UniqueName 생성되는지 확인", async () => {
    (
      client.user.findUnique as jest.MockedFunction<
        typeof client.user.findUnique
      >
    )
      // 생성된 닉네임으로 DB에 중복된 닉네임이 없는지 확인
      // 중복되지 않은 이름일 경우 DB는 null을 반환
      .mockResolvedValueOnce(null);

    const uniqueName = await UniqueName(); // UniqueName 함수 실행

    expect(uniqueName).toBeDefined();
    expect(client.user.findUnique).toHaveBeenCalledTimes(1);
  });

  it("랜덤하게 생성된 닉네임이 중복되는 경우 재시도 하는지 확인", async () => {
    (
      client.user.findUnique as jest.MockedFunction<
        typeof client.user.findUnique
      >
    ) // UniqueName 실행시 findUnique 가 실행되고 중복된 이름일 경우 중복된 user 객체를 반환하고 중복되지 않은 이름일 경우 null 반환
      // 1번째 호출 중복된 이름일 경우
      .mockResolvedValueOnce({} as User)
      // 2번째 호출 중복되지 않은 이름일 경우
      .mockResolvedValueOnce(null);

    const uniqueName = await UniqueName(); // UniqueName 함수 실행

    expect(uniqueName).toBeDefined();
    expect(uniqueName.length).toBeLessThanOrEqual(8);
    expect(client.user.findUnique).toHaveBeenCalledTimes(2);
  });
});
