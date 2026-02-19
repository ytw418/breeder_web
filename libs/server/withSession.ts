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

const sessionOptions: IronSessionOptions = {
  cookieName: SESSION_COOKIE_NAME,
  password: process.env.COOKIE_PASSWORD!,
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24, // "1d"; Indicates the number of seconds until the cookie expires. A zero or negative number will expire the cookie immediately. If both Expires and Max-Age are set, Max-Age has precedence.
  },
};

// https://github.com/vvo/iron-session#nextjs-withironsessionapiroutehandler-ironoptions
export function withApiSession(fn: any) {
  return withIronSessionApiRoute(fn, sessionOptions);
}

// Theses types are compatible with InferGetStaticPropsType https://nextjs.org/docs/basic-features/data-fetching#typescript-use-getstaticprops
export function withSessionSsr<
  P extends { [key: string]: unknown } = { [key: string]: unknown },
>(
  handler: (
    context: GetServerSidePropsContext
  ) => GetServerSidePropsResult<P> | Promise<GetServerSidePropsResult<P>>
) {
  return withIronSessionSsr(handler, sessionOptions);
}
