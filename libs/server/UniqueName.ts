import { randomUsername } from "@libs/client/randomName";
import client from "@libs/server/client";

/** 무작위 닉네임 최대 길이. 잘린 최종 문자열로 중복을 검사한다. */
const NAME_MAX_LENGTH = 8;
const MAX_TRIES = 10;

/**
 * 아직 아무도 안 쓰는 무작위 닉네임을 만든다.
 * 예전에는 10자로 검사하고 8자로 잘라 돌려줘서, 잘린 이름이 이미 있으면 가입이 P2002(500)로 끝났다(2026-10-21 감사 16번).
 * 10번 안에 못 찾으면 끝 2자리를 난수로 바꿔 돌려준다. 그래도 겹치면 로그인 API 가 P2002 를 보고 다시 만든다.
 */
export const UniqueName = async (): Promise<string> => {
  for (let attempt = 0; attempt < MAX_TRIES; attempt += 1) {
    const candidate = randomUsername({ maxLength: NAME_MAX_LENGTH, maxNum: 100 });
    const existingUser = await client.user.findUnique({
      where: { name: candidate },
      select: { id: true },
    });
    if (!existingUser) return candidate;
  }

  const base = randomUsername({ maxLength: NAME_MAX_LENGTH });
  const suffix = String(Math.floor(Math.random() * 100)).padStart(2, "0");
  return base.slice(0, NAME_MAX_LENGTH - 2) + suffix;
};
