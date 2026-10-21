import { NextResponse } from "next/server";
import { appleAppSiteAssociation } from "@libs/server/appLinks";

/** iOS 유니버설 링크 파일(확장자 없음, application/json). 경로·앱 ID 는 libs/server/appLinks.ts. */
export function GET() {
  return NextResponse.json(appleAppSiteAssociation(), {
    headers: { "Cache-Control": "public, max-age=3600" },
  });
}
