import { NextFetchEvent, NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME } from "@libs/constants";

const TOOL_MODE_COOKIE = "bredy_tool_mode";

export function middleware(req: NextRequest, ev: NextFetchEvent) {
  const { pathname, search } = req.nextUrl;
  const isPrefetchRequest =
    req.headers.get("purpose") === "prefetch" ||
    req.headers.has("next-router-prefetch") ||
    req.headers.get("x-middleware-prefetch") === "1";
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

    const found = req.cookies.get(SESSION_COOKIE_NAME);
    if (!found) {
      const next = encodeURIComponent(`${pathname}${search}`);
      return NextResponse.redirect(new URL(`/admin/login?next=${next}`, req.url));
    }
  }

  // 비로그인 접근 제한
  if (pathname.includes("myPage")) {
    const found = req.cookies.get(SESSION_COOKIE_NAME);
    if (!found) {
      // 로그인 전 프리패치에서 생성된 리다이렉트 캐시가
      // 로그인 후에도 재사용되는 문제를 막기 위해 프리패치는 통과시킨다.
      if (isPrefetchRequest) {
        return response ?? NextResponse.next();
      }
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
