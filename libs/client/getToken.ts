import { unsealData } from "iron-session";
import { cookies } from "next/headers";

export interface Token {
  token: string;
}

export type SessionToken = Token | null;

export async function getToken(): Promise<SessionToken> {
  const nextCookies = cookies();
  const found = nextCookies.get("smpwa");

  if (!found) return null;
  try {
    const { token } = await unsealData(found.value, {
      password: process.env.COOKIE_PASSWORD as string,
    });
    return token as Token;
  } catch (error) {
    console.log("error :>> ", error);
    return null;
  }
}
