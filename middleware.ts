import { NextFetchEvent, NextRequest, NextResponse } from "next/server";

const TOOL_MODE_COOKIE = "bredy_tool_mode";

export function middleware(req: NextRequest, ev: NextFetchEvent) {
  const { pathname, search } = req.nextUrl;
  if (pathname.startsWith("/products/")) {
    console.info("[middleware][products]", {
      pathname,
      search,
      method: req.method,
      rsc: req.headers.get("rsc"),
      purpose: req.headers.get("purpose"),
      nextRouterPrefetch: req.headers.get("next-router-prefetch"),
      vercelId: req.headers.get("x-vercel-id"),
    });
  }
  const isToolPath = pathname === "/tool" || pathname.startsWith("/tool/");
  const isToolLoginLoadingPath = pathname === "/login-loading";
  const isSentryTestPath =
    pathname === "/sentry-example-page" || pathname.startsWith("/sentry-example-page/");
  const hasToolMode = req.cookies.get(TOOL_MODE_COOKIE)?.value === "1";
  let response: NextResponse | null = null;

  if (hasToolMode && !isToolPath && !isToolLoginLoadingPath && !isSentryTestPath) {
    if (pathname === "/auth/login") {
      const toolLoginUrl = new URL("/tool/login", req.url);
      const next = req.nextUrl.searchParams.get("next");
      if (next) {
        toolLoginUrl.searchParams.set("next", next);
      }
      return NextResponse.redirect(toolLoginUrl);
    }

    return NextResponse.redirect(new URL("/tool", req.url));
  }

  if (isToolPath && !hasToolMode) {
    response = NextResponse.next();
    response.cookies.set({
      name: TOOL_MODE_COOKIE,
      value: "1",
      path: "/",
      sameSite: "lax",
      secure: req.nextUrl.protocol === "https:",
      maxAge: 60 * 60 * 24 * 7,
    });
  }

  if (pathname.startsWith("/admin")) {
    if (pathname === "/admin/login") {
      return response ?? NextResponse.next();
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

  return response ?? NextResponse.next();
}
export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)",
  ],
};
