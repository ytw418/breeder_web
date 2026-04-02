import { IronSessionOptions } from "iron-session";
import { withIronSessionApiRoute, withIronSessionSsr } from "iron-session/next";
import { GetServerSidePropsContext, GetServerSidePropsResult } from "next";
import { SESSION_COOKIE_NAME } from "@libs/constants";

export type SessionUser = {
  id: number;
  snsId: string;
  provider: string;
  phone: string | null;
  email: string | null;
  name: string;
  avatar: string | null;
  createdAt: Date;
  updatedAt: Date;
};

declare module "iron-session" {
  interface IronSessionData {
    user?: SessionUser;
  }
}

function getSessionOptions(): IronSessionOptions {
  const password = process.env.COOKIE_PASSWORD;

  if (!password) {
    throw new Error("COOKIE_PASSWORD 환경변수가 설정되어 있지 않습니다.");
  }

  return {
    cookieName: SESSION_COOKIE_NAME,
    password,
    cookieOptions: {
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 365,
    },
  };
}

// https://github.com/vvo/iron-session#nextjs-withironsessionapiroutehandler-ironoptions
export function withApiSession(fn: any) {
  return withIronSessionApiRoute(fn, () => getSessionOptions());
}

// Theses types are compatible with InferGetStaticPropsType https://nextjs.org/docs/basic-features/data-fetching#typescript-use-getstaticprops
export function withSessionSsr<
  P extends { [key: string]: unknown } = { [key: string]: unknown },
>(
  handler: (
    context: GetServerSidePropsContext
  ) => GetServerSidePropsResult<P> | Promise<GetServerSidePropsResult<P>>
) {
  return withIronSessionSsr(handler, () => getSessionOptions());
}
