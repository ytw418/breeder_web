/** 이미지 서버 디폴트 유저 썸네일, 신규 가입시 필요 */
export const DEFAULT_THUMBNAIL_CDN =
  "https://static.plingcast.co.kr/icons/default-thumb.png";

/** 유저 썸네일에 문제 생겼을 경우 대체 시킬 기본 이미지 (로컬) */
export const DEFAULT_THUMBNAIL_LOCAL = "/images/default_thumbnail.png";

/** 이미지에 문제 생겼을 경우 대체 시킬 기본 이미지 (로컬) */
export const DEFAULT_IMAGE_LOCAL = "/images/default_image.png";

export const APP_STORE_URL =
  "https://apps.apple.com/kr/app/%ED%94%8C%EB%A7%81/id1497832962";

export const GOOGLE_PLAY_URL =
  "https://play.google.com/store/apps/details?id=com.plingcast.app";

export const ONE_LINK_URL = "https://pling.onelink.me/x1UM/11a5625o";

export const DEEP_LINK_URL = "https://pling.onelink.me/x1UM";

export const IMAGE_DOMAIN = "https://static.plingcast.co.kr/";

export const OS = {
  IOS: "ios",
  ANDROID: "android",
  WEB: "web",
};

export const Provider = {
  APPLE: "apple",
  GOOGLE: "google",
  KAKAO: "kakao",
} as const;

export const SynopsisTypes = {
  NOVEL: "NOVEL",
  AUDIO: "AUDIO",
} as const;

export type SynopTypeT = keyof typeof SynopsisTypes;

export const ContentsType = {
  NOVEL: "NOVEL",
  AUDIO: "AUDIO",
  PLINIST: "PLINIST",
} as const;

export type ContentsTypeT = keyof typeof ContentsType;

/** showTabV3 기본 타입들 */
export const MUTATION_DELAY = 3000;

export const ContentsTypeSmallLetter = {
  NOVEL: "novel",
  AUDIO: "audio",
} as const;

// 내서랍 무한스크롤 페이지 사이즈
export const PAGE_SIZE = 30;

export const StoryPurchaseType = {
  RENT: "RENT",
  PERM: "PERM",
  NOVEL_RENT: "NOVEL_RENT",
  NOVEL_PERM: "NOVEL_PERM",
} as const;

export const metaTitleLocale = {
  kr: { locale: "ko_KR" },
  us: { locale: "en_US" },
  jp: { locale: "ja_JP" },
};

export const Role = {
  USER: "USER",
  PLINIST: "PLINIST",
  ADMIN: "ADMIN",
  PUBLISHER: "PUBLISHER",
  SUBSCRIBER: "SUBSCRIBER",
};

export const MaxCharacter = {
  PLINIST_FEED: 1000,
  PLINIST_DONATION: 200,
  COMMENT: 500,
  WITHDRAW: 150,
};

export const CREATOR_TAKE = 3;
