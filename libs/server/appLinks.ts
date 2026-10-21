/**
 * 공유 링크(https://bredy.app/posts/12 등)를 설치된 앱에서 바로 여는 앱 링크 파일(2026-10-21 커뮤니티 감사 18번).
 * - iOS: /.well-known/apple-app-site-association (app/.well-known/apple-app-site-association/route.ts)
 * - Android: /.well-known/assetlinks.json (app/.well-known/assetlinks.json/route.ts)
 * 짝은 앱 bredy_app `app.config.js` withAppLinks(associatedDomains·intentFilters, 같은 경로 목록)와
 * `src/app/+native-intent.ts`(들어온 주소 거르기)다. 앱 쪽 설정은 스토어 빌드부터 효력이 있다.
 */

/** Apple 개발자 팀 ID(bredy_app eas.json submit.production.ios.appleTeamId) + 번들 ID(app.json ios.bundleIdentifier). */
export const IOS_APP_ID = "J5F7Z4S89D.app.bredy.mobile";
/** bredy_app app.json android.package */
export const ANDROID_PACKAGE = "app.bredy.mobile";

/** 앱으로 여는 경로. 앱 app.config.js APP_LINK_PATH_PREFIXES 와 맞춘다. */
export const APP_LINK_PATHS = [
  "/posts/*",
  "/products/*",
  "/auctions/*",
  "/profiles/*",
  "/debates",
  "/debates/*",
  "/town",
  "/town/*",
] as const;

export function appleAppSiteAssociation() {
  return {
    applinks: {
      apps: [],
      details: [
        {
          // iOS 13+ 형식(appIDs·components)과 그 전 형식(appID·paths)을 같이 둔다.
          appIDs: [IOS_APP_ID],
          components: APP_LINK_PATHS.map((path) => ({ "/": path })),
          appID: IOS_APP_ID,
          paths: [...APP_LINK_PATHS],
        },
      ],
    },
  };
}

const SHA256_FINGERPRINT = /^([0-9A-F]{2}:){31}[0-9A-F]{2}$/;

/**
 * Play 앱 서명 인증서 SHA-256 지문(쉼표 목록, Play 콘솔 → 앱 무결성 → 앱 서명). 형식이 틀린 값은 버린다.
 * 값을 env `ANDROID_APP_LINK_SHA256` 에 넣기 전에는 빈 배열이고, 그때는 assetlinks.json 을 내보내지 않는다
 * (틀린 파일로 autoVerify 가 실패하면 기기가 실패 결과를 한동안 들고 있다).
 */
export function androidCertFingerprints(raw: string | undefined): string[] {
  return (raw ?? "")
    .split(",")
    .map((value) => value.trim().toUpperCase())
    .filter((value) => SHA256_FINGERPRINT.test(value));
}

export function androidAssetLinks(fingerprints: string[]) {
  if (!fingerprints.length) return null;
  return [
    {
      relation: ["delegate_permission/common.handle_all_urls"],
      target: {
        namespace: "android_app",
        package_name: ANDROID_PACKAGE,
        sha256_cert_fingerprints: fingerprints,
      },
    },
  ];
}
