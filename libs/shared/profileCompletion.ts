/**
 * 본인 프로필 완성 카드(앱 src/lib/profileCompletion.ts 와 같은 사본 — 함께 고친다). 앱 docs/prd/profile.md v5.
 * 프로필 사진 → 소개 → 커버 사진 → 대표 링크(v6) → 대표 사진 고정 → 앨범 만들기 → 첫 분양 글 순서로 다음 할 일을 고른다.
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

const ITEMS: { id: ProfileCompletionItemId; label: string; key: keyof ProfileCompletionInput }[] = [
  { id: "avatar", label: "프로필 사진", key: "hasAvatar" },
  { id: "bio", label: "소개", key: "hasBio" },
  { id: "banner", label: "커버 사진", key: "hasBanner" },
  { id: "link", label: "대표 링크", key: "hasLink" },
  { id: "pin", label: "대표 사진 고정", key: "hasPinnedPhoto" },
  { id: "album", label: "앨범 만들기", key: "hasAlbum" },
  { id: "listing", label: "첫 분양 글", key: "hasListing" },
];

export function computeProfileCompletion(input: ProfileCompletionInput) {
  const items = ITEMS.map((item) => ({ id: item.id, label: item.label, done: input[item.key] }));
  const done = items.filter((item) => item.done).length;
  return {
    done,
    total: items.length,
    next: items.find((item) => !item.done)?.id ?? null,
    items,
  };
}
