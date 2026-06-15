import { NextFetchEvent, NextRequest, NextResponse } from "next/server";

const TOOL_MODE_COOKIE = "bredy_tool_mode";

export function proxy(req: NextRequest, ev: NextFetchEvent) {
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

  // 순수 Bearer 토큰 방식에서는 미들웨어가 인증 토큰(Authorization 헤더/
  // localStorage)을 읽을 수 없으므로, 로그인 가드는 클라이언트의 <AuthGuard>
  // 와 각 API 라우트의 withHandler(isPrivate) 에서 처리한다.

  return response ?? NextResponse.next();
}
export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)",
  ],
};
