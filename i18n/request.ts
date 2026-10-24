/**
 * 웹 다국어 설정(next-intl, docs/prd/i18n.md I-1). next.config.js 의 createNextIntlPlugin 이 이 파일을 읽는다.
 *
 * - 번역 파일은 locales/<언어>/<네임스페이스>.json = 앱 bredy_app src/locales/ 사본(ICU 문법).
 *   고친 뒤 `npm run check:i18n -- --other <bredy_app 경로>` 로 키·문법·사본을 확인한다.
 * - 1단계는 서버 렌더를 항상 한국어로 한다. 여기서 cookies()·headers() 를 읽으면 모든 페이지가 동적 렌더로
 *   바뀌어 ISR·정적 페이지가 깨진다(PRD §3.7). 쿠키·브라우저 언어 반영은 영어를 켤 때(I-5) 정적 렌더를
 *   지키는 방식과 함께 정한다.
 */
import { getRequestConfig } from "next-intl/server";

import { DEFAULT_LOCALE, type AppLocale } from "@libs/shared/i18nLocale";
import enCommon from "../locales/en/common.json";
import koCommon from "../locales/ko/common.json";

const MESSAGES: Record<AppLocale, Record<string, unknown>> = {
  ko: { common: koCommon },
  en: { common: enCommon },
};

export default getRequestConfig(async () => {
  const locale: AppLocale = DEFAULT_LOCALE;
  return { locale, messages: MESSAGES[locale] };
});
