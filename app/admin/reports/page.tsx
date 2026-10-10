"use client";

import { authFetch } from "@libs/client/authFetch";
import { useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import { toast } from "@libs/client/toast";
import { Button } from "@components/ui/button";
import useConfirmDialog from "hooks/useConfirmDialog";
import type { AdminReportItem, AdminReportsResponse } from "pages/api/admin/reports";
import type { ReportContentAction } from "@libs/server/reports";
import {
  REPORT_ACTION_LABEL,
  REPORT_STATUS_LABEL,
  REPORT_STATUSES,
  REPORT_TARGET_LABEL,
  REPORT_TARGET_TYPES,
  isRemovableReportTarget,
  type ReportStatus,
  type ReportTargetType,
} from "@libs/shared/report";
import {
  defaultSanctionReason,
  sanctionActionLabel,
  type SanctionRecommendation,
} from "@libs/shared/sanction";
import SanctionFields, {
  initialSanctionFields,
  toSanctionPayload,
  validateSanctionFields,
  type SanctionFieldsValue,
} from "@components/features/moderation/SanctionFields";

type TargetTypeFilter = "ALL" | ReportTargetType;

const TARGET_TYPE_FILTERS: TargetTypeFilter[] = ["ALL", ...REPORT_TARGET_TYPES];

/**
 * 대상별 콘텐츠 삭제의 실제 의미. 상품은 거래 기록이 참조하므로 목록에서 내리고(isDeleted),
 * 혈통은 회수(REVOKED)한다(뿌리 혈통이면 그 혈통의 출처 카드도 함께 회수).
 */
const deleteContentText = (type: ReportTargetType) =>
  type === "PRODUCT"
    ? "분양글 삭제(목록에서 내림)"
    : type === "BLOODLINE_CARD"
      ? "혈통 회수(되돌릴 수 없음)"
      : `${REPORT_TARGET_LABEL[type]} 삭제(되돌릴 수 없음)`;

const CONTENT_ACTION_LABEL: Record<string, string> = {
  HIDE: "숨김",
  UNHIDE: "숨김 해제",
  DELETE: "삭제",
};

interface UserSummaryResponse {
  success: boolean;
  summary?: {
    recentWarningCount: number;
    recentSuspensionCount: number;
    reportsReceivedCount: number;
    recommendation: SanctionRecommendation;
  };
}

interface ResolveDraft {
  contentAction: ReportContentAction;
  sanction: SanctionFieldsValue;
  closeSameTarget: boolean;
  note: string;
}

const initialDraft = (report: AdminReportItem): ResolveDraft => ({
  contentAction: "NONE",
  sanction: initialSanctionFields(defaultSanctionReason(report.reason)),
  closeSameTarget: true,
  note: "",
});

/** 신고 처리 패널(S-1): 콘텐츠 조치와 사용자 조치를 따로 골라 한 번에 적용한다. */
function ResolvePanel({
  report,
  sameTargetOpenCount,
  busy,
  onSubmit,
}: {
  report: AdminReportItem;
  sameTargetOpenCount: number;
  busy: boolean;
  onSubmit: (report: AdminReportItem, decision: "RESOLVED" | "REJECTED", draft: ResolveDraft) => void;
}) {
  const [draft, setDraft] = useState<ResolveDraft>(() => initialDraft(report));
  const { data: userData } = useSWR<UserSummaryResponse>(`/api/admin/users/${report.reportedUserId}`);
  const summary = userData?.summary;
  const removable = isRemovableReportTarget(report.targetType);
  const sanctionError = validateSanctionFields(draft.sanction);

  return (
    <div className="mt-3 space-y-3 rounded-md border border-rose-100 bg-rose-50/40 p-3">
      <fieldset disabled={busy} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        <legend className="mb-1 text-xs font-semibold text-slate-700">콘텐츠 조치</legend>
        {(removable ? (["NONE", "HIDE", "DELETE"] as const) : (["NONE"] as const)).map((action) => (
          <label key={action} className="inline-flex items-center gap-1">
            <input
              type="radio"
              name={`report-${report.id}-content`}
              checked={draft.contentAction === action}
              onChange={() => setDraft({ ...draft, contentAction: action })}
            />
            <span className={action === "DELETE" ? "font-semibold text-rose-700" : ""}>
              {action === "NONE" ? "없음" : action === "HIDE" ? "숨김(작성자에게만 보임)" : deleteContentText(report.targetType)}
            </span>
          </label>
        ))}
        {!removable ? <span className="text-xs text-slate-500">채팅·사용자 신고는 콘텐츠 조치가 없어요.</span> : null}
      </fieldset>

      <SanctionFields
        name={`report-${report.id}`}
        value={draft.sanction}
        onChange={(sanction) => setDraft({ ...draft, sanction })}
        disabled={busy}
        hideInternalNote
        summary={
          summary
            ? `최근 180일 경고 ${summary.recentWarningCount} · 정지 ${summary.recentSuspensionCount} · 받은 신고 ${summary.reportsReceivedCount}`
            : null
        }
        recommendation={summary?.recommendation ?? null}
      />
      <Link href={`/admin/users/${report.reportedUserId}`} className="inline-block text-xs text-slate-600 underline">
        피신고자 상세 보기
      </Link>

      <label className="block">
        <span className="text-xs font-semibold text-slate-700">내부 메모 (운영자만 봄)</span>
        <textarea
          className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm"
          rows={2}
          maxLength={500}
          disabled={busy}
          value={draft.note}
          onChange={(event) => setDraft({ ...draft, note: event.target.value })}
        />
      </label>

      <label className="inline-flex items-center gap-1.5 text-sm">
        <input
          type="checkbox"
          checked={draft.closeSameTarget}
          disabled={busy}
          onChange={(event) => setDraft({ ...draft, closeSameTarget: event.target.checked })}
        />
        같은 대상 열린 신고 함께 처리
        {sameTargetOpenCount > 0 ? <span className="text-xs text-slate-500">(이 페이지에 {sameTargetOpenCount}건 더)</span> : null}
      </label>

      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant={draft.contentAction === "DELETE" || draft.sanction.type === "BAN" ? "destructive" : "default"}
          disabled={busy || Boolean(sanctionError)}
          onClick={() => onSubmit(report, "RESOLVED", draft)}
        >
          처리
        </Button>
        <Button size="sm" variant="outline" disabled={busy} onClick={() => onSubmit(report, "REJECTED", draft)}>
          기각 (위반 아님)
        </Button>
      </div>
    </div>
  );
}

export default function AdminReportsPage() {
  const [status, setStatus] = useState<ReportStatus>("OPEN");
  const [targetType, setTargetType] = useState<TargetTypeFilter>("ALL");
  const [page, setPage] = useState(1);
  const [reportUpdatingId, setReportUpdatingId] = useState<number | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const { confirm, confirmDialog } = useConfirmDialog();

  const { data: reportData, mutate: mutateReports } = useSWR<AdminReportsResponse>(
    `/api/admin/reports?status=${status}&targetType=${targetType}&page=${page}`
  );
  const reports = reportData?.reports || [];

  const handleReportDecision = async (
    report: AdminReportItem,
    decision: "RESOLVED" | "REJECTED",
    draft: ResolveDraft
  ) => {
    const targetUserLabel = report.reportedUser?.name || `ID ${report.reportedUserId}`;
    const targetLabel = `${REPORT_TARGET_LABEL[report.targetType]} #${report.targetId} ${
      report.target?.title || ""
    }`.trim();
    const contentAction: ReportContentAction = decision === "REJECTED" ? "NONE" : draft.contentAction;
    const userAction = decision === "REJECTED" ? null : toSanctionPayload(draft.sanction);
    const banning = userAction?.type === "BAN";
    const deleting = contentAction === "DELETE";

    const summaryLines =
      decision === "REJECTED"
        ? ["결과: 신고 기각(조치 없음, 신고자에게 알리지 않음)"]
        : [
            `콘텐츠: ${contentAction === "NONE" ? "조치 없음" : contentAction === "HIDE" ? "숨김" : deleteContentText(report.targetType)}`,
            `피신고자(${targetUserLabel}): ${userAction ? sanctionActionLabel(userAction) : "조치 없음"}`,
            draft.closeSameTarget ? "같은 대상의 열린 신고도 함께 처리" : "",
          ];

    const keyword = banning ? "BAN" : deleting ? "DELETE" : "";
    const confirmed = await confirm({
      title: decision === "REJECTED" ? "신고를 기각할까요?" : "이 내용으로 신고를 처리할까요?",
      description: [
        `신고 #${report.id}`,
        `대상: ${targetLabel}`,
        ...summaryLines,
        keyword ? `아래 입력칸에 ${keyword}를 정확히 입력해야 실행됩니다.` : "",
        "처리 결과는 즉시 반영됩니다.",
      ]
        .filter(Boolean)
        .join("\n"),
      confirmText: decision === "REJECTED" ? "기각" : "처리 실행",
      tone: keyword ? "danger" : "default",
      confirmKeyword: keyword,
      confirmKeywordLabel: banning ? "영구 정지 실행 키워드" : "삭제 실행 키워드",
    });
    if (!confirmed) return;

    try {
      setReportUpdatingId(report.id);
      const res = await authFetch("/api/admin/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reportId: report.id,
          decision,
          contentAction,
          userAction,
          closeSameTarget: decision === "RESOLVED" && draft.closeSameTarget,
          note: draft.note.trim(),
        }),
      });
      const result = (await res.json()) as AdminReportsResponse;
      if (!result.success) {
        if (res.status === 409) mutateReports();
        return toast.error(result.error || "신고 처리에 실패했습니다.");
      }
      const closed = result.closedReportIds?.length ?? 1;
      if (result.contentFailed) {
        toast.error("사용자 조치는 적용했지만 콘텐츠 조치는 실패했어요. 게시물·분양 관리에서 다시 숨겨 주세요.");
        setExpandedId(null);
        mutateReports();
        return;
      }
      toast.success(
        result.contentSkipped
          ? "콘텐츠가 이미 없어 사용자 조치만 적용했어요."
          : closed > 1
            ? `신고 ${closed}건을 처리했어요.`
            : "신고를 처리했어요."
      );
      setExpandedId(null);
      mutateReports();
    } catch {
      toast.error("처리하지 못했어요. 다시 시도해 주세요.");
    } finally {
      setReportUpdatingId(null);
    }
  };

  const senderLabel = (report: AdminReportItem, userId: number) => {
    if (userId === report.reporterId) {
      return `신고자 ${report.reporter?.name || `ID ${userId}`}`;
    }
    if (userId === report.reportedUserId) {
      return `피신고자 ${report.reportedUser?.name || `ID ${userId}`}`;
    }
    return `ID ${userId}`;
  };

  return (
    <>
      <div className="space-y-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">신고 관리</h2>
            <p className="mt-1 text-sm text-gray-500">
              게시글·댓글·분양글·채팅·사용자·혈통 신고를 검토하고 처리합니다.
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
          <div className="flex flex-wrap gap-2">
            {REPORT_STATUSES.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => {
                  setStatus(option);
                  setPage(1);
                }}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold ${
                  status === option ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600"
                }`}
              >
                {REPORT_STATUS_LABEL[option]} {reportData?.counts?.[option] ?? 0}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {TARGET_TYPE_FILTERS.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => {
                  setTargetType(option);
                  setPage(1);
                }}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold ${
                  targetType === option
                    ? "bg-rose-600 text-white"
                    : "bg-rose-50 text-rose-700"
                }`}
              >
                {option === "ALL" ? "전체" : REPORT_TARGET_LABEL[option]}
              </button>
            ))}
          </div>
        </div>

        <section className="rounded-xl border border-rose-200 bg-rose-50 p-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-rose-900">
              {REPORT_STATUS_LABEL[status]} 신고 {reports.length}건
              {page > 1 || reportData?.hasMore ? ` (${page}페이지)` : ""}
            </h3>
            <span className="text-xs text-rose-700">
              OPEN {reportData?.counts?.OPEN ?? 0} / RESOLVED {reportData?.counts?.RESOLVED ?? 0} /
              REJECTED {reportData?.counts?.REJECTED ?? 0}
            </span>
          </div>
          <div className="mt-2 rounded-md border border-rose-200 bg-white/80 px-2.5 py-2 text-[11px] leading-relaxed text-rose-900">
            <p>정책: 신고 접수만으로 콘텐츠/유저가 자동 제재되지는 않습니다.</p>
            <p>콘텐츠 조치: 기본은 숨김(작성자에게만 보이고 되돌릴 수 있음)입니다. 삭제는 개인정보 노출처럼 남기면 안 될 때만 씁니다.</p>
            <p>사용자 조치: 경고 → 3일 → 10일 → 30일 → 영구 정지 순서를 권장합니다(최근 180일 기준).</p>
            <p>대상자에게는 사유 범주와 메시지만 알림으로 가고, 신고자 정보는 가지 않습니다.</p>
            <p>신고자에게는 조치가 적용됐을 때만 &lsquo;조치했어요&rsquo; 알림이 갑니다(기각은 알리지 않음).</p>
          </div>

          <div className="mt-3 space-y-2">
            {reports.length ? (
              reports.map((report) => {
                return (
                  <div key={report.id} className="rounded-lg border border-rose-100 bg-white p-3">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <span className="font-semibold text-slate-700">#{report.id}</span>
                      <span className="rounded-full bg-rose-100 px-2 py-0.5 font-semibold text-rose-700">
                        {REPORT_TARGET_LABEL[report.targetType]}
                      </span>
                      <span>
                        {REPORT_TARGET_LABEL[report.targetType]} #{report.targetId}
                      </span>
                      <span>신고일 {new Date(report.createdAt).toLocaleString()}</span>
                    </div>
                    {report.target?.href ? (
                      <Link
                        href={report.target.href}
                        target="_blank"
                        className="mt-1 inline-flex max-w-full text-sm font-semibold text-slate-900 underline-offset-2 hover:underline"
                      >
                        <span className="line-clamp-1">{report.target.title}</span>
                      </Link>
                    ) : (
                      <p className="mt-1 text-sm font-semibold text-slate-900">
                        {report.target?.title ||
                          `삭제된 ${REPORT_TARGET_LABEL[report.targetType]}`}
                      </p>
                    )}
                    {report.target?.excerpt && report.targetType !== "CHAT_ROOM" ? (
                      <p className="mt-1 text-xs text-slate-500 whitespace-pre-line line-clamp-3">
                        {report.target.excerpt}
                      </p>
                    ) : null}
                    {report.targetType === "CHAT_ROOM" ? (
                      <div className="mt-2 max-h-64 overflow-y-auto rounded-md border border-slate-200 bg-slate-50 px-2.5 py-2">
                        <p className="text-[11px] font-semibold text-slate-600">
                          최근 메시지 {report.target?.messages?.length ?? 0}개
                        </p>
                        {report.target?.messages?.length ? (
                          <ul className="mt-1 space-y-1">
                            {report.target.messages.map((message) => (
                              <li key={message.id} className="text-xs text-slate-700">
                                <span
                                  className={`font-semibold ${
                                    message.userId === report.reportedUserId
                                      ? "text-rose-700"
                                      : "text-slate-800"
                                  }`}
                                >
                                  {senderLabel(report, message.userId)}
                                </span>
                                <span className="ml-1 text-[11px] text-slate-400">
                                  {new Date(message.createdAt).toLocaleString()}
                                </span>
                                <p className="whitespace-pre-line break-words">
                                  {message.message}
                                </p>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="mt-1 text-xs text-slate-500">메시지가 없습니다.</p>
                        )}
                      </div>
                    ) : null}
                    <p className="mt-1 text-sm text-slate-700">
                      신고자: {report.reporter?.name || `ID ${report.reporterId}`} /
                      피신고자: {report.reportedUser?.name || `ID ${report.reportedUserId}`} (
                      {report.reportedUser?.status || "-"})
                    </p>
                    <p className="mt-1 text-sm text-slate-700">사유: {report.reason}</p>
                    {report.detail ? (
                      <p className="mt-1 text-sm text-slate-600 whitespace-pre-line">
                        {report.detail}
                      </p>
                    ) : null}

                    {report.status === "OPEN" ? (
                      expandedId === report.id ? (
                        <ResolvePanel
                          report={report}
                          sameTargetOpenCount={
                            reports.filter(
                              (other) =>
                                other.id !== report.id &&
                                other.status === "OPEN" &&
                                other.targetType === report.targetType &&
                                other.targetId === report.targetId
                            ).length
                          }
                          busy={reportUpdatingId === report.id}
                          onSubmit={handleReportDecision}
                        />
                      ) : (
                        <div className="mt-3">
                          <Button size="sm" variant="outline" onClick={() => setExpandedId(report.id)}>
                            처리하기
                          </Button>
                        </div>
                      )
                    ) : (
                      <div className="mt-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                        <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-600">
                          <span>상태: {REPORT_STATUS_LABEL[report.status]}</span>
                          {report.contentAction || report.sanctionId ? (
                            <>
                              <span>콘텐츠: {report.contentAction ? CONTENT_ACTION_LABEL[report.contentAction] : "조치 없음"}</span>
                              <span>사용자: {report.sanctionId ? `제재 #${report.sanctionId}` : "조치 없음"}</span>
                            </>
                          ) : (
                            <span>액션: {REPORT_ACTION_LABEL[report.resolutionAction]}</span>
                          )}
                          <span>피신고자 상태: {report.reportedUser?.status || "-"}</span>
                          <Link href={`/admin/users/${report.reportedUserId}`} className="underline">
                            피신고자 상세
                          </Link>
                          {report.resolvedAt ? (
                            <span>처리일 {new Date(report.resolvedAt).toLocaleString()}</span>
                          ) : null}
                        </div>
                        {report.resolutionNote ? (
                          <p className="mt-1 text-[11px] text-slate-500">
                            메모: {report.resolutionNote}
                          </p>
                        ) : null}
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <p className="rounded-lg border border-dashed border-rose-200 bg-white px-3 py-4 text-sm text-rose-700">
                {status === "OPEN"
                  ? "현재 처리 대기 중인 신고가 없습니다."
                  : "처리된 신고 이력이 없습니다."}
              </p>
            )}
          </div>
          {page > 1 || reportData?.hasMore ? (
            <div className="mt-3 flex items-center justify-center gap-2">
              <Button
                size="sm"
                variant="outline"
                disabled={page <= 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
              >
                이전
              </Button>
              <span className="text-xs text-rose-700">{page}페이지</span>
              <Button
                size="sm"
                variant="outline"
                disabled={!reportData?.hasMore}
                onClick={() => setPage((current) => current + 1)}
              >
                다음
              </Button>
            </div>
          ) : null}
        </section>
      </div>
      {confirmDialog}
    </>
  );
}
