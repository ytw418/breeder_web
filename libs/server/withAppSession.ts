import { NextRequest, NextResponse } from "next/server";
import { getIronSession } from "iron-session";
import { cookies } from "next/headers";

const sessionOptions = {
  cookieName: "kakaoDev",
  password: process.env.COOKIE_PASSWORD!,
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24,
  },
};

export async function withAppSession(handler: Function, isPrivate: boolean = true) {
  return async (req: NextRequest, params: any) => {
    const session = await getIronSession(cookies(), sessionOptions);
    
    if (isPrivate && !session.user) {
      return NextResponse.json(
        { error: "인증되지 않은 요청입니다." },
        { status: 401 }
      );
    }

    req.session = session;
    return handler(req, params);
  };
} 