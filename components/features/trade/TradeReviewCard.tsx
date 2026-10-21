"use client";

import { useState, type ReactNode } from "react";
import { ActionSheet } from "@components/app/ActionSheet";
import { AuthorLink } from "@components/app/AuthorLink";
import { useTradeReviewRefresh } from "@components/features/trade/useTradeReviewRefresh";
import { InitialAvatar } from "@components/ui/InitialAvatar";
import useConfirmDialog from "hooks/useConfirmDialog";
import { authFetch } from "@libs/client/authFetch";
import { toast } from "@libs/client/toast";
import { cn, formatMonthDay } from "@libs/client/utils";
import { isDeletedUserName } from "@libs/shared/deletedUser";
import {
  isHiddenTradeReview,
  keywordLabel,
  type ProductTradeReview,
  type TradeReviewPublic,
} from "@libs/shared/tradeReview";

/**
 * 거래 후기 표시(앱 TradeReviewCard, 앱 docs/prd/trade-review.md S-3·S-7·S-8, 시안 #detail-seller-review
 * #detail-buyer-reviewed #detail-review-hidden #sheet-reply #reviews-list #dark-review).
 * 작성자 AuthorLink(아바타 24 · 닉네임 13/600, 누르면 프로필 — 탈퇴한 사용자는 누를 수 없다) + 날짜 12 muted,
 * 읽기 전용 키워드 칩 28 r14 gap 바탕 12, 분양자 답글(2px surface 세로선 · '분양자 답글' 11 muted · 13/19).
 * 운영자에게는 작성자 줄 오른쪽에 ⋯(숨기기·숨김 해제, web-only — 앱 docs/prd/trade-review.md §3.6).
 */
export function TradeReviewContent({
  review,
  linkAuthor = true,
  beforeReply,
  menu,
  children,
}: {
  review: TradeReviewPublic;
  /** 작성자를 눌러 프로필로 간다. 시트 안 요약처럼 화면을 옮기면 안 되는 곳은 false. */
  linkAuthor?: boolean;
  /** 키워드와 답글 사이(받은 후기 목록의 분양글 줄). */
  beforeReply?: ReactNode;
  /** 작성자 줄 오른쪽(운영자 ⋯). */
  menu?: ReactNode;
  /** 맨 아래('답글 남기기' 버튼). */
  children?: ReactNode;
}) {
  const { author } = review;
  const labels = review.keywords.map(keywordLabel).filter(Boolean);
  const nameClassName = "text-[13px] font-semibold text-app-text";
  return (
    <div>
      <div className="flex items-center gap-1.5">
        {!linkAuthor || isDeletedUserName(author.name) ? (
          <span className="flex min-w-0 items-center gap-1.5">
            <InitialAvatar name={author.name} avatar={author.avatar} size={24} />
            <span className={cn("min-w-0 truncate", nameClassName)}>{author.name}</span>
          </span>
        ) : (
          <AuthorLink user={author} avatarSize={24} className="gap-1.5" nameClassName={nameClassName} />
        )}
        <span className="shrink-0 text-[12px] text-app-muted">{formatMonthDay(review.createdAt)}</span>
        {menu ? <span className="ml-auto shrink-0">{menu}</span> : null}
      </div>
      {labels.length > 0 ? (
        <ul aria-label={`좋았던 점: ${labels.join(", ")}`} className="mt-2 flex flex-wrap gap-1.5">
          {labels.map((label) => (
            <li
              key={label}
              className="inline-flex h-7 items-center rounded-[14px] bg-app-gap px-2.5 text-[12px] text-app-text"
            >
              {label}
            </li>
          ))}
        </ul>
      ) : null}
      {beforeReply}
      {review.reply ? (
        <div className="mt-2.5 border-l-2 border-app-surface py-0.5 pl-2.5">
          <p className="text-[11px] text-app-muted">분양자 답글</p>
          <p className="mt-0.5 whitespace-pre-wrap break-words text-[13px] leading-[19px] text-app-text">
            {review.reply}
          </p>
        </div>
      ) : null}
      {children}
    </div>
  );
}

/** '답글 남기기' 보조 40 r6(surface · 14/600, 시안 .b40.inl). */
export function TradeReplyButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label="거래 후기에 답글 남기기"
      onClick={onClick}
      className="mt-3 h-10 w-full rounded-md bg-app-surface text-[14px] font-semibold text-app-text"
    >
      답글 남기기
    </button>
  );
}

/** 후기 블록 틀(r8 · 1px surface 테두리 · 패딩 12, 시안 .rvb). */
export function TradeReviewFrame({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("mx-4 mb-4 rounded-lg border border-app-surface p-3", className)}>{children}</div>;
}

/**
 * 운영자 후기 숨김 ⋯(web-only, PATCH /api/admin/reviews/:id, 앱 docs/prd/trade-review.md §3.6).
 * 공개 후기는 '숨기기 (관리자)', 숨긴 후기 자리표시는 '숨김 해제 (관리자)'. 확인 창 뒤 화면 값을 다시 받는다.
 */
export function TradeReviewAdminMenu({ reviewId, hidden }: { reviewId: number; hidden: boolean }) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const { confirm, confirmDialog } = useConfirmDialog();
  const refresh = useTradeReviewRefresh();

  const run = async () => {
    if (pending) return;
    const ok = await confirm(
      hidden
        ? {
            title: "이 거래 후기의 숨김을 해제할까요?",
            description: "다시 분양글과 분양자 프로필 '후기 N'에 보입니다.",
            confirmText: "숨김 해제",
          }
        : {
            title: "이 거래 후기를 숨길까요?",
            description: "운영 정책 위반으로 비공개 처리합니다. '후기 N'·받은 거래 후기에서 빠지고 작성자·분양자에게는 숨겨진 후기로 보입니다.",
            confirmText: "숨기기",
            tone: "danger",
          }
    );
    if (!ok) return;
    setPending(true);
    try {
      const res = await authFetch(`/api/admin/reviews/${reviewId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isHidden: !hidden }),
      });
      const result = (await res.json().catch(() => null)) as { success?: boolean; error?: string } | null;
      if (!res.ok || !result?.success) throw new Error(result?.error || "조치에 실패했습니다.");
      toast.success(hidden ? "숨김을 해제했습니다." : "숨김 처리했습니다.");
      void refresh();
    } catch (error) {
      toast.error(error instanceof Error && error.message ? error.message : "조치에 실패했습니다.");
    } finally {
      setPending(false);
    }
  };

  return (
    <>
      <button
        type="button"
        aria-label="거래 후기 관리자 메뉴"
        disabled={pending}
        onClick={() => setOpen(true)}
        className="-my-1 -mr-1 flex h-7 w-7 items-center justify-center rounded-md text-app-muted hover:bg-app-surface disabled:opacity-60"
      >
        <svg className="h-[18px] w-[18px]" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="5" cy="12" r="1.6" />
          <circle cx="12" cy="12" r="1.6" />
          <circle cx="19" cy="12" r="1.6" />
        </svg>
      </button>
      <ActionSheet
        open={open}
        onClose={() => setOpen(false)}
        actions={[
          hidden
            ? { key: "admin-unhide", label: "숨김 해제 (관리자)", onSelect: () => void run() }
            : { key: "admin-hide", label: "숨기기 (관리자)", destructive: true, onSelect: () => void run() },
        ]}
      />
      {confirmDialog}
    </>
  );
}

/**
 * 분양 상세 '거래 후기' 영역: 소제목 13/600 muted + 후기 블록(답글 전이고 분양자면 '답글 남기기').
 * 운영자가 숨긴 후기는 작성자·분양자·운영자에게만 '운영 정책에 따라 숨겨진 후기예요' 자리표시(답글 입구 없음).
 */
export function TradeReviewSection({
  review,
  canReply,
  onReply,
  moderator,
}: {
  review: ProductTradeReview;
  canReply: boolean;
  onReply: () => void;
  /** 운영자(ADMIN·SUPER_USER·운영자 이메일)면 ⋯ 숨기기·숨김 해제. */
  moderator: boolean;
}) {
  const hidden = isHiddenTradeReview(review);
  return (
    <section aria-label="거래 후기">
      <h2 className="px-4 pb-1.5 pt-3.5 text-[13px] font-semibold text-app-muted">거래 후기</h2>
      {hidden ? (
        <TradeReviewFrame className="flex items-center gap-2 px-3 py-3.5">
          <p className="min-w-0 flex-1 text-[13px] text-app-muted">운영 정책에 따라 숨겨진 후기예요</p>
          {moderator ? <TradeReviewAdminMenu reviewId={review.id} hidden /> : null}
        </TradeReviewFrame>
      ) : (
        <TradeReviewFrame>
          <TradeReviewContent
            review={review}
            menu={moderator ? <TradeReviewAdminMenu reviewId={review.id} hidden={false} /> : null}
          >
            {canReply && !review.reply ? <TradeReplyButton onClick={onReply} /> : null}
          </TradeReviewContent>
        </TradeReviewFrame>
      )}
    </section>
  );
}

export default TradeReviewSection;
