import { NextFetchEvent, NextRequest, NextResponse } from "next/server";

export function middleware(req: NextRequest, ev: NextFetchEvent) {
  const { pathname, search } = req.nextUrl;

  if (pathname.startsWith("/admin")) {
    if (pathname === "/admin/login") {
      return NextResponse.next();
    }

    const found = req.cookies.get("kakaoDev");
    if (!found) {
      const next = encodeURIComponent(`${pathname}${search}`);
      return NextResponse.redirect(new URL(`/admin/login?next=${next}`, req.url));
    }
  }

  // 비로그인 접근 제한
  if (pathname.includes("myPage")) {
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
    "/admin/:path*",
    "/myPage",
    // "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
};
