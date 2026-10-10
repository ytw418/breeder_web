"use client";

import Link from "next/link";
import { useState } from "react";
import useSWR from "swr";
import ConfirmDialog from "@components/atoms/ConfirmDialog";
import Layout from "@components/features/MainLayout";
import { LineIcon, LoadingBlock } from "@components/features/profile/ProfileRows";
import { authFetch } from "@libs/client/authFetch";
import { toast } from "@libs/client/toast";
import { cn } from "@libs/client/utils";
import useLogout from "hooks/useLogout";
import {
  applyBlockedResult,
  blockerHref,
  canRequestDeletion,
  DEFAULT_PURGE_DAYS,
  DELETION_REASONS,
  getDeletionView,
  type DeleteAccountResponse,
  type DeletionBlocker,
  type DeletionEligibilityResponse,
} from "./deletionView";

const ELIGIBILITY_KEY = "/api/users/me/deletion";

function SectionTitle({ title }: { title: string }) {
  return <h3 className="px-4 pb-2 pt-5 text-[13px] font-semibold text-app-muted">{title}</h3>;
}

function Bullet({ children }: { children: string }) {
  return (
    <li className="flex gap-2 px-4 py-1.5">
      <span className="text-[15px] leading-[22px] text-app-muted" aria-hidden="true">
        ·
      </span>
      <span className="flex-1 text-[15px] leading-[22px] text-app-text">{children}</span>
    </li>
  );
}

function BlockerList({ blockers }: { blockers: DeletionBlocker[] }) {
  return (
    <div>
      <SectionTitle title="지금은 탈퇴할 수 없어요" />
      <p className="px-4 pb-2 text-[14px] leading-5 text-app-muted">아래 경매·거래를 마친 뒤 다시 시도해 주세요.</p>
      {blockers.map((blocker) => (
        <div key={blocker.code}>
          <p className="px-4 pb-1 pt-3 text-[14px] font-semibold text-app-text">{blocker.message}</p>
          {blocker.items.map((item) => (
            <Link
              key={`${blocker.code}-${item.id}`}
              href={blockerHref(blocker, item)}
              className="flex min-h-[48px] items-center border-b border-app-line px-4 hover:bg-app-surface"
            >
              <span className="flex-1 truncate text-[15px] text-app-text">{item.title}</span>
              <LineIcon name="chevron-right" size={18} className="text-app-caption" />
            </Link>
          ))}
        </div>
      ))}
    </div>
  );
}

/** 설정 > 회원탈퇴(앱 settings/delete-account.tsx). */
export default function DeleteAccountClient() {
  const handleLogout = useLogout();
  const [reason, setReason] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);

  const { data, error, isLoading, mutate } = useSWR<DeletionEligibilityResponse>(ELIGIBILITY_KEY, {
    revalidateOnFocus: false,
    shouldRetryOnError: false,
  });
  const purgeDays = data?.purgeAfterDays ?? DEFAULT_PURGE_DAYS;
  const view = getDeletionView({ isLoading, error, data });
  const canDelete = canRequestDeletion(view, data, pending || done);

  const handleDelete = async () => {
    if (pending) return;
    setPending(true);
    try {
      const res = await authFetch(ELIGIBILITY_KEY, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reason || undefined }),
      });
      const result = ((await res.json().catch(() => null)) ?? { success: false }) as DeleteAccountResponse;
      if (res.ok && result.success) {
        setDone(true);
        toast.success("탈퇴 완료 · 그동안 브리디를 이용해 주셔서 감사합니다.");
        // 토스트를 잠깐 보인 뒤 토큰을 지우고 홈으로 보낸다(useLogout).
        window.setTimeout(() => void handleLogout(), 1200);
        return;
      }
      const next = applyBlockedResult(data, result);
      if (next !== data) void mutate(next, { revalidate: false });
      toast.error(result.message || "탈퇴하지 못했습니다. 잠시 후 다시 시도해 주세요.");
    } catch {
      toast.error("탈퇴하지 못했습니다. 잠시 후 다시 시도해 주세요.");
    } finally {
      setPending(false);
    }
  };

  let section;
  if (view === "loading") {
    section = <LoadingBlock height={96} />;
  } else if (view === "error") {
    section = (
      <div className="space-y-3 p-4">
        <p className="text-[14px] text-app-muted">탈퇴 가능 여부를 확인하지 못했어요.</p>
        <button
          type="button"
          onClick={() => void mutate()}
          className="h-11 w-full rounded-md bg-app-surface text-[15px] font-semibold text-app-text"
        >
          다시 시도
        </button>
      </div>
    );
  } else if (view === "admin") {
    section = <p className="p-4 text-[14px] leading-5 text-app-muted">{data?.message}</p>;
  } else if (view === "blocked") {
    section = <BlockerList blockers={data?.blockers ?? []} />;
  } else {
    section = (
      <div>
        <SectionTitle title="떠나시는 이유를 알려주세요 (선택)" />
        <div className="flex flex-wrap gap-2 px-4">
          {DELETION_REASONS.map((label) => {
            const active = reason === label;
            return (
              <button
                key={label}
                type="button"
                aria-pressed={active}
                onClick={() => setReason(active ? "" : label)}
                className={cn(
                  "h-8 rounded-2xl border px-3.5 text-[14px] font-medium",
                  active ? "border-app-text bg-app-text text-app-bg" : "border-app-border bg-app-bg text-app-muted"
                )}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <Layout canGoBack title="회원탈퇴" seoTitle="회원탈퇴">
      <div className="bg-app-bg pb-[calc(52px+16px+32px+env(safe-area-inset-bottom))]">
        <h2 className="px-4 pt-5 text-[20px] font-bold leading-7 text-app-text">탈퇴하기 전에 확인해 주세요</h2>

        <SectionTitle title="탈퇴하면 이렇게 돼요" />
        <ul>
          <Bullet>프로필, 관심 목록, 팔로우, 알림은 바로 삭제돼요.</Bullet>
          <Bullet>작성한 게시글·댓글·채팅·경매 기록은 남고, 작성자는 &apos;탈퇴한 사용자&apos;로 표시돼요.</Bullet>
          <Bullet>분양 중인 글은 목록에서 내려가요.</Bullet>
          <Bullet>{`개인정보는 분쟁 대응을 위해 ${purgeDays}일 보관한 뒤 완전히 삭제돼요.`}</Bullet>
          <Bullet>{`${purgeDays}일 동안은 같은 계정으로 다시 가입할 수 없어요.`}</Bullet>
        </ul>

        <div className="mt-4 h-2 bg-app-gap" aria-hidden="true" />

        {section}
      </div>

      <div className="fixed inset-x-0 bottom-0 mx-auto max-w-xl z-30 border-t border-app-line bg-app-bg">
        <div className="mx-auto max-w-xl px-4 pb-[calc(8px+env(safe-area-inset-bottom))] pt-2">
          <button
            type="button"
            disabled={!canDelete}
            onClick={() => setConfirmOpen(true)}
            className={cn(
              "flex h-[52px] w-full items-center justify-center rounded-md text-[16px] font-semibold",
              canDelete ? "bg-app-brand text-white" : "bg-app-surface text-app-caption"
            )}
          >
            {pending ? (
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-app-caption border-t-transparent" />
            ) : (
              "탈퇴하기"
            )}
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        tone="danger"
        title="정말 탈퇴할까요?"
        description={`탈퇴하면 ${purgeDays}일 동안 같은 계정으로 다시 가입할 수 없어요.`}
        confirmText="탈퇴하기"
        confirmKeyword="탈퇴"
        confirmKeywordLabel="확인을 위해 입력해 주세요"
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => {
          setConfirmOpen(false);
          void handleDelete();
        }}
      />
    </Layout>
  );
}
