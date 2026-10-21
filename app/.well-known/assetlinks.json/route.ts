import { NextResponse } from "next/server";
import { androidAssetLinks, androidCertFingerprints } from "@libs/server/appLinks";

/**
 * Android 앱 링크 검증 파일. Play 앱 서명 인증서 지문(env `ANDROID_APP_LINK_SHA256`)이 없으면 404 로 둔다
 * — 틀린 파일을 내보내 autoVerify 실패가 굳지 않게(libs/server/appLinks.ts).
 */
export function GET() {
  const body = androidAssetLinks(androidCertFingerprints(process.env.ANDROID_APP_LINK_SHA256));
  if (!body) return new Response("Not Found", { status: 404 });
  return NextResponse.json(body, { headers: { "Cache-Control": "public, max-age=3600" } });
}
