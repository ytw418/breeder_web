/**
 * 카카오톡 오픈채팅방에 붙여넣을 종별 소식 문구(2026-10-15 결정 — 카톡은 자동 발송하지 않고 운영자가 붙여넣는다).
 * 관리자 화면 `/admin/kakao-digest` 와 매일 아침 슬랙 발송이 같은 문구를 쓴다.
 * 링크마다 utm 을 붙여 어느 방에서 들어왔는지 PostHog 로 본다.
 */

export const KAKAO_DIGEST_SITE_URL = "https://bredy.app";

export interface KakaoDigestRoom {
  /** 방 구분 값(API·utm_campaign) */
  key: string;
  /** 카테고리 트리 이름(종 필터에 쓴다) */
  species: string;
  /** 문구 제목에 쓰는 짧은 이름 */
  label: string;
  emoji: string;
  /** 경매에 categoryId 가 비어 있을 때 이름으로 찾을 값 */
  aliases: string[];
}

export const KAKAO_DIGEST_ROOMS: KakaoDigestRoom[] = [
  {
    key: "crested",
    species: "크레스티드 게코",
    label: "크레",
    emoji: "🦎",
    aliases: ["크레스티드 게코", "크레스티드게코", "크레"],
  },
  {
    key: "insect",
    species: "곤충",
    label: "곤충",
    emoji: "🪲",
    aliases: ["곤충", "장수풍뎅이", "사슴벌레", "개미", "나비", "사마귀", "밀웜/귀뚜라미", "기타곤충", "나비/나방"],
  },
];

export const findKakaoDigestRoom = (key: string | null | undefined) =>
  KAKAO_DIGEST_ROOMS.find((room) => room.key === key) ?? null;

export interface KakaoDigestAuction {
  id: number;
  title: string;
  currentPrice: number;
  endAt: string | Date;
}

export interface KakaoDigestProduct {
  id: number;
  name: string;
  price: number | null;
  dealType: string | null;
  location: string | null;
}

export interface KakaoDigestPost {
  id: number;
  title: string;
}

export interface KakaoDigestData {
  endingAuctions: KakaoDigestAuction[];
  newProducts: KakaoDigestProduct[];
  /** 지난 24시간 새 분양글 전체 수(목록은 몇 개만 보인다) */
  newProductCount: number;
  openQuestions: KakaoDigestPost[];
  popularPosts: KakaoDigestPost[];
}

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

const toKst = (value: string | Date) => new Date(new Date(value).getTime() + KST_OFFSET_MS);

/** "10/15 (수)" — 서버가 UTC 여도 한국 날짜로 쓴다. */
export const formatDigestDate = (now: Date) => {
  const kst = toKst(now);
  return `${kst.getUTCMonth() + 1}/${kst.getUTCDate()} (${WEEKDAYS[kst.getUTCDay()]})`;
};

/** 마감 시각: 오늘이면 "오후 9시", 내일이면 "내일 오전 8시 30분". */
export const formatDigestEndAt = (endAt: string | Date, now: Date) => {
  const end = toKst(endAt);
  const today = toKst(now);
  const hours = end.getUTCHours();
  const minutes = end.getUTCMinutes();
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  const time = `${hours < 12 ? "오전" : "오후"} ${hour12}시${minutes ? ` ${minutes}분` : ""}`;
  return end.getUTCDate() === today.getUTCDate() ? time : `내일 ${time}`;
};

const formatWon = (value: number) => `${value.toLocaleString("ko-KR")}원`;

const productPriceText = (product: KakaoDigestProduct) => {
  if (product.dealType === "adoption" || product.price === 0) return "무료 분양";
  if (product.price == null) return "가격 문의";
  return formatWon(product.price);
};

const truncate = (text: string, max = 28) => {
  const trimmed = text.replace(/\s+/g, " ").trim();
  return trimmed.length > max ? `${trimmed.slice(0, max - 1)}…` : trimmed;
};

/** 방별 utm 을 붙인 링크. */
export const digestLink = (room: KakaoDigestRoom, path: string) => {
  const url = new URL(path, KAKAO_DIGEST_SITE_URL);
  url.searchParams.set("utm_source", "kakao");
  url.searchParams.set("utm_medium", "openchat");
  url.searchParams.set("utm_campaign", room.key);
  return url.toString();
};

/**
 * 카톡에 그대로 붙일 문구. 데이터가 하나도 없는 날은 첫 분양글을 권하는 짧은 글을 낸다
 * (빈 섹션 제목만 늘어놓으면 '사람 없는 서비스'로 보인다).
 */
export const formatKakaoDigest = (
  room: KakaoDigestRoom,
  data: KakaoDigestData,
  now: Date = new Date()
): string => {
  const lines: string[] = [`${room.emoji} 오늘의 ${room.label} 소식 ${formatDigestDate(now)}`];

  if (data.endingAuctions.length) {
    lines.push("", "🔥 24시간 안에 끝나는 경매");
    data.endingAuctions.forEach((auction) => {
      lines.push(
        `· ${truncate(auction.title)} — 현재 ${formatWon(auction.currentPrice)}, ${formatDigestEndAt(auction.endAt, now)} 마감`,
        `  ${digestLink(room, `/auctions/${auction.id}`)}`
      );
    });
  }

  if (data.newProducts.length) {
    lines.push("", `🆕 새 분양글 ${data.newProductCount}개`);
    data.newProducts.forEach((product) => {
      const where = product.location ? ` (${truncate(product.location, 12)})` : "";
      lines.push(
        `· ${truncate(product.name)} — ${productPriceText(product)}${where}`,
        `  ${digestLink(room, `/products/${product.id}`)}`
      );
    });
  }

  if (data.popularPosts.length) {
    lines.push("", "👀 많이 본 이야기");
    data.popularPosts.forEach((post) => {
      lines.push(`· ${truncate(post.title)}`, `  ${digestLink(room, `/posts/${post.id}`)}`);
    });
  }

  if (data.openQuestions.length) {
    lines.push("", "💬 답을 기다리는 질문");
    data.openQuestions.forEach((post) => {
      lines.push(`· "${truncate(post.title)}"`, `  ${digestLink(room, `/posts/${post.id}`)}`);
    });
  }

  const isQuiet =
    !data.endingAuctions.length &&
    !data.newProducts.length &&
    !data.popularPosts.length &&
    !data.openQuestions.length;

  if (isQuiet) {
    lines.push(
      "",
      `오늘은 ${room.label} 소식이 조용하네요.`,
      "키우는 아이 사진이나 분양 소식을 브리디에 먼저 올려 주세요 🙌"
    );
  }

  lines.push(
    "",
    `👉 ${room.label} 분양 전체 보기`,
    digestLink(room, `/products?category=${encodeURIComponent(room.species)}`)
  );

  return lines.join("\n");
};
