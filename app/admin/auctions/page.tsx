"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
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
  AUCTION_MIN_ACCOUNT_AGE_MS,
  AUCTION_MIN_DURATION_MS,
} from "@libs/auctionRules";
import { AdminAuctionsResponse } from "pages/api/admin/auctions";

const STATUS_OPTIONS = ["전체", "진행중", "종료", "유찰", "취소"] as const;

const hourText = (ms: number) => `${Math.floor(ms / (1000 * 60 * 60))}시간`;
const minuteText = (ms: number) => `${Math.floor(ms / (1000 * 60))}분`;

export default function AdminAuctionsPage() {
  const [page, setPage] = useState(1);
  const [keyword, setKeyword] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [status, setStatus] = useState<(typeof STATUS_OPTIONS)[number]>("전체");
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const { confirm, confirmDialog } = useConfirmDialog();

  const { data, mutate } = useSWR<AdminAuctionsResponse>(
    `/api/admin/auctions?page=${page}&keyword=${encodeURIComponent(searchQuery)}&status=${encodeURIComponent(status)}`
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

  const summary = useMemo(() => {
    return data?.summary || { total: 0, active: 0, ended: 0, failed: 0, cancelled: 0 };
  }, [data?.summary]);

  return (
    <>
      <div className="space-y-6">
        <div className="flex items-end justify-between">
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
            <li>• 고가 경매({AUCTION_HIGH_PRICE_REQUIRE_CONTACT.toLocaleString()}원 이상): 연락처 등록 계정만 허용</li>
            <li>• 입찰 가능 계정: ACTIVE + 가입 후 {hourText(AUCTION_MIN_ACCOUNT_AGE_MS)} 경과</li>
            <li>• 마감 임박 연장: 종료 {minuteText(AUCTION_EXTENSION_WINDOW_MS)} 이내 입찰 시 +{minuteText(AUCTION_EXTENSION_MS)}</li>
            <li>• 경매 수정 허용: 등록 후 {hourText(AUCTION_EDIT_WINDOW_MS)} 이내 + 입찰 0건 + 진행중</li>
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

        <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
          <form onSubmit={handleSearch} className="flex gap-2 max-w-xl">
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

        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
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
                    <p className="text-sm font-semibold text-gray-900 line-clamp-1">
                      #{auction.id} {auction.title}
                    </p>
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

        <div className="flex justify-center gap-2">
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
