"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import { toast } from "react-toastify";
import { Button } from "@components/ui/button";
import { Input } from "@components/ui/input";
import useConfirmDialog from "hooks/useConfirmDialog";
import {
  AUCTION_EDIT_WINDOW_MS,
  AUCTION_EXTENSION_MS,
  AUCTION_EXTENSION_WINDOW_MS,
  AUCTION_HIGH_PRICE_REQUIRE_CONTACT,
  AUCTION_MAX_ACTIVE_PER_USER,
  AUCTION_MAX_DURATION_MS,
  AUCTION_MIN_DURATION_MS,
} from "@libs/auctionRules";
import { AdminAuctionsResponse } from "pages/api/admin/auctions";
import {
  AdminAuctionReportItem,
  AdminAuctionReportsResponse,
} from "pages/api/admin/auction-reports";

const STATUS_OPTIONS = ["전체", "진행중", "종료", "유찰", "취소"] as const;
type ReportAction =
  | "NONE"
  | "STOP_AUCTION"
  | "BAN_USER"
  | "STOP_AUCTION_AND_BAN";

const hourText = (ms: number) => `${Math.floor(ms / (1000 * 60 * 60))}시간`;
const minuteText = (ms: number) => `${Math.floor(ms / (1000 * 60))}분`;

export default function AdminAuctionsPage() {
  const [page, setPage] = useState(1);
  const [keyword, setKeyword] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [status, setStatus] = useState<(typeof STATUS_OPTIONS)[number]>("전체");
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [reportUpdatingId, setReportUpdatingId] = useState<number | null>(null);
  const { confirm, confirmDialog } = useConfirmDialog();

  const { data, mutate } = useSWR<AdminAuctionsResponse>(
    `/api/admin/auctions?page=${page}&keyword=${encodeURIComponent(searchQuery)}&status=${encodeURIComponent(status)}`
  );
  const { data: reportData, mutate: mutateReports } = useSWR<AdminAuctionReportsResponse>(
    "/api/admin/auction-reports?status=ALL"
  );

  const openReports = useMemo(
    () => reportData?.reports?.filter((report) => report.status === "OPEN") || [],
    [reportData?.reports]
  );
  const processedReports = useMemo(
    () =>
      (reportData?.reports || [])
        .filter((report) => report.status !== "OPEN")
        .slice(0, 8),
    [reportData?.reports]
  );

  const handleSearch = (event: React.FormEvent) => {
    event.preventDefault();
    setPage(1);
    setSearchQuery(keyword.trim());
  };

  const handleStatusChange = async (auctionId: number, nextStatus: string) => {
    const confirmed = await confirm({
      title: `경매 상태를 "${nextStatus}"(으)로 변경할까요?`,
      description: "관리자 상태 변경은 즉시 반영됩니다.",
      confirmText: "변경",
      tone: nextStatus === "취소" ? "danger" : "default",
    });
    if (!confirmed) return;

    try {
      setUpdatingId(auctionId);
      const res = await fetch("/api/admin/auctions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_status",
          id: auctionId,
          status: nextStatus,
        }),
      });
      const result = await res.json();
      if (!result.success) {
        return toast.error(result.error || "상태 변경에 실패했습니다.");
      }
      toast.success("경매 상태가 변경되었습니다.");
      mutate();
    } catch {
      toast.error("오류가 발생했습니다.");
    } finally {
      setUpdatingId(null);
    }
  };

  const handleDeleteAuction = async (auctionId: number, auctionTitle: string) => {
    const confirmed = await confirm({
      title: "이 경매를 완전히 삭제할까요?",
      description: [
        `대상: #${auctionId} ${auctionTitle}`,
        "삭제 후에는 복구할 수 없습니다.",
        "연결된 입찰 데이터도 함께 삭제됩니다.",
      ].join("\n"),
      confirmText: "삭제",
      tone: "danger",
      confirmKeyword: "DELETE",
      confirmKeywordLabel: "삭제 실행 키워드",
    });
    if (!confirmed) return;

    try {
      setUpdatingId(auctionId);
      const res = await fetch("/api/admin/auctions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "delete",
          id: auctionId,
        }),
      });
      const result = await res.json();
      if (!result.success) {
        return toast.error(result.error || "경매 삭제에 실패했습니다.");
      }
      toast.success("경매가 삭제되었습니다.");
      mutate();
      mutateReports();
    } catch {
      toast.error("오류가 발생했습니다.");
    } finally {
      setUpdatingId(null);
    }
  };

  const handleReportDecision = async (
    report: AdminAuctionReportItem,
    decision: "RESOLVED" | "REJECTED",
    action: ReportAction
  ) => {
    const targetUserLabel = report.reportedUser?.name || `ID ${report.reportedUserId}`;
    const reporterLabel = report.reporter?.name || `ID ${report.reporterId}`;
    const auctionLabel = report.auction?.title || `경매 #${report.auctionId}`;

    const decisionSummary = (() => {
      if (decision === "REJECTED") return "결과: 신고 기각(제재 없음)";
      if (action === "STOP_AUCTION")
        return "결과: 신고 처리 + 대상 경매 취소(중단)";
      if (action === "BAN_USER")
        return `결과: 신고 처리 + 피신고자(${targetUserLabel}) 영구정지`;
      if (action === "STOP_AUCTION_AND_BAN")
        return `결과: 경매 취소(중단) + 피신고자(${targetUserLabel}) 영구정지`;
      return "결과: 신고 처리 완료(제재 없음)";
    })();

    const confirmed = await confirm({
      title:
        action === "STOP_AUCTION_AND_BAN"
          ? "신고 처리와 함께 경매 중단 + 피신고자 영구정지를 실행할까요?"
          : action === "STOP_AUCTION"
            ? "신고 처리와 함께 대상 경매를 즉시 중단(취소)할까요?"
            : action === "BAN_USER"
          ? "신고 처리와 함께 피신고 계정을 영구정지할까요?"
          : decision === "REJECTED"
            ? "신고를 기각할까요?"
            : "신고를 처리 완료로 변경할까요?",
      description: [
        `신고 #${report.id}`,
        `대상 경매: ${auctionLabel}`,
        `신고자: ${reporterLabel}`,
        `피신고자: ${targetUserLabel}`,
        decisionSummary,
        action === "BAN_USER" || action === "STOP_AUCTION_AND_BAN"
          ? "아래 입력칸에 BAN을 정확히 입력해야 실행됩니다."
          : "",
        "처리 결과는 즉시 반영되며 되돌리기 어렵습니다.",
      ]
        .filter(Boolean)
        .join("\n"),
      confirmText:
        action === "BAN_USER"
          ? "유저 영구정지 실행"
          : action === "STOP_AUCTION_AND_BAN"
            ? "경매중단+영구정지 실행"
            : action === "STOP_AUCTION"
              ? "경매 중단 실행"
              : "처리 실행",
      tone:
        action === "BAN_USER" || action === "STOP_AUCTION_AND_BAN"
          ? "danger"
          : "default",
      confirmKeyword:
        action === "BAN_USER" || action === "STOP_AUCTION_AND_BAN"
          ? "BAN"
          : "",
      confirmKeywordLabel: "영구정지 실행 키워드",
    });
    if (!confirmed) return;

    try {
      setReportUpdatingId(report.id);
      const res = await fetch("/api/admin/auction-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reportId: report.id,
          decision,
          action,
          note:
            action === "BAN_USER"
              ? "운영자 판단으로 영구정지 처리"
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
        action === "BAN_USER" ? "신고 처리 및 영구정지가 완료되었습니다." : "신고가 처리되었습니다."
      );
      mutateReports();
    } catch {
      toast.error("오류가 발생했습니다.");
    } finally {
      setReportUpdatingId(null);
    }
  };

  const summary = useMemo(() => {
    return data?.summary || { total: 0, active: 0, ended: 0, failed: 0, cancelled: 0 };
  }, [data?.summary]);

  return (
    <>
      <div className="space-y-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">경매 관리</h2>
            <p className="mt-1 text-sm text-gray-500">
              상태 변경, 진행 현황, 내부 제약조건을 함께 관리합니다.
            </p>
          </div>
        </div>

        <section className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-2">
          <p className="text-sm font-semibold text-amber-900">운영 전용 제약조건 (ADMIN ONLY)</p>
          <ul className="space-y-1 text-xs text-amber-800 leading-relaxed">
            <li>• 경매 기간: {hourText(AUCTION_MIN_DURATION_MS)} ~ {hourText(AUCTION_MAX_DURATION_MS)}</li>
            <li>• 동시 진행 경매: 유저당 최대 {AUCTION_MAX_ACTIVE_PER_USER}개</li>
            <li>• 고가 경매({AUCTION_HIGH_PRICE_REQUIRE_CONTACT.toLocaleString()}원 이상): 연락처(전화/이메일) 정보 필요</li>
            <li>• 입찰 가능 계정: ACTIVE 계정만 허용</li>
            <li>• 마감 임박 연장: 종료 {minuteText(AUCTION_EXTENSION_WINDOW_MS)} 이내 입찰 시 +{minuteText(AUCTION_EXTENSION_MS)}</li>
            <li>• 경매 수정 허용: 진행중 상태 + 등록 후 {minuteText(AUCTION_EDIT_WINDOW_MS)} 이내 + 입찰 0건</li>
            <li>• 최고 입찰자 재입찰 금지 / 입찰 금액은 단위 배수만 허용</li>
          </ul>
        </section>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          <div className="rounded-lg border border-gray-200 bg-white p-3">
            <p className="text-xs text-gray-500">전체</p>
            <p className="text-xl font-bold text-gray-900">{summary.total}</p>
          </div>
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
            <p className="text-xs text-emerald-700">진행중</p>
            <p className="text-xl font-bold text-emerald-800">{summary.active}</p>
          </div>
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
            <p className="text-xs text-blue-700">종료</p>
            <p className="text-xl font-bold text-blue-800">{summary.ended}</p>
          </div>
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
            <p className="text-xs text-gray-600">유찰</p>
            <p className="text-xl font-bold text-gray-700">{summary.failed}</p>
          </div>
          <div className="rounded-lg border border-rose-200 bg-rose-50 p-3">
            <p className="text-xs text-rose-700">취소</p>
            <p className="text-xl font-bold text-rose-800">{summary.cancelled}</p>
          </div>
        </div>

        <section className="rounded-xl border border-rose-200 bg-rose-50 p-4">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-rose-900">
              오픈 신고 {reportData?.counts?.OPEN ?? 0}건
            </h3>
            <span className="text-xs text-rose-700">
              RESOLVED {reportData?.counts?.RESOLVED ?? 0} / REJECTED {reportData?.counts?.REJECTED ?? 0}
            </span>
          </div>
          <div className="mt-2 rounded-md border border-rose-200 bg-white/80 px-2.5 py-2 text-[11px] leading-relaxed text-rose-900">
            <p>정책: 신고 접수만으로 경매/유저가 자동 제재되지는 않습니다.</p>
            <p>처리 완료(제재 없음): 신고만 종결합니다.</p>
            <p>경매 중단: 대상 경매를 취소 상태로 전환합니다.</p>
            <p>유저 영구정지: 피신고자 계정을 BANNED 처리합니다.</p>
            <p>중단+정지: 경매 취소와 계정 영구정지를 동시에 실행합니다.</p>
          </div>

          <div className="mt-3 space-y-2">
            {openReports.length ? (
              openReports.map((report) => (
                <div
                  key={report.id}
                  className="rounded-lg border border-rose-100 bg-white p-3"
                >
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span className="font-semibold text-slate-700">#{report.id}</span>
                    <span>경매 #{report.auctionId}</span>
                    <span>신고일 {new Date(report.createdAt).toLocaleString()}</span>
                  </div>
                  <p className="mt-1 text-sm font-semibold text-slate-900">
                    {report.auction?.title || "삭제된 경매"} ({report.auction?.status || "상태 없음"})
                  </p>
                  <p className="mt-1 text-sm text-slate-700">
                    신고자: {report.reporter?.name || `ID ${report.reporterId}`} /
                    피신고자: {report.reportedUser?.name || `ID ${report.reportedUserId}`}
                  </p>
                    <p className="mt-1 text-sm text-slate-700">사유: {report.reason}</p>
                  <p className="mt-1 text-sm text-slate-600 whitespace-pre-line">{report.detail}</p>
                  <div className="mt-2 rounded-md border border-rose-100 bg-rose-50/60 px-2.5 py-2 text-[11px] leading-relaxed text-rose-900">
                    <p>처리 완료(제재 없음): 신고를 인정하고 종료합니다.</p>
                    <p>신고 기각: 근거 부족/운영기준 미충족으로 종료합니다.</p>
                    <p>경매 중단: 대상 경매를 취소 상태로 중단합니다.</p>
                    <p>유저 영구정지: 피신고자를 즉시 영구정지합니다.</p>
                    <p>중단 + 영구정지: 경매 취소와 유저 영구정지를 동시에 실행합니다.</p>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={reportUpdatingId === report.id}
                      onClick={() =>
                        handleReportDecision(report, "RESOLVED", "NONE")
                      }
                    >
                      처리 완료 (제재 없음)
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={reportUpdatingId === report.id}
                      onClick={() =>
                        handleReportDecision(report, "REJECTED", "NONE")
                      }
                    >
                      신고 기각 (근거 부족)
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={reportUpdatingId === report.id}
                      onClick={() =>
                        handleReportDecision(report, "RESOLVED", "STOP_AUCTION")
                      }
                    >
                      경매 중단 (취소 처리)
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={reportUpdatingId === report.id}
                      onClick={() =>
                        handleReportDecision(report, "RESOLVED", "BAN_USER")
                      }
                    >
                      유저 영구정지 (즉시)
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={reportUpdatingId === report.id}
                      onClick={() =>
                        handleReportDecision(report, "RESOLVED", "STOP_AUCTION_AND_BAN")
                      }
                    >
                      중단 + 영구정지 (즉시)
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <p className="rounded-lg border border-dashed border-rose-200 bg-white px-3 py-4 text-sm text-rose-700">
                현재 처리 대기 중인 신고가 없습니다.
              </p>
            )}
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <h3 className="text-sm font-semibold text-slate-900">최근 처리된 신고</h3>
          <div className="mt-2 space-y-2">
            {processedReports.length ? (
              processedReports.map((report) => (
                <div
                  key={report.id}
                  className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2"
                >
                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-600">
                    <span className="font-semibold text-slate-800">#{report.id}</span>
                    <span>{report.auction?.title || `경매 #${report.auctionId}`}</span>
                    <span>상태: {report.status}</span>
                    <span>액션: {report.resolutionAction}</span>
                    <span>피신고자 상태: {report.reportedUser?.status || "-"}</span>
                    <span>경매 상태: {report.auction?.status || "-"}</span>
                  </div>
                  {report.resolutionNote ? (
                    <p className="mt-1 text-[11px] text-slate-500">
                      메모: {report.resolutionNote}
                    </p>
                  ) : null}
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-500">처리된 신고 이력이 없습니다.</p>
            )}
          </div>
        </section>

        <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
          <form onSubmit={handleSearch} className="flex max-w-xl flex-col gap-2 sm:flex-row">
            <Input
              placeholder="제목, 설명, 등록자 검색"
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
            />
            <Button type="submit">검색</Button>
          </form>
          <div className="flex flex-wrap gap-2">
            {STATUS_OPTIONS.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => {
                  setStatus(option);
                  setPage(1);
                }}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold ${
                  status === option
                    ? "bg-gray-900 text-white"
                    : "bg-gray-100 text-gray-600"
                }`}
              >
                {option}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <div className="overflow-x-auto">
            <table className="min-w-[920px] divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  경매 정보
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  현재가/입찰
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  종료 시각
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  상태
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  관리
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {data?.auctions?.map((auction) => (
                <tr key={auction.id}>
                  <td className="px-6 py-4">
                    <Link
                      href={`/auctions/${auction.id}`}
                      target="_blank"
                      className="inline-flex max-w-full text-sm font-semibold text-gray-900 underline-offset-2 hover:underline"
                    >
                      <span className="line-clamp-1">#{auction.id} {auction.title}</span>
                    </Link>
                    <p className="mt-1 text-xs text-gray-500">
                      등록자: {auction.user?.name} ({auction.user?.email || "이메일 없음"})
                    </p>
                    <p className="mt-1 text-xs text-gray-400 line-clamp-1">
                      {auction.description}
                    </p>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                    <p className="font-semibold text-primary">
                      {auction.currentPrice.toLocaleString()}원
                    </p>
                    <p className="text-xs text-gray-500">입찰 {auction._count?.bids || 0}건</p>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {new Date(auction.endAt).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                        auction.status === "진행중"
                          ? "bg-emerald-100 text-emerald-700"
                          : auction.status === "종료"
                            ? "bg-blue-100 text-blue-700"
                            : auction.status === "유찰"
                              ? "bg-gray-100 text-gray-600"
                              : "bg-rose-100 text-rose-700"
                      }`}
                    >
                      {auction.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right space-x-2">
                    {auction.status === "진행중" && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={updatingId === auction.id}
                          onClick={() => handleStatusChange(auction.id, "종료")}
                        >
                          종료처리
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={updatingId === auction.id}
                          onClick={() => handleStatusChange(auction.id, "취소")}
                        >
                          취소처리
                        </Button>
                      </>
                    )}
                    {auction.status !== "진행중" && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={updatingId === auction.id}
                        onClick={() => handleStatusChange(auction.id, "진행중")}
                      >
                        진행중 복귀
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="destructive"
                      disabled={updatingId === auction.id}
                      onClick={() => handleDeleteAuction(auction.id, auction.title)}
                    >
                      삭제
                    </Button>
                  </td>
                </tr>
              ))}

              {data?.auctions?.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-gray-500">
                    조회된 경매가 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
            </table>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button
            variant="outline"
            disabled={page === 1}
            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
          >
            이전
          </Button>
          <span className="flex items-center px-4 text-sm">
            Page {page} / {data?.totalPages || 1}
          </span>
          <Button
            variant="outline"
            disabled={page >= (data?.totalPages || 1)}
            onClick={() => setPage((prev) => prev + 1)}
          >
            다음
          </Button>
        </div>
      </div>
      {confirmDialog}
    </>
  );
}
