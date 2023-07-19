import { NextFetchEvent, NextRequest, NextResponse } from "next/server";

export function middleware(req: NextRequest, ev: NextFetchEvent) {
  // 비로그인 접근 제한
  if (req.nextUrl.pathname.includes("myPage")) {
    const found = req.cookies.get("kakaoDev");
    if (!found) {
      return NextResponse.redirect(new URL("/auth/login", req.url));
    }
  }

  // 루트경로
  // if (req.nextUrl.pathname === "/") {
  //   return NextResponse.redirect(new URL("/", req.url));
  // }
}
export const config = {
  matcher: [
    // "/",
    "/admin:path*",
    "/myPage",
    // "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
};
