"use client";

import { useState } from "react";
import useSWR from "swr";
import { VoiceInquiryStatus, VoiceInquiryType } from "@prisma/client";
import { Button } from "@components/ui/button";
import { Textarea } from "@components/ui/textarea";
import { toast } from "react-toastify";

interface VoiceInquiryItem {
  id: number;
  type: VoiceInquiryType;
  status: VoiceInquiryStatus;
  title: string;
  description: string;
  contactEmail: string;
  requesterId: number | null;
  requesterName: string | null;
  adminNote: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
}

interface VoiceInquiryResponse {
  success: boolean;
  inquiries: VoiceInquiryItem[];
  counts: Record<VoiceInquiryStatus, number>;
  error?: string;
}

const STATUS_OPTIONS: (VoiceInquiryStatus | "ALL")[] = [
  "ALL",
  "OPEN",
  "IN_REVIEW",
  "DONE",
  "REJECTED",
];

const TYPE_LABEL: Record<VoiceInquiryType, string> = {
  BUG_REPORT: "버그 제보",
  FEATURE_REQUEST: "기능 요청",
  DEV_TEAM_REQUEST: "개발팀 요청",
};

const STATUS_LABEL: Record<VoiceInquiryStatus, string> = {
  OPEN: "접수됨",
  IN_REVIEW: "검토중",
  DONE: "완료",
  REJECTED: "보류/반려",
};

export default function AdminVoicePage() {
  const [statusFilter, setStatusFilter] = useState<VoiceInquiryStatus | "ALL">("ALL");
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [noteById, setNoteById] = useState<Record<number, string>>({});

  const query = statusFilter === "ALL" ? "" : `?status=${statusFilter}`;
  const { data, mutate, isLoading } = useSWR<VoiceInquiryResponse>(
    `/api/admin/voice-inquiries${query}`
  );

  const handleUpdateStatus = async (inquiry: VoiceInquiryItem, nextStatus: VoiceInquiryStatus) => {
    try {
      setUpdatingId(inquiry.id);
      const res = await fetch("/api/admin/voice-inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: inquiry.id,
          status: nextStatus,
          adminNote: noteById[inquiry.id] ?? inquiry.adminNote ?? "",
        }),
      });
      const result = await res.json();
      if (!res.ok || !result.success) {
        return toast.error(result.error || "상태 변경에 실패했습니다.");
      }
      toast.success("상태를 변경했습니다.");
      mutate();
    } catch {
      toast.error("요청 중 오류가 발생했습니다.");
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-2xl font-bold text-gray-900">고객의 소리 관리</h2>
        <div className="flex flex-wrap gap-2">
          {STATUS_OPTIONS.map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setStatusFilter(status)}
              className={
                statusFilter === status
                  ? "rounded-full bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white"
                  : "rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700"
              }
            >
              {status === "ALL" ? "전체" : STATUS_LABEL[status]}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-3 text-xs text-gray-600">
        접수 현황: OPEN {data?.counts?.OPEN ?? 0} / IN_REVIEW {data?.counts?.IN_REVIEW ?? 0} / DONE{" "}
        {data?.counts?.DONE ?? 0} / REJECTED {data?.counts?.REJECTED ?? 0}
      </div>

      {isLoading ? <p className="text-sm text-gray-500">불러오는 중...</p> : null}

      <div className="space-y-3">
        {(data?.inquiries || []).map((inquiry) => (
          <div
            key={inquiry.id}
            className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
          >
            <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
              <span className="font-semibold text-gray-700">#{inquiry.id}</span>
              <span>{TYPE_LABEL[inquiry.type]}</span>
              <span>상태: {STATUS_LABEL[inquiry.status]}</span>
              <span>접수일: {new Date(inquiry.createdAt).toLocaleString()}</span>
            </div>

            <p className="mt-2 text-sm font-semibold text-gray-900">{inquiry.title}</p>
            <p className="mt-1 whitespace-pre-line text-sm text-gray-700">{inquiry.description}</p>
            <p className="mt-2 text-xs text-gray-500">
              회신 이메일: {inquiry.contactEmail} / 요청자:{" "}
              {inquiry.requesterName || (inquiry.requesterId ? `ID ${inquiry.requesterId}` : "비로그인")}
            </p>

            <div className="mt-3 space-y-2">
              <Textarea
                rows={3}
                placeholder="내부 메모 (선택)"
                value={noteById[inquiry.id] ?? inquiry.adminNote ?? ""}
                onChange={(event) =>
                  setNoteById((prev) => ({ ...prev, [inquiry.id]: event.target.value }))
                }
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={updatingId === inquiry.id}
                  onClick={() => handleUpdateStatus(inquiry, "IN_REVIEW")}
                >
                  검토중
                </Button>
                <Button
                  size="sm"
                  disabled={updatingId === inquiry.id}
                  onClick={() => handleUpdateStatus(inquiry, "DONE")}
                >
                  완료
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={updatingId === inquiry.id}
                  onClick={() => handleUpdateStatus(inquiry, "REJECTED")}
                >
                  보류/반려
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={updatingId === inquiry.id}
                  onClick={() => handleUpdateStatus(inquiry, "OPEN")}
                >
                  접수됨으로 복귀
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {!isLoading && (data?.inquiries?.length || 0) === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-500">
          조건에 맞는 접수 내역이 없습니다.
        </div>
      ) : null}
    </div>
  );
}
