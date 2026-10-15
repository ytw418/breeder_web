/**
 * 관심 카테고리 범위에 따른 화면 호칭·경매 노출(2026-10-14 사용자 결정, 앱 docs/prd/category-pin.md §15).
 * 포유류 하위로만 고정한 사람(강아지·고양이·햄스터 등)에게는 '브리더' 대신 '집사'로 부르고 경매를 숨긴다.
 * 다른 생물군이 하나라도 섞이거나 고정이 없으면(전체 보기) 지금 그대로 둔다.
 * 창립·파트너·인증 브리더 뱃지와 '브리더 프로그램'은 분양자 자격 이름이라 여기서 바꾸지 않는다.
 *
 * 앱 bredy_app src/lib/scopeTerms.ts = 웹 libs/shared/scopeTerms.ts 사본이라 함께 고친다.
 */
export const BREEDER_WORD = "브리더";
export const KEEPER_WORD = "집사";
export type BreederWord = typeof BREEDER_WORD | typeof KEEPER_WORD;

/** 서버 카테고리 트리의 포유류 path. 강아지는 '/mammal/dog/'. */
const MAMMAL_PATH = "/mammal/";

export interface ScopeTerms {
  /** 고정한 카테고리가 모두 포유류 하위인지. */
  mammalOnly: boolean;
  /** 화면에서 '브리더' 자리에 쓸 말. 두 말 모두 모음으로 끝나 조사(가·를·에게·예요)가 같다. */
  breeder: BreederWord;
  /** 하단 경매 탭·홈 경매 카드를 보일지. */
  showAuctions: boolean;
}

export function isMammalOnlyScope(pins: readonly { path: string }[]): boolean {
  return pins.length > 0 && pins.every((pin) => pin.path.startsWith(MAMMAL_PATH));
}

export function scopeTermsFor(pins: readonly { path: string }[]): ScopeTerms {
  const mammalOnly = isMammalOnlyScope(pins);
  return {
    mammalOnly,
    breeder: mammalOnly ? KEEPER_WORD : BREEDER_WORD,
    showAuctions: !mammalOnly,
  };
}

/** 정적 문구 속 '브리더'를 바꾼다. 뱃지·프로그램 이름(창립 브리더 등)에는 쓰지 않는다. */
export function withBreederWord(text: string, word: BreederWord): string {
  return word === BREEDER_WORD ? text : text.split(BREEDER_WORD).join(word);
}

/**
 * 경매로 가는 주소인지(경매 목록·상세·등록, 경매도구 소개). 포유류 전용이면 홈 배너에서 이런 배너를 뺀다(2026-10-15).
 * 관리자가 bredy.app 전체 주소로 넣어도 같은 경로로 본다.
 */
export function isAuctionHref(href: string | null | undefined): boolean {
  const path = (href ?? "").replace(/^https?:\/\/[^/]+/, "");
  return /^\/auction(s|-tool)?(\/|\?|#|$)/.test(path);
}
