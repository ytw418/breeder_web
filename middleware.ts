import { NextFetchEvent, NextRequest, NextResponse } from "next/server";

export function middleware(req: NextRequest, ev: NextFetchEvent) {
  return NextResponse.redirect(`${req.nextUrl.origin}/web/main`);
}
export const config = {
  matcher: ["/", "/admin"],
};

// export const config = {
//   matcher: "/about/:path*",
// };
//  return NextResponse.rewrite(new URL('/about-2', request.url))

// import { NextRequest, NextResponse, userAgent } from "next/server";

// export function middleware(request: NextRequest) {
//   const { device } = userAgent(request);
//   const viewport = device.type === "mobile" ? "mobile" : "desktop";

//   request.nextUrl.searchParams.set("viewport", viewport);
//   return NextResponse.rewrite(request.nextUrl);
// }
