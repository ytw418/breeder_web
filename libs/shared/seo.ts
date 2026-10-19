/**
 * 검색·생성형 검색(GEO) 공통 값.
 * 구조화 데이터(JSON-LD)는 페이지가 렌더링할 때 DB 값으로 자동으로 만든다(손으로 쓰지 않는다).
 */
export const SITE_URL = "https://bredy.app";
export const SITE_NAME = "브리디";

const CLOUDFLARE_IMAGE_BASE = "https://imagedelivery.net/OvWZrAz6J6K7n9LKUH5pKw";

/** 사진 id(Cloudflare)·경로·주소를 검색엔진이 읽을 수 있는 절대 주소로 바꾼다. */
export const toPublicImageUrl = (
  imageId: string | null | undefined,
  fallback: string,
  variant = "public"
) => {
  const value = imageId || fallback;
  if (value.startsWith("http://") || value.startsWith("https://")) return value;
  if (value.startsWith("/")) return `${SITE_URL}${value}`;
  return `${CLOUDFLARE_IMAGE_BASE}/${value}/${variant}`;
};

/**
 * <script type="application/ld+json"> 안에 넣을 문자열.
 * 사용자가 쓴 제목·본문에 `</script>` 가 있어도 태그를 닫지 못하게 `<`·`>`·`&` 를 유니코드 이스케이프한다.
 */
export const toJsonLdHtml = (data: unknown) =>
  JSON.stringify(data)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");

/** 분양글 상태(서버 값) → schema.org 재고 상태. */
export const productAvailability = (status: string | null | undefined) => {
  if (status === "판매완료") return "https://schema.org/SoldOut";
  if (status === "예약중") return "https://schema.org/LimitedAvailability";
  return "https://schema.org/InStock";
};

/** 메타 설명용: 줄바꿈·태그를 걷어내고 length 자로 자른다. */
export const toMetaDescription = (value: string | null | undefined, length = 150) => {
  const normalized = String(value ?? "")
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return normalized.length <= length ? normalized : `${normalized.slice(0, length)}…`;
};

/** 레이아웃 템플릿이 붙이는 ' | 브리디' 를 합친 제목 최대 길이(네이버 서치어드바이저 '제목 길이 확인 필요'). */
export const PAGE_TITLE_MAX = 40;
const TITLE_TEMPLATE_LENGTH = ` | ${SITE_NAME}`.length;

/**
 * 상세 제목. 글 제목 뒤에 종·종류(' - 크레스티드 게코 분양')를 붙이되, 넘치면 꼬리를 빼고 그래도 길면 글 제목을 자른다.
 * 결과에는 템플릿 꼬리(' | 브리디')가 없다.
 */
export const toPageTitle = (main: string, suffix?: string | null) => {
  const limit = PAGE_TITLE_MAX - TITLE_TEMPLATE_LENGTH;
  const base = main.trim().replace(/\s+/g, " ");
  const withSuffix = suffix ? `${base} - ${suffix}` : base;
  if (withSuffix.length <= limit) return withSuffix;
  if (base.length <= limit) return base;
  return `${base.slice(0, limit - 1).trimEnd()}…`;
};
