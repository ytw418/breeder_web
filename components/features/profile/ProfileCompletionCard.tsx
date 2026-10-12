"use client";
/**
 * 본인 프로필 완성 카드(앱 ProfileCompletionCard, 앱 docs/prd/profile.md v5 F-19). 본인에게만 보인다.
 * community-vibe §3.8: brand-soft r16, 제목 16/700 + "2 / 7" 주황, 진행 바 6(#FDE1CC 트랙 + 주황),
 * 다음 할 일 행(흰 36 사각 아이콘 + 할 일 15/600 + 보상 문구 12 brand-text-soft + ›).
 * 보상 문구·목적지는 profileCompletion 의 reward·href 를 쓰고, 없으면(옛 사본) 할 일 이름만 보인다.
 * 다 채웠거나 판정에 쓸 값을 아직 못 받았으면 그리지 않는다.
 */
import { useRouter } from "next/navigation";
import { toast } from "@libs/client/toast";
import { computeProfileCompletion, type ProfileCompletionItemId } from "@libs/shared/profileCompletion";

export default function ProfileCompletionCard({
  user,
  photoPosts,
  userAlbumCount,
  onGoPhotosTab,
}: {
  user?: {
    avatar?: string | null;
    bio?: string | null;
    profileBanner?: string | null;
    profileLink?: string | null;
    _count?: { products?: number; auctions?: number };
  };
  /** 사진 탭 1페이지(고정 글이 맨 앞에 온다). 아직 못 받았으면 undefined. */
  photoPosts?: { profilePinnedAt?: string | Date | null }[];
  /** 내가 만든 앨범 수. 아직 못 받았으면 undefined. */
  userAlbumCount?: number;
  onGoPhotosTab: () => void;
}) {
  const router = useRouter();
  if (!user || photoPosts === undefined || userAlbumCount === undefined) return null;

  const { done, total, next, items } = computeProfileCompletion({
    hasAvatar: Boolean(user.avatar),
    hasBio: Boolean(user.bio?.trim()),
    hasBanner: Boolean(user.profileBanner),
    hasLink: Boolean(user.profileLink),
    hasPinnedPhoto: photoPosts.some((post) => Boolean(post.profilePinnedAt)),
    hasAlbum: userAlbumCount > 0,
    hasListing: (user._count?.products ?? 0) + (user._count?.auctions ?? 0) > 0,
  });
  if (!next) return null;
  const nextItem = items.find((item) => item.id === next) as
    | ((typeof items)[number] & { reward?: string; href?: string })
    | undefined;
  const nextLabel = nextItem?.label ?? "";
  const nextReward = nextItem?.reward ?? null;
  const nextHref = nextItem?.href ?? null;

  const go = (id: ProfileCompletionItemId) => {
    if (nextHref && id !== "pin") {
      router.push(nextHref);
      return;
    }
    if (id === "pin") {
      // 고정은 사진 칸 ⋯ 에서 한다. 사진 글이 없으면 먼저 올리게 한다.
      if (photoPosts.length) {
        onGoPhotosTab();
        toast.info("사진의 ⋯ 에서 프로필에 고정할 수 있어요");
      } else {
        router.push("/posts/upload");
      }
      return;
    }
    router.push(
      id === "album" ? "/albums/edit" : id === "listing" ? "/products/upload" : "/editProfile"
    );
  };

  return (
    <section
      aria-label="프로필 완성하기"
      className="mx-4 mb-4 mt-4 rounded-2xl bg-app-brand-soft p-4"
      data-testid="profile-completion-card"
    >
      <div className="flex items-baseline justify-between">
        <h3 className="text-[16px] font-bold leading-[22px] text-app-text">프로필 완성하기</h3>
        <span className="text-[14px] font-bold text-app-brand tabular-nums">
          {done} / {total}
        </span>
      </div>
      <div
        className="mt-2 h-1.5 overflow-hidden rounded-full bg-app-brand-track"
        role="progressbar"
        aria-label="프로필 완성도"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={done}
      >
        <div className="h-full rounded-full bg-app-brand" style={{ width: `${(done / total) * 100}%` }} />
      </div>
      <button
        type="button"
        onClick={() => go(next)}
        className="mt-3 flex w-full items-center gap-3 text-left"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-app-bg text-app-brand">
          <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" aria-hidden="true">
            {next === "avatar" ? (
              <>
                <circle cx="12" cy="8" r="4" />
                <path d="M4 21a8 8 0 0 1 16 0" />
              </>
            ) : (
              <path d="M12 5v14M5 12h14" />
            )}
          </svg>
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-semibold leading-5 text-app-text">{nextLabel}</span>
          {nextReward ? (
            <span className="mt-0.5 block truncate text-[12px] leading-4 text-app-brand-text-soft">{nextReward}</span>
          ) : null}
        </span>
        <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden="true" className="shrink-0 text-app-brand-text-soft">
          <path d="m9 6 6 6-6 6" />
        </svg>
      </button>
    </section>
  );
}
