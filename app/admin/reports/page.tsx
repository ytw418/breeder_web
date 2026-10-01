"use client";

import { authFetch } from "@libs/client/authFetch";
import { useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import { toast } from "@libs/client/toast";
import { Button } from "@components/ui/button";
import useConfirmDialog from "hooks/useConfirmDialog";
import type { AdminReportItem, AdminReportsResponse } from "pages/api/admin/reports";
import {
  REPORT_ACTION_LABEL,
  REPORT_STATUS_LABEL,
  REPORT_STATUSES,
  REPORT_TARGET_LABEL,
  REPORT_TARGET_TYPES,
  isRemovableReportTarget,
  type ReportAction,
  type ReportStatus,
  type ReportTargetType,
} from "@libs/shared/report";

type TargetTypeFilter = "ALL" | ReportTargetType;

const TARGET_TYPE_FILTERS: TargetTypeFilter[] = ["ALL", ...REPORT_TARGET_TYPES];

const isBanAction = (action: ReportAction) =>
  action === "BAN_USER" || action === "REMOVE_CONTENT_AND_BAN";

const isRemoveAction = (action: ReportAction) =>
  action === "REMOVE_CONTENT" || action === "REMOVE_CONTENT_AND_BAN";

/** 대상별 콘텐츠 삭제의 실제 의미. 상품은 거래 기록이 참조하므로 숨김 처리한다. */
const removeContentText = (type: ReportTargetType) =>
  type === "PRODUCT" ? "상품 숨김" : `${REPORT_TARGET_LABEL[type]} 삭제`;

export default function AdminReportsPage() {
  const [status, setStatus] = useState<ReportStatus>("OPEN");
  const [targetType, setTargetType] = useState<TargetTypeFilter>("ALL");
  const [page, setPage] = useState(1);
  const [reportUpdatingId, setReportUpdatingId] = useState<number | null>(null);
  const { confirm, confirmDialog } = useConfirmDialog();

  const { data: reportData, mutate: mutateReports } = useSWR<AdminReportsResponse>(
    `/api/admin/reports?status=${status}&targetType=${targetType}&page=${page}`
  );
  const reports = reportData?.reports || [];

  const handleReportDecision = async (
    report: AdminReportItem,
    decision: "RESOLVED" | "REJECTED",
    action: ReportAction
  ) => {
    const targetUserLabel = report.reportedUser?.name || `ID ${report.reportedUserId}`;
    const reporterLabel = report.reporter?.name || `ID ${report.reporterId}`;
    const targetLabel = `${REPORT_TARGET_LABEL[report.targetType]} #${report.targetId} ${
      report.target?.title || ""
    }`.trim();
    const removeText = removeContentText(report.targetType);

    const decisionSummary = (() => {
      if (decision === "REJECTED") return "결과: 신고 기각(제재 없음)";
      if (action === "REMOVE_CONTENT") return `결과: 신고 처리 + ${removeText}`;
      if (action === "BAN_USER")
        return `결과: 신고 처리 + 피신고자(${targetUserLabel}) 영구정지`;
      if (action === "REMOVE_CONTENT_AND_BAN")
        return `결과: ${removeText} + 피신고자(${targetUserLabel}) 영구정지`;
      return "결과: 신고 처리 완료(제재 없음)";
    })();

    const confirmed = await confirm({
      title:
        action === "REMOVE_CONTENT_AND_BAN"
          ? `신고 처리와 함께 ${removeText} + 피신고자 영구정지를 실행할까요?`
          : action === "REMOVE_CONTENT"
            ? `신고 처리와 함께 콘텐츠 삭제(${removeText})를 실행할까요?`
            : action === "BAN_USER"
              ? "신고 처리와 함께 피신고 계정을 영구정지할까요?"
              : decision === "REJECTED"
                ? "신고를 기각할까요?"
                : "신고를 처리 완료로 변경할까요?",
      description: [
        `신고 #${report.id}`,
        `대상: ${targetLabel}`,
        `신고자: ${reporterLabel}`,
        `피신고자: ${targetUserLabel}`,
        decisionSummary,
        isBanAction(action) ? "아래 입력칸에 BAN을 정확히 입력해야 실행됩니다." : "",
        "처리 결과는 즉시 반영되며 되돌리기 어렵습니다.",
      ]
        .filter(Boolean)
        .join("\n"),
      confirmText:
        action === "BAN_USER"
          ? "유저 영구정지 실행"
          : action === "REMOVE_CONTENT_AND_BAN"
            ? "삭제+영구정지 실행"
            : action === "REMOVE_CONTENT"
              ? "콘텐츠 삭제 실행"
              : "처리 실행",
      tone: isBanAction(action) ? "danger" : "default",
      confirmKeyword: isBanAction(action) ? "BAN" : "",
      confirmKeywordLabel: "영구정지 실행 키워드",
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
          action,
          note: isBanAction(action)
            ? "운영자 판단으로 영구정지 처리"
            : isRemoveAction(action)
              ? "운영자 판단으로 콘텐츠 삭제"
              : decision === "REJECTED"
                ? "신고 사유 불충분으로 기각"
                : "운영자 검토 완료",
        }),
      });
      const result = await res.json();
      if (!result.success) {
        return toast.error(result.error || "신고 처리에 실패했습니다.");
      }
      toast.success(
        isBanAction(action) ? "신고 처리 및 영구정지가 완료되었습니다." : "신고가 처리되었습니다."
      );
      mutateReports();
    } catch {
      toast.error("오류가 발생했습니다.");
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
              게시글·댓글·상품·채팅·사용자 신고를 검토하고 처리합니다.
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
            <p>처리 완료(제재 없음): 신고만 종결합니다.</p>
            <p>콘텐츠 삭제: 게시글·댓글은 삭제하고, 상품은 숨김 처리합니다(채팅·사용자 신고는 해당 없음).</p>
            <p>유저 영구정지: 피신고자 계정을 BANNED 처리합니다.</p>
            <p>삭제+정지: 콘텐츠 삭제와 계정 영구정지를 동시에 실행합니다.</p>
          </div>

          <div className="mt-3 space-y-2">
            {reports.length ? (
              reports.map((report) => {
                const removable = isRemovableReportTarget(report.targetType);
                const removeText = removeContentText(report.targetType);
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
                      <>
                        <div className="mt-2 rounded-md border border-rose-100 bg-rose-50/60 px-2.5 py-2 text-[11px] leading-relaxed text-rose-900">
                          <p>처리 완료(제재 없음): 신고를 인정하고 종료합니다.</p>
                          <p>신고 기각: 근거 부족/운영기준 미충족으로 종료합니다.</p>
                          {removable ? <p>콘텐츠 삭제: {removeText} 처리합니다.</p> : null}
                          <p>유저 영구정지: 피신고자를 즉시 영구정지합니다.</p>
                          {removable ? (
                            <p>삭제 + 영구정지: 콘텐츠 삭제({removeText})와 유저 영구정지를 동시에 실행합니다.</p>
                          ) : null}
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={reportUpdatingId === report.id}
                            onClick={() => handleReportDecision(report, "RESOLVED", "NONE")}
                          >
                            처리 완료 (제재 없음)
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={reportUpdatingId === report.id}
                            onClick={() => handleReportDecision(report, "REJECTED", "NONE")}
                          >
                            신고 기각 (근거 부족)
                          </Button>
                          {removable ? (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={reportUpdatingId === report.id}
                              onClick={() =>
                                handleReportDecision(report, "RESOLVED", "REMOVE_CONTENT")
                              }
                            >
                              콘텐츠 삭제 ({removeText})
                            </Button>
                          ) : null}
                          <Button
                            size="sm"
                            variant="destructive"
                            disabled={reportUpdatingId === report.id}
                            onClick={() => handleReportDecision(report, "RESOLVED", "BAN_USER")}
                          >
                            유저 영구정지 (즉시)
                          </Button>
                          {removable ? (
                            <Button
                              size="sm"
                              variant="destructive"
                              disabled={reportUpdatingId === report.id}
                              onClick={() =>
                                handleReportDecision(report, "RESOLVED", "REMOVE_CONTENT_AND_BAN")
                              }
                            >
                              삭제 + 영구정지 (즉시)
                            </Button>
                          ) : null}
                        </div>
                      </>
                    ) : (
                      <div className="mt-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
                        <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-600">
                          <span>상태: {REPORT_STATUS_LABEL[report.status]}</span>
                          <span>액션: {REPORT_ACTION_LABEL[report.resolutionAction]}</span>
                          <span>피신고자 상태: {report.reportedUser?.status || "-"}</span>
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
