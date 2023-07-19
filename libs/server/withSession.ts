import { IronSessionOptions } from "iron-session";
import { withIronSessionApiRoute, withIronSessionSsr } from "iron-session/next";
import { GetServerSidePropsContext, GetServerSidePropsResult } from "next";

export interface PendingPayment {
  goodsName?: string;
  grandTotal: number;
  buyerName: string;
}
declare module "iron-session" {
  interface IronSessionData {
    user?: {
      id: number;
      name?: string;
      isAdult?: boolean;
      thumbnail?: string;
      email?: string;
      provider?: string;
      plingBalance?: number;
    };
    token?: string;
    pending?: {
      payment: PendingPayment;
    };
  }
}

const sessionOptions: IronSessionOptions = {
  cookieName: "smpwa", // sensual moment pling store cookie
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
  P extends { [key: string]: unknown } = { [key: string]: unknown }
>(
  handler: (
    context: GetServerSidePropsContext
  ) => GetServerSidePropsResult<P> | Promise<GetServerSidePropsResult<P>>
) {
  return withIronSessionSsr(handler, sessionOptions);
}
