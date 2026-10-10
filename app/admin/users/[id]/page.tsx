"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import useSWR from "swr";
import { authFetch } from "@libs/client/authFetch";
import { toast } from "@libs/client/toast";
import { Button } from "@components/ui/button";
import useConfirmDialog from "hooks/useConfirmDialog";
import { REPORT_STATUS_LABEL, REPORT_TARGET_LABEL } from "@libs/shared/report";
import {
  MODERATION_TARGET_LABEL,
  USER_STATUS_LABEL,
  sanctionActionLabel,
  sanctionReasonLabel,
  type SanctionRecommendation,
} from "@libs/shared/sanction";
import SanctionFields, {
  initialSanctionFields,
  toSanctionPayload,
  validateSanctionFields,
  type SanctionFieldType,
  type SanctionFieldsValue,
} from "@components/features/moderation/SanctionFields";
import type { ModerationActionType, ModerationTargetType, ReportStatus, ReportTargetType, SanctionType, UserStatus } from "@prisma/client";

/**
 * 관리자 유저 상세(S-3): 상태·누적 제재·권장 조치·제재 입력, 제재 이력·받은 신고·콘텐츠 조치·최근 글/상품 탭.
 * 역할 변경·탈퇴 처리는 허용 목록 최고 관리자에게만 그린다.
 * 기획: 앱 docs/prd/admin-moderation.md
 */

const ROLE_OPTIONS = ["USER", "FAKE_USER", "ADMIN", "SUPER_USER"] as const;

interface Actor {
  id: number;
  name: string;
}

interface SanctionRow {
  id: number;
  type: SanctionType;
  reasonCode: string;
  messageToUser: string | null;
  internalNote: string | null;
  days: number | null;
  startsAt: string;
  endsAt: string | null;
  reportId: number | null;
  auctionReportId: number | null;
  targetType: ModerationTargetType | null;
  targetId: number | null;
  acknowledgedAt: string | null;
  createdAt: string;
  actor: Actor;
}

interface UserDetailResponse {
  success: boolean;
  error?: string;
  user?: {
    id: number;
    name: string;
    email: string | null;
    avatar: string | null;
    provider: string;
    role: string;
    status: UserStatus;
    suspendedUntil: string | null;
    deletedAt: string | null;
    createdAt: string;
  };
  summary?: {
    recentWarningCount: number;
    recentSuspensionCount: number;
    reportsReceivedCount: number;
    recommendation: SanctionRecommendation;
  };
  sanctions?: SanctionRow[];
  reportsReceived?: {
    id: number;
    targetType: ReportTargetType;
    targetId: number;
    reason: string;
    detail: string | null;
    status: ReportStatus;
    createdAt: string;
    reporter: Actor;
  }[];
  contentActions?: {
    id: number;
    targetType: ModerationTargetType;
    targetId: number;
    action: ModerationActionType;
    reason: string | null;
    reasonCode: string | null;
    reportId: number | null;
    snapshot: { title?: string } | null;
    createdAt: string;
    actor: Actor;
  }[];
  posts?: { id: number; title: string; isHidden: boolean; createdAt: string }[];
  products?: { id: number; name: string; isHidden: boolean; isDeleted: boolean; createdAt: string }[];
  canRunSensitiveActions?: boolean;
}

type Tab = "sanctions" | "reports" | "content" | "recent";

const TABS: { value: Tab; label: string }[] = [
  { value: "sanctions", label: "제재 이력" },
  { value: "reports", label: "받은 신고" },
  { value: "content", label: "콘텐츠 조치" },
  { value: "recent", label: "최근 글·분양글" },
];

const CONTENT_ACTION_LABEL: Record<ModerationActionType, string> = {
  HIDE: "숨김",
  UNHIDE: "숨김 해제",
  DELETE: "삭제",
};

const isRestricted = (status: UserStatus) => status !== "ACTIVE" && status !== "DELETED";

const formatDateTime = (value: string | null) => (value ? new Date(value).toLocaleString() : "-");

function EmptyRow({ text }: { text: string }) {
  return <p className="rounded-lg border border-dashed border-gray-200 px-3 py-6 text-center text-sm text-gray-500">{text}</p>;
}

export default function AdminUserDetailPage() {
  const params = useParams<{ id: string }>();
  const userId = Number(params?.id);
  const { data, error, isLoading, mutate } = useSWR<UserDetailResponse>(
    Number.isInteger(userId) && userId > 0 ? `/api/admin/users/${userId}` : null
  );
  const [tab, setTab] = useState<Tab>("sanctions");
  const [sanction, setSanction] = useState<SanctionFieldsValue>(() => initialSanctionFields("OTHER", "WARNING"));
  const [submitting, setSubmitting] = useState(false);
  const { confirm, confirmDialog } = useConfirmDialog();

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-28 animate-pulse rounded-xl bg-gray-100" />
        <div className="h-48 animate-pulse rounded-xl bg-gray-100" />
      </div>
    );
  }

  if (error || !data?.success || !data.user) {
    // 전역 SWR fetcher 는 4xx 를 오류로 던지고 응답의 error 문구를 message 에 담는다.
    const notFound =
      (error as { status?: number } | undefined)?.status === 404 ||
      (error as Error | undefined)?.message === "사용자를 찾을 수 없어요." ||
      data?.error === "사용자를 찾을 수 없어요.";
    return (
      <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-6 text-center">
        <p className="text-sm text-gray-700">{notFound ? "사용자를 찾을 수 없어요." : "정보를 불러오지 못했어요."}</p>
        <div className="flex justify-center gap-2">
          {notFound ? null : (
            <Button size="sm" variant="outline" onClick={() => mutate()}>
              다시 시도
            </Button>
          )}
          <Link href="/admin/users" className="text-sm underline">
            목록으로
          </Link>
        </div>
      </div>
    );
  }

  const { user, summary } = data;
  const restricted = isRestricted(user.status);
  const types: SanctionFieldType[] = restricted
    ? ["WARNING", "SUSPENSION", "BAN", "LIFT"]
    : ["WARNING", "SUSPENSION", "BAN"];

  const submitSanction = async () => {
    const payload = toSanctionPayload(sanction);
    if (!payload || validateSanctionFields(sanction)) return;
    const banning = payload.type === "BAN";
    const confirmed = await confirm({
      title: `${user.name} 님에게 ${sanctionActionLabel(payload)}를 적용할까요?`,
      description: [
        `사유: ${sanctionReasonLabel(payload.reasonCode)}`,
        payload.messageToUser ? `메시지: ${payload.messageToUser}` : "",
        "대상자에게 알림·푸시가 바로 갑니다.",
        banning ? "아래 입력칸에 BAN을 정확히 입력해야 실행됩니다." : "",
      ]
        .filter(Boolean)
        .join("\n"),
      confirmText: "적용",
      tone: banning || payload.type === "SUSPENSION" ? "danger" : "default",
      confirmKeyword: banning ? "BAN" : "",
      confirmKeywordLabel: "영구 정지 실행 키워드",
    });
    if (!confirmed) return;

    try {
      setSubmitting(true);
      const res = await authFetch("/api/admin/sanctions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id, ...payload }),
      });
      const result = await res.json();
      if (!result.success) return toast.error(result.error || "처리하지 못했어요.");
      toast.success(`${sanctionActionLabel(payload)}를 적용했어요.`);
      setSanction(initialSanctionFields("OTHER", "WARNING"));
      mutate();
    } catch {
      toast.error("처리하지 못했어요. 다시 시도해 주세요.");
    } finally {
      setSubmitting(false);
    }
  };

  const changeRole = async (role: string) => {
    const confirmed = await confirm({ title: `역할을 ${role}(으)로 바꿀까요?`, confirmText: "변경" });
    if (!confirmed) return;
    const res = await authFetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: user.id, action: "update_role", role }),
    });
    const result = await res.json();
    if (!result.success) return toast.error(result.error || "역할을 바꾸지 못했어요.");
    toast.success("역할을 바꿨어요.");
    mutate();
  };

  const deleteAccount = async () => {
    const confirmed = await confirm({
      title: "이 계정을 탈퇴 처리할까요?",
      description: "개인정보를 분리 보관하며 되돌릴 수 없어요. 영구 정지 계정은 탈퇴 처리할 수 없어요.",
      confirmText: "탈퇴 처리",
      tone: "danger",
      confirmKeyword: "DELETE",
      confirmKeywordLabel: "탈퇴 처리 키워드",
    });
    if (!confirmed) return;
    const res = await authFetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: user.id, action: "delete" }),
    });
    const result = await res.json();
    if (!result.success) return toast.error(result.error || "탈퇴 처리하지 못했어요.");
    toast.success("탈퇴 처리했어요.");
    mutate();
  };

  return (
    <>
      <div className="space-y-6">
        <Link href="/admin/users" className="text-sm text-gray-500 underline">
          ← 유저 목록
        </Link>

        <section className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-gray-900">{user.name}</h2>
              <p className="mt-1 text-sm text-gray-500">
                ID {user.id} · {user.email || "이메일 없음"} · {user.provider} · {user.role} · 가입{" "}
                {new Date(user.createdAt).toLocaleDateString()}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                  user.status === "ACTIVE"
                    ? "bg-emerald-50 text-emerald-700"
                    : user.status === "BANNED"
                      ? "bg-rose-100 text-rose-700"
                      : user.status === "DELETED"
                        ? "bg-gray-100 text-gray-500"
                        : "bg-amber-50 text-amber-700"
                }`}
              >
                {USER_STATUS_LABEL[user.status]}
              </span>
              <Link href={`/profiles/${user.id}`} target="_blank" className="text-xs underline">
                프로필 열기
              </Link>
            </div>
          </div>
          {user.suspendedUntil ? (
            <p className="mt-2 text-sm text-amber-700">정지 만료: {formatDateTime(user.suspendedUntil)}</p>
          ) : null}
          {summary ? (
            <p className="mt-3 rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-700">
              최근 180일 경고 {summary.recentWarningCount} · 정지 {summary.recentSuspensionCount} · 받은 신고{" "}
              {summary.reportsReceivedCount}
            </p>
          ) : null}
        </section>

        {user.status === "DELETED" ? (
          <p className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">탈퇴한 계정은 제재할 수 없어요.</p>
        ) : (
          <section className="space-y-3 rounded-xl border border-gray-200 bg-white p-5">
            <h3 className="text-sm font-semibold text-gray-900">제재</h3>
            <SanctionFields
              name="user-detail"
              value={sanction}
              onChange={setSanction}
              types={types}
              recommendation={summary?.recommendation ?? null}
              disabled={submitting}
            />
            <Button
              size="sm"
              variant={sanction.type === "BAN" ? "destructive" : "default"}
              disabled={submitting || Boolean(validateSanctionFields(sanction))}
              onClick={submitSanction}
            >
              적용
            </Button>
          </section>
        )}

        <section className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="flex gap-4 border-b border-gray-200">
            {TABS.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => setTab(item.value)}
                className={`-mb-px border-b-2 pb-2 text-sm ${
                  tab === item.value ? "border-gray-900 font-semibold text-gray-900" : "border-transparent text-gray-500"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="mt-4 space-y-2">
            {tab === "sanctions" ? (
              data.sanctions?.length ? (
                data.sanctions.map((row) => (
                  <div key={row.id} className="rounded-lg border border-gray-100 p-3 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-700">
                        {sanctionActionLabel(row)}
                      </span>
                      <span className="text-gray-700">{sanctionReasonLabel(row.reasonCode)}</span>
                      <span className="text-xs text-gray-500">
                        {formatDateTime(row.createdAt)} · {row.actor.name}
                      </span>
                      {row.type === "WARNING" || row.type === "SUSPENSION" ? (
                        <span className="text-xs text-gray-500">{row.acknowledgedAt ? "확인함" : "미확인"}</span>
                      ) : null}
                      {row.reportId ? <span className="text-xs text-gray-500">신고 #{row.reportId}</span> : null}
                      {row.auctionReportId ? (
                        <span className="text-xs text-gray-500">경매 신고 #{row.auctionReportId}</span>
                      ) : null}
                    </div>
                    {row.type === "SUSPENSION" ? (
                      <p className="mt-1 text-xs text-gray-600">
                        기간 {formatDateTime(row.startsAt)} ~ {formatDateTime(row.endsAt)}
                      </p>
                    ) : null}
                    {row.messageToUser ? <p className="mt-1 text-gray-700">메시지: {row.messageToUser}</p> : null}
                    {row.internalNote ? <p className="mt-1 text-xs text-gray-500">내부 메모: {row.internalNote}</p> : null}
                    {row.targetType && row.targetId ? (
                      <p className="mt-1 text-xs text-gray-500">
                        관련 {MODERATION_TARGET_LABEL[row.targetType]} #{row.targetId}
                      </p>
                    ) : null}
                  </div>
                ))
              ) : (
                <EmptyRow text="제재 이력이 없어요." />
              )
            ) : null}

            {tab === "reports" ? (
              data.reportsReceived?.length ? (
                data.reportsReceived.map((report) => (
                  <div key={report.id} className="rounded-lg border border-gray-100 p-3 text-sm">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
                      <span className="font-semibold text-gray-700">#{report.id}</span>
                      <span>
                        {REPORT_TARGET_LABEL[report.targetType]} #{report.targetId}
                      </span>
                      <span>{REPORT_STATUS_LABEL[report.status]}</span>
                      <span>{formatDateTime(report.createdAt)}</span>
                      <span>신고자 {report.reporter.name}</span>
                    </div>
                    <p className="mt-1 text-gray-700">{report.reason}</p>
                    {report.detail ? <p className="mt-1 text-xs text-gray-500">{report.detail}</p> : null}
                  </div>
                ))
              ) : (
                <EmptyRow text="받은 신고가 없어요." />
              )
            ) : null}

            {tab === "content" ? (
              data.contentActions?.length ? (
                data.contentActions.map((log) => (
                  <div key={log.id} className="rounded-lg border border-gray-100 p-3 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-700">
                        {MODERATION_TARGET_LABEL[log.targetType]} {CONTENT_ACTION_LABEL[log.action]}
                      </span>
                      <span className="text-gray-700">{log.snapshot?.title || `#${log.targetId}`}</span>
                      <span className="text-xs text-gray-500">
                        {formatDateTime(log.createdAt)} · {log.actor.name}
                      </span>
                    </div>
                    {log.reasonCode ? <p className="mt-1 text-xs text-gray-600">사유: {sanctionReasonLabel(log.reasonCode)}</p> : null}
                    {log.reason ? <p className="mt-1 text-xs text-gray-500">메모: {log.reason}</p> : null}
                  </div>
                ))
              ) : (
                <EmptyRow text="콘텐츠 조치 이력이 없어요." />
              )
            ) : null}

            {tab === "recent" ? (
              data.posts?.length || data.products?.length ? (
                <>
                  {data.posts?.map((post) => (
                    <Link
                      key={`post-${post.id}`}
                      href={`/posts/${post.id}`}
                      target="_blank"
                      className="flex items-center justify-between rounded-lg border border-gray-100 p-3 text-sm hover:bg-gray-50"
                    >
                      <span className="line-clamp-1">게시글 · {post.title}</span>
                      <span className="text-xs text-gray-500">
                        {post.isHidden ? "숨김 · " : ""}
                        {new Date(post.createdAt).toLocaleDateString()}
                      </span>
                    </Link>
                  ))}
                  {data.products?.map((product) => (
                    <Link
                      key={`product-${product.id}`}
                      href={`/products/${product.id}`}
                      target="_blank"
                      className="flex items-center justify-between rounded-lg border border-gray-100 p-3 text-sm hover:bg-gray-50"
                    >
                      <span className="line-clamp-1">분양글 · {product.name}</span>
                      <span className="text-xs text-gray-500">
                        {product.isDeleted ? "삭제 · " : product.isHidden ? "숨김 · " : ""}
                        {new Date(product.createdAt).toLocaleDateString()}
                      </span>
                    </Link>
                  ))}
                </>
              ) : (
                <EmptyRow text="최근 글·분양글이 없어요." />
              )
            ) : null}
          </div>
        </section>

        {data.canRunSensitiveActions ? (
          <section className="space-y-3 rounded-xl border border-rose-200 bg-rose-50/40 p-5">
            <h3 className="text-sm font-semibold text-rose-900">최고 관리자 전용</h3>
            <label className="flex items-center gap-2 text-sm">
              역할
              <select
                value={user.role}
                onChange={(event) => changeRole(event.target.value)}
                className="rounded-md border border-gray-300 px-2 py-1 text-sm"
              >
                {ROLE_OPTIONS.map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
            </label>
            {user.status === "DELETED" ? null : (
              <Button size="sm" variant="destructive" onClick={deleteAccount}>
                탈퇴 처리
              </Button>
            )}
          </section>
        ) : null}
      </div>
      {confirmDialog}
    </>
  );
}
