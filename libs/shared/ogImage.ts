/**
 * 공유 미리보기(OG·트위터) 이미지 주소.
 *
 * 메타(스레드·인스타·페북)는 미리보기 이미지를 주소 기준으로 오래 캐시한다. 같은 주소에서 그림만 바꾸면
 * 한 달 가까이 옛 그림이 나온다(2026-10-14 스레드에 10-07 이전 이미지가 계속 보였다).
 * app/opengraph-image.tsx(twitter-image 는 같은 그림)를 바꾸면 OG_IMAGE_VERSION 을 그날 날짜로 올린다.
 */
export const OG_IMAGE_VERSION = "2026-10-07";

export const SITE_OG_IMAGE = `/opengraph-image?v=${OG_IMAGE_VERSION}`;
export const SITE_TWITTER_IMAGE = `/twitter-image?v=${OG_IMAGE_VERSION}`;
