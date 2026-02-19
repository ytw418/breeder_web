import { unsealData } from "iron-session";
import { cookies } from "next/headers";

import { SessionUser } from "./withSession";
import { SESSION_COOKIE_NAME } from "@libs/constants";

/**
 * 세션에서 유저 정보를 가져옵니다.
 * 서버컴포넌트에서 사용해주세요
 * @returns 세션에 저장된 유저 정보
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const nextCookies = cookies();
  const found = nextCookies.get(SESSION_COOKIE_NAME);

  if (!found) return null;
  try {
    const { user } = await unsealData(found.value, {
      password: process.env.COOKIE_PASSWORD as string,
    });
    return user as SessionUser;
  } catch (error) {
    return null;
  }
}
