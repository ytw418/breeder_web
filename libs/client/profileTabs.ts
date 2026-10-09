/** 프로필 밑줄 탭(앱 components/features/profile/UnderlineTabs.tsx PROFILE_TABS 와 같은 값). */
export type ProfileTab = "photos" | "posts" | "products" | "auctions" | "bloodlines";

/**
 * 2026-10-09 v4: 내 프로필·남 프로필·마이페이지가 같은 다섯 탭을 같은 순서로 쓴다.
 * 경매·혈통이 없어도 탭은 두고 빈 상태를 그린다(예전엔 있을 때만 보여 프로필마다 탭 수가 달랐다).
 */
export const PROFILE_TABS: readonly { id: ProfileTab; label: string }[] = [
  { id: "photos", label: "사진" },
  { id: "posts", label: "기록" },
  { id: "products", label: "분양" },
  { id: "auctions", label: "경매" },
  { id: "bloodlines", label: "혈통" },
];
