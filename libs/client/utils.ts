import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

const DEFAULT_FALLBACK_IMAGE = "/images/placeholders/minimal-gray-blur.svg";

/**
 * 클래스 이름을 병합하는 함수
 * @param inputs 클래스 이름 배열
 * @returns 병합된 클래스 이름
 *
 * 예시
 * cn("text-red-500", "text-blue-500") => "text-red-500 text-blue-500"
 * cn("text-red-500", "text-blue-500", "text-green-500") => "text-red-500 text-blue-500 text-green-500"
 *
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type Variants = "avatar" | "product" | "list" | "public";

/**
 * 이미지 주소를 생성하는 함수
 * @param imageId 이미지 id
 * @param variant 이미지 타입 기본값 "public"
 * @returns 이미지 주소
 *
 * imageId 는 클라우드 플레어에서 받은 이미지 id 이다.
 * 클라우드 플레어아이디 말고 그냥 이미지 주소를 넣어도 된다.
 *
 * 클라우드 플레어 경로
 * https://imagedelivery.net/OvWZrAz6J6K7n9LKUH5pKw/${imageId}/${variant}
 *
 * 예시
 * https://imagedelivery.net/OvWZrAz6J6K7n9LKUH5pKw/1234567890/public
 * https://imagedelivery.net/OvWZrAz6J6K7n9LKUH5pKw/1234567890/avatar
 * https://imagedelivery.net/OvWZrAz6J6K7n9LKUH5pKw/1234567890/product
 * https://imagedelivery.net/OvWZrAz6J6K7n9LKUH5pKw/1234567890/list
 */
export function makeImageUrl(
  imageId: string | undefined | null,
  variant: undefined | Variants = "public"
) {
  if (!imageId) {
    return DEFAULT_FALLBACK_IMAGE;
  }
  const normalized = imageId.trim();
  if (!normalized) {
    return DEFAULT_FALLBACK_IMAGE;
  }
  if (normalized.startsWith("/")) {
    // 내부 정적 경로(public/*)는 그대로 사용
    return normalized;
  }
  if (normalized.includes("http")) {
    // 구글이나 카카오 로그인시 프로필 사진의 경우
    return normalized;
  }
  return `https://imagedelivery.net/OvWZrAz6J6K7n9LKUH5pKw/${normalized}/${variant}`;
}

/**
 * 시간 차이를 계산하는 함수
 * @param targetDate 비교할 날짜
 * @returns 시간 차이 문자열
 *
 * 예시
 * 1년 전
 * 1달 전
 * 1일 전
 *
 */
export const getTimeAgoString = (targetDate: Date): string => {
  const now = new Date();
  const diffInMilliseconds = now.getTime() - targetDate.getTime();

  const minutes = Math.floor(diffInMilliseconds / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const months = Math.floor(days / 30);
  const years = Math.floor(days / 365);

  if (years > 0) {
    return years === 1 ? "일 년 전" : `${years}년 전`;
  } else if (months > 0) {
    return months === 1 ? "한 달 전" : `${months}달 전`;
  } else if (days > 1) {
    return `${days}일 전`;
  } else if (days === 1) {
    return "하루 전";
  } else if (hours > 0) {
    return `${hours}시간 전`;
  } else if (minutes > 0) {
    return `${minutes}분 전`;
  } else {
    return "방금 전";
  }
};

// // 예제 사용
// const targetDate = new Date('2023-08-03T12:30:00'); // 특정 날짜
// const result = getTimeAgoString(targetDate);
// console.log(result);
