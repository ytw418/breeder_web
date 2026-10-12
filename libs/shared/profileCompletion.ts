/**
 * 본인 프로필 완성 카드(앱 src/lib/profileCompletion.ts 와 같은 사본 — 함께 고친다). 앱 docs/prd/profile.md v5.
 * 프로필 사진 → 소개 → 커버 사진 → 대표 링크(v6) → 대표 사진 고정 → 앨범 만들기 → 첫 분양 글 순서로 다음 할 일을 고른다.
 * 2026-10-12(앱 docs/prd/community-vibe.md §3.8): 단계마다 노출 보상 문구(reward)와 목적지(href)를 붙인다.
 * href 는 앱·웹 같은 경로다(docs/parity 경로 대조).
 */

export type ProfileCompletionItemId =
  | "avatar"
  | "bio"
  | "banner"
  | "link"
  | "pin"
  | "album"
  | "listing";

export interface ProfileCompletionInput {
  hasAvatar: boolean;
  hasBio: boolean;
  /** 커버 이미지를 올렸다(v6) */
  hasBanner: boolean;
  /** 대표 링크를 적었다(v6) */
  hasLink: boolean;
  /** 프로필에 고정한 사진 글이 1개 이상 */
  hasPinnedPhoto: boolean;
  /** 내가 만든 앨범이 1개 이상 */
  hasAlbum: boolean;
  /** 상품(판매·분양)이나 경매를 1개 이상 올렸다 */
  hasListing: boolean;
}

export interface ProfileCompletionItemDef {
  id: ProfileCompletionItemId;
  label: string;
  key: keyof ProfileCompletionInput;
  /** 하면 어디에 보이는지(다음 할 일 행 둘째 줄). */
  reward: string;
  /** 누르면 가는 곳. */
  href: string;
}

const PROFILE_EDIT_HREF = "/editProfile";

const ITEMS: ProfileCompletionItemDef[] = [
  { id: "avatar", label: "프로필 사진", key: "hasAvatar", reward: "올리면 홈 '우리 동네 브리더'에 보여요", href: PROFILE_EDIT_HREF },
  { id: "bio", label: "소개", key: "hasBio", reward: "분양글 작성자 줄에 한 줄 소개가 붙어요", href: PROFILE_EDIT_HREF },
  { id: "banner", label: "커버 사진", key: "hasBanner", reward: "프로필이 '새로 온 브리더' 레일에 올라가요", href: PROFILE_EDIT_HREF },
  { id: "link", label: "대표 링크", key: "hasLink", reward: "프로필 공유 링크가 깔끔해져요", href: PROFILE_EDIT_HREF },
  { id: "pin", label: "대표 사진 고정", key: "hasPinnedPhoto", reward: "프로필 사진 탭 맨 위에 고정돼요", href: PROFILE_EDIT_HREF },
  { id: "album", label: "앨범 만들기", key: "hasAlbum", reward: "프로필 사진 탭이 채워져요", href: "/albums/edit" },
  { id: "listing", label: "첫 분양 글", key: "hasListing", reward: "홈 '지금 올라온 분양'에 24시간 보여요", href: "/products/upload" },
];

/** 단계 정의(보상 문구·목적지 포함). */
export const PROFILE_COMPLETION_ITEMS: readonly ProfileCompletionItemDef[] = ITEMS;

export function computeProfileCompletion(input: ProfileCompletionInput) {
  const items = ITEMS.map((item) => ({
    id: item.id,
    label: item.label,
    done: input[item.key],
    reward: item.reward,
    href: item.href,
  }));
  const done = items.filter((item) => item.done).length;
  return {
    done,
    total: items.length,
    next: items.find((item) => !item.done)?.id ?? null,
    /** 다음 할 일 행(라벨·보상 문구·목적지). 다 했으면 null. */
    nextItem: items.find((item) => !item.done) ?? null,
    items,
  };
}
