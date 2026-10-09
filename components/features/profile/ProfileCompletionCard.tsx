"use client";
/**
 * 본인 프로필 완성 카드(앱 ProfileCompletionCard, 앱 docs/prd/profile.md v5 F-19). 본인에게만 보인다.
 * 제목 + N/5 + 4px 진행 바 + 다음 할 일 한 줄. 다 채웠거나 판정에 쓸 값을 아직 못 받았으면 그리지 않는다.
 */
import { useRouter } from "next/navigation";
import { LineIcon } from "@components/features/profile/ProfileRows";
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
    hasPinnedPhoto: photoPosts.some((post) => Boolean(post.profilePinnedAt)),
    hasAlbum: userAlbumCount > 0,
    hasListing: (user._count?.products ?? 0) + (user._count?.auctions ?? 0) > 0,
  });
  if (!next) return null;
  const nextLabel = items.find((item) => item.id === next)?.label ?? "";

  const go = (id: ProfileCompletionItemId) => {
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
    <section aria-label="프로필 완성하기" className="mx-4 mb-4 rounded-xl bg-app-surface p-3.5">
      <div className="flex items-center justify-between">
        <h3 className="text-[15px] font-bold text-app-text">프로필 완성하기</h3>
        <span className="text-[13px] text-app-muted">
          {done}/{total}
        </span>
      </div>
      <div
        className="mt-2.5 h-1 overflow-hidden rounded-sm bg-app-elevated"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={done}
      >
        <div className="h-full rounded-sm bg-app-brand" style={{ width: `${(done / total) * 100}%` }} />
      </div>
      <button
        type="button"
        onClick={() => go(next)}
        className="mt-2.5 flex h-10 w-full items-center justify-between text-left"
      >
        <span className="text-[14px] font-semibold text-app-text">다음: {nextLabel}</span>
        <LineIcon name="chevron-right" size={18} className="text-app-caption" />
      </button>
      <p className="text-[12px] text-app-muted">채울수록 내 생물들이 더 잘 보여요</p>
    </section>
  );
}
