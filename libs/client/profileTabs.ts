/** 프로필 밑줄 탭(앱 profiles/[id]/index.tsx 와 같은 규칙). */
export type ProfileTab = "photos" | "posts" | "products" | "auctions" | "bloodlines";

/**
 * 보일 탭: 사진 · 기록 · 분양 · [경매] · [혈통].
 * 경매는 숨기지 않은 경매가 있을 때(구 서버 응답처럼 수가 없으면 보인다), 혈통은 만든·보유 혈통이 있을 때만.
 */
export function profileTabs(counts?: {
  auctions?: number;
  ownedBloodlineCards?: number;
  createdBloodlineCards?: number;
}) {
  const showAuctions = counts ? (counts.auctions === undefined ? true : counts.auctions > 0) : false;
  const showBloodlines = (counts?.ownedBloodlineCards ?? 0) + (counts?.createdBloodlineCards ?? 0) > 0;
  return [
    { id: "photos" as const, label: "사진" },
    { id: "posts" as const, label: "기록" },
    { id: "products" as const, label: "분양" },
    ...(showAuctions ? [{ id: "auctions" as const, label: "경매" }] : []),
    ...(showBloodlines ? [{ id: "bloodlines" as const, label: "혈통" }] : []),
  ];
}

/** 보던 탭이 사라지면(예: 경매가 모두 숨겨짐) 사진 탭으로 돌아간다. */
export function visibleTab<T extends string>(tabs: readonly { id: T }[], active: T, fallback: T): T {
  return tabs.some((tab) => tab.id === active) ? active : fallback;
}
