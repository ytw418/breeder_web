import { unsealData } from "iron-session";
import { cookies } from "next/headers";

import { Provider } from "../constants";

interface User {
  id: string;
  name: string;
  isAdult: boolean;
  thumbnail: string;
  role: string;
  email: string;
  provider:
    | typeof Provider.APPLE
    | typeof Provider.GOOGLE
    | typeof Provider.KAKAO;
  plingBalance: number;
}

export type SessionUser = User | null;

export async function getUser(): Promise<SessionUser> {
  const nextCookies = cookies();
  const found = nextCookies.get("kakaoDev");

  if (!found) return null;
  try {
    const { user } = await unsealData(found.value, {
      password: process.env.COOKIE_PASSWORD as string,
    });
    return user as User;
  } catch (error) {
    return null;
  }
}
