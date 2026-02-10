"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import { toast } from "react-toastify";
import Image from "@components/atoms/Image";
import { makeImageUrl } from "@libs/client/utils";
import { Button } from "@components/ui/button";
import { Input } from "@components/ui/input";
import useConfirmDialog from "hooks/useConfirmDialog";
import {
  GuinnessSubmission,
  GuinnessSubmissionsResponse,
} from "pages/api/guinness/submissions";
import { GuinnessSpecies, GuinnessSpeciesListResponse } from "pages/api/guinness/species";

interface AdminGuinnessSubmissionsResponse extends GuinnessSubmissionsResponse {
  submissions: GuinnessSubmission[];
  topRecordsByKey: Record<
    string,
    {
      value: number;
      userName: string;
    }
  >;
}

interface AdminGuinnessSpeciesResponse extends GuinnessSpeciesListResponse {
  species: GuinnessSpecies[];
}

const STATUS_LABEL: Record<GuinnessSubmission["status"], string> = {
  pending: "심사 대기",
  approved: "승인",
  rejected: "반려",
};

const STATUS_CLASS: Record<GuinnessSubmission["status"], string> = {
  pending: "bg-amber-100 text-amber-700",
  approved: "bg-emerald-100 text-emerald-700",
  rejected: "bg-rose-100 text-rose-700",
};

const REVIEW_REASON_OPTIONS = [
  { code: "photo_blur", label: "증빙 사진 식별 어려움" },
  { code: "measurement_not_visible", label: "측정값/도구 확인 불가" },
  { code: "contact_missing", label: "연락처 정보 미흡" },
  { code: "invalid_value", label: "측정값 신뢰 어려움" },
  { code: "insufficient_description", label: "설명/근거 부족" },
  { code: "suspected_manipulation", label: "조작 의심" },
  { code: "other", label: "기타" },
] as const;

const REVIEW_REASON_LABELS: Record<string, string> = Object.fromEntries(
  REVIEW_REASON_OPTIONS.map((item) => [item.code, item.label])
);
const REVIEW_REASON_DEFAULT_MEMO: Record<string, string> = {
  photo_blur: "증빙 사진이 흐리거나 식별이 어려워 재촬영이 필요합니다.",
  measurement_not_visible: "측정값 또는 측정 도구가 사진에서 명확히 보이지 않습니다.",
  contact_missing: "심사 안내를 위한 연락처 확인이 어려워 정보 보완이 필요합니다.",
  invalid_value: "기재된 측정값과 증빙 자료 간 일치 여부를 확인하기 어렵습니다.",
  insufficient_description: "심사에 필요한 측정 환경/설명 정보가 부족합니다.",
  suspected_manipulation: "증빙 자료의 신뢰성 확인이 필요하여 보완 자료 제출이 필요합니다.",
  other: "추가 확인이 필요하여 반려되었습니다. 심사 메모를 확인해주세요.",
};

const getSlaText = (dueAt: string | Date) => {
  const due = new Date(dueAt).getTime();
  const now = Date.now();
  const diff = due - now;
  if (Number.isNaN(due)) return "SLA 정보 없음";
  if (diff <= 0) {
    const hours = Math.floor(Math.abs(diff) / (1000 * 60 * 60));
    return `SLA 초과 ${hours}시간`;
  }

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  return `SLA 남은 시간 ${hours}시간 ${mins}분`;
};
const sanitizeSpeciesInput = (value: string) =>
  String(value || "").replace(/[^가-힣ㄱ-ㅎㅏ-ㅣ]/g, "");

export default function AdminGuinnessPage() {
  const { data, mutate } = useSWR<AdminGuinnessSubmissionsResponse>(
    "/api/admin/guinness-submissions"
  );
  const { data: speciesData, mutate: mutateSpecies } =
    useSWR<AdminGuinnessSpeciesResponse>("/api/admin/guinness-species");
  const [memoById, setMemoById] = useState<Record<number, string>>({});
  const [reasonCodeById, setReasonCodeById] = useState<Record<number, string>>({});
  const [processingId, setProcessingId] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<
    "all" | "pending" | "approved" | "rejected"
  >("pending");
  const [keyword, setKeyword] = useState("");
  const [newSpeciesName, setNewSpeciesName] = useState("");
  const [newSpeciesAliases, setNewSpeciesAliases] = useState("");
  const [speciesKeyword, setSpeciesKeyword] = useState("");
  const [speciesProcessingId, setSpeciesProcessingId] = useState<number | null>(null);
  const { confirm, confirmDialog } = useConfirmDialog();

  const summary = useMemo(() => {
    const items = data?.submissions || [];
    return {
      all: items.length,
      pending: items.filter((item) => item.status === "pending").length,
      approved: items.filter((item) => item.status === "approved").length,
      rejected: items.filter((item) => item.status === "rejected").length,
    };
  }, [data?.submissions]);

  const filteredSubmissions = useMemo(() => {
    const items = data?.submissions || [];
    const normalizedKeyword = keyword.trim().toLowerCase();

    return items.filter((item) => {
      const statusMatched = statusFilter === "all" || item.status === statusFilter;
      const keywordMatched =
        !normalizedKeyword ||
        item.species.toLowerCase().includes(normalizedKeyword) ||
        item.userName.toLowerCase().includes(normalizedKeyword) ||
        String(item.userId).includes(normalizedKeyword);

      return statusMatched && keywordMatched;
    });
  }, [data?.submissions, keyword, statusFilter]);

  const filteredSpecies = useMemo(() => {
    const items = speciesData?.species || [];
    const normalizedKeyword = speciesKeyword.trim().toLowerCase();

    if (!normalizedKeyword) return items;
    return items.filter((item) => {
      const nameMatched = item.name.toLowerCase().includes(normalizedKeyword);
      const aliasMatched = item.aliases.some((alias) =>
        alias.toLowerCase().includes(normalizedKeyword)
      );
      return nameMatched || aliasMatched;
    });
  }, [speciesData?.species, speciesKeyword]);

  const reviewSubmission = async (
    submission: GuinnessSubmission,
    status: "approved" | "rejected"
  ) => {
    const selectedReasonCode = reasonCodeById[submission.id] || "";
    if (status === "rejected" && !selectedReasonCode) {
      toast.error("반려 사유 템플릿을 선택해주세요.");
      return;
    }

    const confirmed = await confirm({
      title:
        status === "approved"
          ? "이 신청을 승인할까요?"
          : "이 신청을 반려할까요?",
      description:
        status === "approved"
          ? "승인 시 공식 기네스 기록에 반영됩니다."
          : "반려 사유와 메모가 신청자에게 전달됩니다.",
      confirmText: status === "approved" ? "승인" : "반려",
      tone: status === "approved" ? "default" : "danger",
    });
    if (!confirmed) return;

    try {
      setProcessingId(submission.id);
      const res = await fetch("/api/admin/guinness-submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "review",
          id: submission.id,
          status,
          reviewReasonCode: selectedReasonCode || null,
          reviewMemo: (memoById[submission.id] || "").trim(),
        }),
      });
      const result = await res.json();
      if (!result.success) {
        return toast.error(result.error || "심사 처리에 실패했습니다.");
      }
      toast.success(status === "approved" ? "승인 처리되었습니다." : "반려 처리되었습니다.");
      mutate();
    } catch {
      toast.error("심사 처리 중 오류가 발생했습니다.");
    } finally {
      setProcessingId(null);
    }
  };

  const createSpecies = async () => {
    const name = newSpeciesName.trim();
    if (!name) {
      toast.error("등록할 종명을 입력해주세요.");
      return;
    }

    try {
      setSpeciesProcessingId(-1);
      const res = await fetch("/api/admin/guinness-species", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          name,
          aliases: newSpeciesAliases,
        }),
      });
      const result = await res.json();
      if (!result.success) {
        return toast.error(result.error || "종 등록에 실패했습니다.");
      }
      toast.success("공식 종으로 등록되었습니다.");
      setNewSpeciesName("");
      setNewSpeciesAliases("");
      mutateSpecies();
    } catch {
      toast.error("종 등록 중 오류가 발생했습니다.");
    } finally {
      setSpeciesProcessingId(null);
    }
  };

  const updateSpecies = async (
    species: GuinnessSpecies,
    action: "approve" | "toggle-active"
  ) => {
    const isToggleToInactive = action === "toggle-active" && species.isActive;
    const confirmed = await confirm({
      title:
        action === "approve"
          ? "이 종을 공식 종으로 승인할까요?"
          : isToggleToInactive
            ? "이 종을 비활성화할까요?"
            : "이 종을 활성화할까요?",
      description:
        action === "approve"
          ? "승인 후 유저 신청 폼 자동완성에 공식 종으로 노출됩니다."
          : isToggleToInactive
            ? "비활성화하면 신청 폼 추천 목록에서 제외됩니다."
            : "활성화하면 신청 폼 추천 목록에 다시 노출됩니다.",
      confirmText: action === "approve" ? "승인" : isToggleToInactive ? "비활성화" : "활성화",
      tone: isToggleToInactive ? "danger" : "default",
    });
    if (!confirmed) return;

    try {
      setSpeciesProcessingId(species.id);
      const res = await fetch("/api/admin/guinness-species", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, id: species.id }),
      });
      const result = await res.json();
      if (!result.success) {
        return toast.error(result.error || "종 상태 변경에 실패했습니다.");
      }
      toast.success(
        action === "approve"
          ? "공식 종으로 승인되었습니다."
          : species.isActive
            ? "종이 비활성화되었습니다."
            : "종이 활성화되었습니다."
      );
      mutateSpecies();
    } catch {
      toast.error("종 상태 변경 중 오류가 발생했습니다.");
    } finally {
      setSpeciesProcessingId(null);
    }
  };

  return (
    <>
      <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">기네스북 심사</h2>
          <p className="mt-1 text-sm text-gray-500">
            신청 데이터를 검토 후 승인하면 공식 기네스 기록으로 등록됩니다.
          </p>
        </div>
        <span className="text-sm text-gray-500">
          총 {data?.submissions?.length || 0}건
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <div className="rounded-lg border border-gray-200 bg-white p-3">
          <p className="text-xs text-gray-500">전체</p>
          <p className="text-xl font-bold text-gray-900">{summary.all}</p>
        </div>
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
          <p className="text-xs text-amber-700">심사 대기</p>
          <p className="text-xl font-bold text-amber-800">{summary.pending}</p>
        </div>
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
          <p className="text-xs text-emerald-700">승인</p>
          <p className="text-xl font-bold text-emerald-800">{summary.approved}</p>
        </div>
        <div className="rounded-lg border border-rose-200 bg-rose-50 p-3">
          <p className="text-xs text-rose-700">반려</p>
          <p className="text-xl font-bold text-rose-800">{summary.rejected}</p>
        </div>
      </div>

      <section className="rounded-xl border border-gray-200 bg-white p-4 space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="text-base font-semibold text-gray-900">종 마스터 관리</h3>
            <p className="mt-1 text-xs text-gray-500 leading-relaxed">
              유저가 입력한 미등록 종은 후보 상태로 누적됩니다. 후보를 승인하면 유저
              신청 폼 자동완성 목록에 공식 종으로 노출됩니다.
            </p>
          </div>
          <span className="text-xs text-gray-400">
            총 {speciesData?.species?.length || 0}개
          </span>
        </div>

        <div className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_1fr_auto]">
          <Input
            value={newSpeciesName}
            onChange={(event) =>
              setNewSpeciesName(sanitizeSpeciesInput(event.target.value))
            }
            placeholder="새 종명 (예: 아틀라스장수풍뎅이)"
          />
          <Input
            value={newSpeciesAliases}
            onChange={(event) => setNewSpeciesAliases(event.target.value)}
            placeholder="별칭/학명 (쉼표로 구분)"
          />
          <Button
            type="button"
            disabled={speciesProcessingId === -1}
            onClick={createSpecies}
          >
            공식 종 등록
          </Button>
        </div>

        <Input
          value={speciesKeyword}
          onChange={(event) => setSpeciesKeyword(event.target.value)}
          placeholder="등록된 종 검색 (이름/별칭)"
        />

        <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
          {filteredSpecies.map((item) => (
            <div
              key={item.id}
              className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5"
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{item.name}</p>
                  <p className="mt-0.5 text-xs text-gray-500">
                    별칭: {item.aliases.length > 0 ? item.aliases.join(", ") : "-"}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                      item.isOfficial
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {item.isOfficial ? "공식" : "후보"}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                      item.isActive
                        ? "bg-blue-100 text-blue-700"
                        : "bg-gray-200 text-gray-600"
                    }`}
                  >
                    {item.isActive ? "활성" : "비활성"}
                  </span>
                </div>
              </div>

              <div className="mt-2 flex flex-wrap justify-end gap-2">
                {!item.isOfficial && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={speciesProcessingId === item.id}
                    onClick={() => updateSpecies(item, "approve")}
                  >
                    후보 승인
                  </Button>
                )}
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={speciesProcessingId === item.id}
                  onClick={() => updateSpecies(item, "toggle-active")}
                >
                  {item.isActive ? "비활성화" : "활성화"}
                </Button>
              </div>
            </div>
          ))}

          {filteredSpecies.length === 0 && (
            <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-3 py-8 text-center text-sm text-gray-500">
              조건에 맞는 종 데이터가 없습니다.
            </div>
          )}
        </div>
      </section>

      <div className="rounded-xl border border-gray-200 bg-white p-3 space-y-3">
        <div className="flex flex-wrap gap-2">
          {[
            { id: "pending", label: "심사 대기" },
            { id: "all", label: "전체" },
            { id: "approved", label: "승인" },
            { id: "rejected", label: "반려" },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() =>
                setStatusFilter(
                  tab.id as "all" | "pending" | "approved" | "rejected"
                )
              }
              className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                statusFilter === tab.id
                  ? "bg-gray-900 text-white"
                  : "bg-gray-100 text-gray-600"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <Input
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
          placeholder="종명/신청자/유저ID 검색"
        />
      </div>

      <div className="space-y-3">
        {filteredSubmissions.map((submission) => {
          const isPending = submission.status === "pending";
          const currentMemo = memoById[submission.id] ?? submission.reviewMemo ?? "";
          const topKey = `${submission.species}::${submission.recordType}`;
          const topRecord = data?.topRecordsByKey?.[topKey];
          const topGap = topRecord ? submission.value - topRecord.value : null;

          return (
            <div
              key={submission.id}
              className="rounded-xl border border-gray-200 bg-white p-4"
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900">
                    {submission.species} ·{" "}
                    {submission.recordType === "size" ? "크기" : "무게"}{" "}
                    {submission.value}
                    {submission.recordType === "size" ? "mm" : "g"}
                  </p>
                  {submission.speciesRawText && (
                    <p className="mt-1 text-xs text-amber-700">
                      미등록 종 직접입력: {submission.speciesRawText}
                    </p>
                  )}
                  <p className="mt-1 text-xs text-gray-500">
                    신청자 {submission.userName} (#{submission.userId}) ·{" "}
                    {new Date(submission.submittedAt).toLocaleString()}
                  </p>
                  {submission.resubmitCount > 0 && (
                    <p className="mt-1 text-xs text-gray-500">
                      재신청 횟수: {submission.resubmitCount}회
                    </p>
                  )}
                  <p className="mt-1 text-xs text-gray-500">
                    연락처: {submission.contactPhone || "-"} /{" "}
                    {submission.contactEmail || "-"}
                  </p>
                  <p className="mt-1 text-xs text-gray-500">
                    접수: {new Date(submission.submittedAt).toLocaleString()}
                    {" "}
                    · 목표: {new Date(submission.slaDueAt).toLocaleString()}
                    {" "}
                    · {getSlaText(submission.slaDueAt)}
                  </p>
                </div>
                <span
                  className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_CLASS[submission.status]}`}
                >
                  {STATUS_LABEL[submission.status]}
                </span>
              </div>

              {submission.description && (
                <p className="mt-2 rounded-md bg-gray-50 px-3 py-2 text-sm text-gray-600">
                  {submission.description}
                </p>
              )}

              <div className="mt-2 rounded-md border border-gray-100 bg-gray-50 px-3 py-2">
                {topRecord ? (
                  <p className="text-xs text-gray-600">
                    현재 공식 최고:
                    {" "}
                    <span className="font-semibold">
                      {topRecord.value}
                      {submission.recordType === "size" ? "mm" : "g"} ({topRecord.userName})
                    </span>
                    {" "}
                    · 제출값 차이:
                    {" "}
                    <span
                      className={`font-semibold ${
                        (topGap || 0) > 0 ? "text-emerald-700" : "text-gray-600"
                      }`}
                    >
                      {topGap && topGap > 0 ? "+" : ""}
                      {topGap?.toFixed(2) || "0.00"}
                      {submission.recordType === "size" ? "mm" : "g"}
                    </span>
                  </p>
                ) : (
                  <p className="text-xs text-gray-600">현재 공식 최고 기록 없음 (신규 부문)</p>
                )}
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {submission.proofPhotos.map((photo, index) => (
                  <a
                    key={`${submission.id}-${photo}-${index}`}
                    href={makeImageUrl(photo, "public")}
                    target="_blank"
                    rel="noreferrer"
                    className="block h-20 w-20 overflow-hidden rounded-md border border-gray-200 bg-gray-50"
                  >
                    <Image
                      src={makeImageUrl(photo, "public")}
                      className="h-full w-full object-cover"
                      width={80}
                      height={80}
                      alt=""
                    />
                  </a>
                ))}
              </div>

              <textarea
                value={currentMemo}
                onChange={(event) =>
                  setMemoById((prev) => ({ ...prev, [submission.id]: event.target.value }))
                }
                disabled={!isPending}
                placeholder="심사 메모 (반려 시 사유 입력 권장)"
                className="mt-3 w-full rounded-md border border-gray-200 px-3 py-2 text-sm min-h-[84px] disabled:bg-gray-50"
              />

              <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
                {isPending ? (
                  <>
                    <select
                      value={reasonCodeById[submission.id] || ""}
                      onChange={(event) => {
                        const code = event.target.value;
                        setReasonCodeById((prev) => ({
                          ...prev,
                          [submission.id]: code,
                        }));
                        setMemoById((prev) => {
                          if ((prev[submission.id] || "").trim()) return prev;
                          return {
                            ...prev,
                            [submission.id]: REVIEW_REASON_DEFAULT_MEMO[code] || "",
                          };
                        });
                      }}
                      className="h-9 w-full rounded-md border border-gray-200 px-2 text-xs text-gray-700 sm:w-auto"
                    >
                      <option value="">반려 사유 템플릿 선택</option>
                      {REVIEW_REASON_OPTIONS.map((item) => (
                        <option key={item.code} value={item.code}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                    <Button
                      variant="outline"
                      className="w-full sm:w-auto"
                      disabled={processingId === submission.id}
                      onClick={() => reviewSubmission(submission, "rejected")}
                    >
                      반려
                    </Button>
                    <Button
                      className="w-full sm:w-auto"
                      disabled={processingId === submission.id}
                      onClick={() => reviewSubmission(submission, "approved")}
                    >
                      승인 후 기록 등록
                    </Button>
                  </>
                ) : (
                  <div className="text-right">
                    {submission.reviewReasonCode && (
                      <p className="text-xs text-gray-500">
                        반려 사유: {REVIEW_REASON_LABELS[submission.reviewReasonCode] || "기타"}
                      </p>
                    )}
                    <p className="text-xs text-gray-400">
                      {submission.reviewedAt
                        ? `심사 완료: ${new Date(submission.reviewedAt).toLocaleString()}`
                        : "심사 완료"}
                    </p>
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {filteredSubmissions.length === 0 && (
          <div className="rounded-xl border border-dashed border-gray-200 bg-white px-4 py-10 text-center text-gray-500">
            조건에 맞는 기네스북 신청이 없습니다.
          </div>
        )}
      </div>
      </div>
      {confirmDialog}
    </>
  );
}
