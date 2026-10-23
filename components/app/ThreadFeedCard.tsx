"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import Image from "@components/atoms/Image";
import { CardOverlayLink } from "@components/app/AuthorLink";
import type { PostCardData } from "@components/app/PostCard";
import {
  BreederProgramBadge,
  getBreederProgramFrameClassName,
  hasBreederProgramFrame,
} from "@components/features/breeder/BreederProgramDecorators";
import DebateCardBody from "@components/features/debate/DebateCardBody";
import { DebatePill } from "@components/features/debate/DebateParts";
import { avatarInitial, avatarToneClass } from "@components/ui/avatarTone";
import { authFetch } from "@libs/client/authFetch";
import { shareOrCopy } from "@libs/client/share";
import { useIsUnread } from "@libs/client/unreadMarks";
import { cn, getTimeAgoString, makeImageUrl } from "@libs/client/utils";
import { getProductPath } from "@libs/product-route";
import { toPostPath } from "@libs/post-route";
import type { BreederProgramSummary } from "@libs/shared/breeder-program";
import { DEBATE_CATEGORY } from "@libs/shared/debateFormat";
import { isNewcomer } from "@libs/shared/newcomer";
import { toPostPlainText } from "@libs/shared/post-body";
import { petPostPlace } from "@libs/shared/petSpace";
import { productPriceText } from "@libs/shared/price";
import { productStatusLabel } from "@libs/shared/productTerms";
import useUser from "hooks/useUser";

/**
 * 홈 쓰레드식 피드 한 줄(앱 docs/prd/home-v2.md S-1 v2, 시안 design/mockups/home-photo-question/C-threads.html).
 * 작성자 줄(아바타 36 + 이름 15/600 + 칭호 + 시간) 아래로 카드 폭 전체: 제목 16/600 한 줄 + 본문 16/24 3줄
 * → 사진(1장 4:3, 2장 이상 정사각 2칸) → 동작 줄(하트·댓글·공유 18) → 최신 댓글 한 줄 15.
 * 아바타가 왼쪽 열을 차지하지 않는다(2026-10-22 사용자 "왼쪽이 비어 보인다, 아바타·닉네임을 한 묶음으로").
 * 글자는 같은 날 사용자 "글씨가 너무 작다"로 1px 키웠다(제목·본문 15 → 16, 이름·최신 댓글 14 → 15).
 * 테두리 버튼 없이 surface 채움(36·40 r8), 간격 4·8·12·16.
 * 카드 전체는 투명 상세 링크가 덮고 아바타·이름·하트·공유·토론 버튼만 그 위로 올라온다(z-[2]).
 * 앱 src/components/features/home/ThreadFeedCard.tsx 와 같다.
 */

const QUESTION_CATEGORY = "질문";

type ThreadUser = {
  id?: number;
  name: string;
  avatar?: string | null;
  breederPrograms?: BreederProgramSummary[] | null;
  titleLabel?: string | null;
  createdAt?: string | Date | null;
};

export type ThreadPostData = PostCardData & {
  /** 로그인 viewer 가 좋아요한 글(목록 API liked). 비로그인·구 서버는 없다. */
  liked?: boolean;
};

export type ThreadProductData = {
  id: number;
  name: string;
  description?: string | null;
  price: number | null;
  photos?: string[] | null;
  status?: string | null;
  location?: string | null;
  /** 강아지·고양이 글은 가격 대신 글 종류를 보인다(productPriceText). */
  category?: string | null;
  dealType?: string | null;
  /** 가족 찾아요·임보 구해요 글에 남긴 동네(§5.9). 있으면 가격 옆에 location 대신 "마포구". */
  regionSido?: string | null;
  regionSigungu?: string | null;
  createdAt: string | Date;
  userId?: number | null;
  user?: ThreadUser | null;
  _count?: { favs?: number } | null;
};

const timeAgo = (value: string | Date) => {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? "" : getTimeAgoString(date);
};

/** 본문 미리보기: 사진 표시·마크다운 기호·줄바꿈을 걷어 낸다. */
const toExcerpt = (value?: string | null) =>
  toPostPlainText(value ?? "")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/[#>*_`~]/g, "")
    .replace(/\s+/g, " ")
    .trim();

function ThreadAvatar({ user }: { user: ThreadUser }) {
  const framed = hasBreederProgramFrame(user.breederPrograms);
  const face = user.avatar ? (
    <Image
      src={makeImageUrl(user.avatar, "avatar")}
      className="h-9 w-9 rounded-full object-cover"
      width={36}
      height={36}
      alt={`${user.name} 프로필 사진`}
    />
  ) : (
    <span
      className={cn(
        "flex h-9 w-9 items-center justify-center rounded-full text-[14px] font-bold",
        avatarToneClass(user.name)
      )}
    >
      {avatarInitial(user.name)}
    </span>
  );
  const framedFace = (
    <span
      className={cn(
        "block shrink-0",
        framed && "rounded-full",
        framed && getBreederProgramFrameClassName(user.breederPrograms, { compact: true })
      )}
    >
      {face}
    </span>
  );
  if (user.id == null) return framedFace;
  return (
    <Link
      href={`/profiles/${user.id}`}
      aria-label={`${user.name} 프로필`}
      className="relative z-[2] block shrink-0"
    >
      {framedFace}
    </Link>
  );
}

function WhoRow({ user, createdAt }: { user: ThreadUser | null | undefined; createdAt: string | Date }) {
  const ago = timeAgo(createdAt);
  return (
    <div className="flex min-h-[22px] min-w-0 items-center gap-1 text-[15px] leading-[22px]">
      {user ? (
        user.id != null ? (
          <Link
            href={`/profiles/${user.id}`}
            className="relative z-[2] min-w-0 truncate font-semibold text-app-text"
          >
            {user.name}
          </Link>
        ) : (
          <span className="min-w-0 truncate font-semibold text-app-text">{user.name}</span>
        )
      ) : null}
      {user ? <BreederProgramBadge programs={user.breederPrograms} /> : null}
      {user?.titleLabel ? (
        <span className="app-title-pill-sm" data-testid="author-title-pill">
          {user.titleLabel}
        </span>
      ) : null}
      {user && isNewcomer(user.createdAt) ? (
        <span className="app-title-pill-sm" data-testid="newcomer-pill">
          새로 왔어요
        </span>
      ) : null}
      {ago ? <span className="shrink-0 text-[13px] text-app-muted">· {ago}</span> : null}
    </div>
  );
}

/** 작성자 줄: 아바타와 이름·칭호·시간을 한 묶음으로 두고, 글은 그 아래 카드 폭 전체를 쓴다. */
function AuthorRow({ user, createdAt }: { user: ThreadUser | null | undefined; createdAt: string | Date }) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      {user ? <ThreadAvatar user={user} /> : <span className="h-9 w-9 shrink-0" />}
      <div className="min-w-0 flex-1">
        <WhoRow user={user} createdAt={createdAt} />
      </div>
    </div>
  );
}

function PhotoGrid({ images, alt }: { images: string[]; alt: string }) {
  if (!images.length) return null;
  if (images.length === 1) {
    return (
      <div className="relative mt-3 aspect-[4/3] w-full overflow-hidden rounded-lg bg-app-placeholder">
        <Image src={makeImageUrl(images[0], "public")} alt={alt} fill className="object-cover" sizes="(max-width: 576px) 90vw, 520px" />
      </div>
    );
  }
  const extra = images.length - 2;
  return (
    <div className="mt-3 flex gap-1">
      {images.slice(0, 2).map((image, index) => (
        <div key={`${image}-${index}`} className="relative aspect-square flex-1 overflow-hidden rounded-lg bg-app-placeholder">
          <Image src={makeImageUrl(image, "public")} alt={alt} fill className="object-cover" sizes="(max-width: 576px) 45vw, 260px" />
          {index === 1 && extra > 0 ? (
            <span className="absolute inset-0 flex items-center justify-center bg-app-overlay text-[15px] font-semibold text-white">
              +{extra}
            </span>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function HeartIcon({ filled }: { filled?: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden className={filled ? "text-app-brand" : "text-app-muted"}>
      <path
        d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z"
        fill={filled ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CommentIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden className="text-app-muted">
      <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12Z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}

function ShareButton({ title, url }: { title: string; url: string }) {
  return (
    <button
      type="button"
      aria-label="공유하기"
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        void shareOrCopy({ title, url });
      }}
      className="relative z-[2] -m-2 ml-auto flex items-center p-2 text-app-muted"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
        <path
          d="M4 12v7h16v-7M12 3v12M7.5 7.5 12 3l4.5 4.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}

const toLoginHref = (next: string) => `/auth/login?next=${encodeURIComponent(next)}`;

/** 피드 하트: 로그인 viewer 는 바로 좋아요(낙관 갱신, 실패하면 되돌림), 비로그인은 로그인으로. */
function LikeButton({ postId, initialLiked, initialCount }: { postId: number; initialLiked: boolean; initialCount: number }) {
  const router = useRouter();
  const { user } = useUser();
  const [state, setState] = useState({ liked: initialLiked, count: initialCount });
  const [pending, setPending] = useState(false);
  const toggle = async () => {
    if (!user) {
      router.push(toLoginHref(`${window.location.pathname}${window.location.search}`));
      return;
    }
    if (pending) return;
    const previous = state;
    setState({ liked: !previous.liked, count: Math.max(0, previous.count + (previous.liked ? -1 : 1)) });
    setPending(true);
    try {
      const response = await authFetch(`/api/posts/${postId}/wonder`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!response.ok) throw new Error("like failed");
    } catch {
      setState(previous);
    } finally {
      setPending(false);
    }
  };
  return (
    <button
      type="button"
      aria-label={state.liked ? "좋아요 취소" : "좋아요"}
      aria-pressed={state.liked}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        void toggle();
      }}
      className={cn("relative z-[2] -m-2 flex items-center gap-1 p-2", state.liked ? "text-app-brand-text" : "text-app-muted")}
    >
      <HeartIcon filled={state.liked} />
      <span className="tabular-nums">{state.count}</span>
    </button>
  );
}

export function ThreadPostCard({ post, className }: { post: ThreadPostData; className?: string }) {
  const href = toPostPath(post.id, post.title);
  const images = post.images?.length ? post.images : post.image ? [post.image] : [];
  const debate = post.category === DEBATE_CATEGORY ? post.debate ?? null : null;
  const isQuestion = post.category === QUESTION_CATEGORY;
  const excerpt = debate ? "" : toExcerpt(post.content ?? post.description);
  const comments = post._count?.comments ?? 0;
  const likes = post._count?.Likes ?? 0;
  const latest = post.latestComment;
  const unread = useIsUnread("post", { id: post.id, createdAt: post.createdAt, authorId: post.user?.id ?? null });
  const awaitingAnswer = isQuestion && comments === 0 && !post.resolvedAt;

  return (
    <article className={cn("relative border-b border-app-line bg-app-bg p-4", className)} data-testid="thread-post">
      <CardOverlayLink href={href} label={post.title} />
      <AuthorRow user={post.user} createdAt={post.createdAt} />
      <div className="mt-2 flex min-w-0 items-center gap-1">
        {unread ? <span aria-label="안 본 글" className="h-1.5 w-1.5 shrink-0 rounded-full bg-app-danger" /> : null}
        {isQuestion ? (
          <span
            className={cn(
              "h-5 shrink-0 rounded-lg px-1.5 text-[12px] font-semibold leading-5",
              "bg-app-brand-soft text-app-brand-text"
            )}
          >
            {post.resolvedAt ? "해결" : "질문"}
          </span>
        ) : debate ? (
          <DebatePill />
        ) : null}
        <p className="min-w-0 truncate text-[16px] font-semibold leading-6 text-app-text">{post.title}</p>
      </div>
      {excerpt ? (
        <p className="line-clamp-3 break-keep text-[16px] leading-6 text-app-sub">{excerpt}</p>
      ) : null}
      {debate ? <DebateCardBody postId={post.id} debate={debate} size="feed" /> : <PhotoGrid images={images} alt={post.title} />}
      {awaitingAnswer ? (
        <Link
          href={href}
          className="relative z-[2] mt-3 flex h-9 items-center gap-1.5 rounded-lg bg-app-surface px-3 text-[15px] text-app-muted active:opacity-80"
        >
          아직 답이 없어요
          <span className="ml-auto text-[13px] font-semibold text-app-brand-text">첫 답 남기기</span>
        </Link>
      ) : null}
      <div className="mt-3 flex items-center gap-4 text-[13px] leading-[18px] text-app-muted">
        <LikeButton postId={post.id} initialLiked={Boolean(post.liked)} initialCount={likes} />
        {/* 말풍선·'첫 답 남기기'는 글을 본문부터 연다(입력바는 상세 아래 고정, 2026-10-22 사용자 피드백). */}
        <Link
          href={href}
          aria-label={`댓글 ${comments}개, 댓글 쓰기`}
          className="relative z-[2] -m-2 flex items-center gap-1 p-2"
        >
          <CommentIcon />
          <span className="tabular-nums">{comments}</span>
        </Link>
        <ShareButton title={post.title} url={href} />
      </div>
      {latest && !debate ? (
        <p className="mt-2 truncate text-[15px] leading-[22px] text-app-sub">
          {latest.user?.name ? <b className="mr-1 font-semibold text-app-text">{latest.user.name}</b> : null}
          {latest.comment}
        </p>
      ) : null}
    </article>
  );
}

export function ThreadProductCard({ product, className }: { product: ThreadProductData; className?: string }) {
  const href = getProductPath(product.id, product.name);
  const images = product.photos ?? [];
  const excerpt = toExcerpt(product.description);
  const favs = product._count?.favs ?? 0;
  const unread = useIsUnread("product", { id: product.id, createdAt: product.createdAt, authorId: product.userId ?? null });
  const onSale = !product.status || product.status === "판매중";
  const place = petPostPlace(product) ?? product.location;

  return (
    <article className={cn("relative border-b border-app-line bg-app-bg p-4", className)} data-testid="thread-product">
      <CardOverlayLink href={href} label={product.name} />
      <AuthorRow
        user={product.user ? { ...product.user, id: product.user.id ?? product.userId ?? undefined } : null}
        createdAt={product.createdAt}
      />
      <div className="mt-2 flex min-w-0 items-center gap-1">
        {unread ? <span aria-label="안 본 글" className="h-1.5 w-1.5 shrink-0 rounded-full bg-app-danger" /> : null}
        <p className="min-w-0 truncate text-[16px] font-semibold leading-6 text-app-text">{product.name}</p>
      </div>
      {excerpt ? <p className="line-clamp-2 break-keep text-[16px] leading-6 text-app-sub">{excerpt}</p> : null}
      <PhotoGrid images={images} alt={product.name} />
      <div className="mt-2 flex h-10 min-w-0 items-center gap-1.5 rounded-lg bg-app-gap px-3 text-[13px] text-app-muted">
        <span className={cn("shrink-0 text-[12px] font-semibold", onSale ? "text-app-brand-text" : "text-app-muted")}>
          {productStatusLabel(product.status ?? "판매중")}
        </span>
        <span className="shrink-0 text-[16px] font-bold text-app-text">{productPriceText(product)}</span>
        {place ? <span className="min-w-0 truncate">· {place}</span> : null}
        <span className="ml-auto flex shrink-0 items-center gap-0.5 font-semibold text-app-sub">
          채팅하기
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden>
            <path d="m9 6 6 6-6 6" />
          </svg>
        </span>
      </div>
      <div className="mt-3 flex items-center gap-4 text-[13px] leading-[18px] text-app-muted">
        <span className="flex items-center gap-1" aria-label={`관심 ${favs}`}>
          <HeartIcon />
          <span className="tabular-nums">{favs}</span>
        </span>
        <ShareButton title={product.name} url={href} />
      </div>
    </article>
  );
}
