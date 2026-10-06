"use client";

/**
 * 브리디북 등록 — 당근 톤
 * 원본: bredy_app src/app/guinness/apply.tsx
 *
 * 헤더(뒤로·홈 + 가운데 제목) → 설명 13 muted → 필드(라벨 15/600 + 보조 13 muted + 입력 h48)
 * 종명·칩 1줄 / 측정값 + 공식 최고 기록 / 측정일 / 연락처 / 설명 / 증빙 사진 80px 행 / 체크리스트
 * → 내 신청 현황 카드 → 하단 고정 CTA "브리디북 심사 신청".
 * 임시저장은 계정별 localStorage 키(guinness_submission_draft_v2.<userId>), 예전 단일 키는 지운다.
 */
import { ChangeEvent, useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import Layout from "@components/features/MainLayout";
import Image from "@components/atoms/Image";
import { Input } from "@components/ui/input";
import { Textarea } from "@components/ui/textarea";
import { FilterChip } from "@components/app/FilterChip";
import {
  BloodlineBottomBar,
  BloodlineBottomBarSpacer,
  BloodlineSpinner,
  bloodlineInputClass,
  bloodlineTextareaClass,
  useBloodlineLoginRedirect,
} from "@components/features/bloodline/BloodlineScreenParts";
import useUser from "hooks/useUser";
import { authFetch } from "@libs/client/authFetch";
import { toast } from "@libs/client/toast";
import { cn, makeImageUrl } from "@libs/client/utils";
import {
  clearOtherGuinnessDrafts,
  getGuinnessDraftKey,
  readGuinnessDraft,
  removeGuinnessDraft,
  writeGuinnessDraft,
} from "@libs/client/guinnessDraft";
import { formatRecordValue } from "@libs/shared/guinness-record";
import type { RankingResponse } from "pages/api/ranking";
import type {
  GuinnessSubmission,
  GuinnessSubmissionsResponse,
} from "pages/api/guinness/submissions";
import type { GuinnessSpeciesListResponse } from "pages/api/guinness/species";

const STATUS_TEXT: Record<GuinnessSubmission["status"], string> = {
  pending: "심사 대기",
  approved: "승인 완료",
  rejected: "반려",
};

const REVIEW_REASON_LABELS: Record<string, string> = {
  photo_blur: "증빙 사진 식별 어려움",
  measurement_not_visible: "측정값/도구 확인 불가",
  contact_missing: "연락처 정보 미흡",
  invalid_value: "측정값 신뢰 어려움",
  insufficient_description: "설명/근거 부족",
  suspected_manipulation: "조작 의심",
  other: "기타",
};

const PHONE_REGEX = /^[0-9+\-\s()]{8,20}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SPECIES_NAME_REGEX = /^[가-힣ㄱ-ㅎㅏ-ㅣ]{2,30}$/;
const MAX_PROOF_COUNT = 3;
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;

const sanitizeSpeciesInput = (value: string) => String(value || "").replace(/[^가-힣ㄱ-ㅎㅏ-ㅣ]/g, "");

interface SubmissionDraft {
  species: string;
  recordType: "size";
  value: string;
  measurementDate: string;
  description: string;
  contactPhone: string;
  contactEmail: string;
  checklistPhotoClear: boolean;
  checklistToolVisible: boolean;
  checklistRealInfo: boolean;
  consentToContact: boolean;
}

const formatDate = (value?: string | Date | null) => {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString("ko-KR");
};

const getSlaText = (dueAt?: string | Date | null) => {
  if (!dueAt) return "SLA 정보 없음";
  const due = new Date(dueAt).getTime();
  if (Number.isNaN(due)) return "SLA 정보 없음";
  const diff = due - Date.now();
  if (diff <= 0) return `심사 지연 ${Math.floor(Math.abs(diff) / 3_600_000)}시간`;
  const hours = Math.floor(diff / 3_600_000);
  const mins = Math.floor((diff % 3_600_000) / 60_000);
  return `심사 목표까지 ${hours}시간 ${mins}분`;
};

function Field({
  label,
  helper,
  htmlFor,
  children,
}: {
  label: string;
  helper?: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-5">
      <label htmlFor={htmlFor} className="block text-[15px] font-semibold text-app-text">
        {label}
      </label>
      {helper ? <p className="mt-1 text-[13px] text-app-muted">{helper}</p> : null}
      <div className="mt-2 flex flex-col gap-2">{children}</div>
    </div>
  );
}

function CheckRow({
  checked,
  label,
  onToggle,
}: {
  checked: boolean;
  label: string;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={onToggle}
      className="flex items-start gap-2 text-left"
    >
      <span
        className={cn(
          "mt-px grid h-5 w-5 shrink-0 place-items-center rounded border",
          checked ? "border-app-text bg-app-text text-app-bg" : "border-app-border bg-app-bg"
        )}
      >
        {checked ? (
          <svg width={14} height={14} viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : null}
      </span>
      <span className="min-w-0 flex-1 text-[14px] leading-5 text-app-text">{label}</span>
    </button>
  );
}

function RemoveBadge({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="absolute right-1 top-1 rounded-full px-1.5 py-0.5 text-[11px] text-white"
      style={{ backgroundColor: "rgba(0, 0, 0, 0.6)" }}
    >
      삭제
    </button>
  );
}

async function uploadProofFile(file: File) {
  const urlResponse = await authFetch("/api/files");
  const { uploadURL, id } = (await urlResponse.json().catch(() => ({}))) as {
    uploadURL?: string;
    id?: string;
  };
  if (!urlResponse.ok || !uploadURL) throw new Error("증빙 사진 업로드에 실패했습니다.");
  const form = new FormData();
  form.append("file", file, file.name);
  const uploadResponse = await fetch(uploadURL, { method: "POST", body: form });
  const uploaded = (await uploadResponse.json().catch(() => null)) as { result?: { id?: string } } | null;
  const imageId = uploaded?.result?.id || id || "";
  if (!uploadResponse.ok || !imageId) throw new Error("증빙 사진 업로드에 실패했습니다.");
  return imageId;
}

export default function GuinnessApplyClient() {
  const { user, isLoading: userLoading } = useUser();
  const loggedOut = !user && !userLoading;
  useBloodlineLoginRedirect(loggedOut, "/guinness/apply");
  // 임시저장은 계정별 키에만 둔다. 사용자 ID를 알기 전에는 복원/저장하지 않는다.
  const draftKey = user?.id != null ? getGuinnessDraftKey(user.id) : null;

  const [species, setSpecies] = useState("");
  const [isSpeciesComposing, setIsSpeciesComposing] = useState(false);
  const [value, setValue] = useState("");
  const [measurementDate, setMeasurementDate] = useState("");
  const [description, setDescription] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [checklistPhotoClear, setChecklistPhotoClear] = useState(false);
  const [checklistToolVisible, setChecklistToolVisible] = useState(false);
  const [checklistRealInfo, setChecklistRealInfo] = useState(false);
  const [consentToContact, setConsentToContact] = useState(false);
  const [existingProofPhotos, setExistingProofPhotos] = useState<string[]>([]);
  const [proofFiles, setProofFiles] = useState<File[]>([]);
  const [editingSubmissionId, setEditingSubmissionId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  /** 복원을 마친 임시저장 키. 현재 draftKey 와 같을 때만 저장한다. */
  const [loadedDraftKey, setLoadedDraftKey] = useState<string | null>(null);

  const { data: rankingData } = useSWR<RankingResponse>("/api/ranking?tab=guinness");
  const { data: popularSpeciesData } = useSWR<GuinnessSpeciesListResponse>(
    "/api/guinness/species?limit=12"
  );
  const { data: searchedSpeciesData } = useSWR<GuinnessSpeciesListResponse>(
    species.trim() ? `/api/guinness/species?q=${encodeURIComponent(species)}&limit=12` : null
  );
  const submissionsQuery = useSWR<GuinnessSubmissionsResponse>(
    user?.id ? "/api/guinness/submissions" : null
  );

  const records = useMemo(
    () => (rankingData?.records || []).filter((record) => record.recordType === "size"),
    [rankingData?.records]
  );
  const mySubmissions = useMemo(
    () => submissionsQuery.data?.submissions || [],
    [submissionsQuery.data?.submissions]
  );
  /** 종 선택 칩 1줄: 입력 중이면 검색 결과, 아니면 인기 종. */
  const speciesChips = species.trim()
    ? searchedSpeciesData?.species || []
    : popularSpeciesData?.species || [];

  const proofPreviews = useMemo(() => proofFiles.map((file) => URL.createObjectURL(file)), [proofFiles]);
  useEffect(() => () => proofPreviews.forEach((url) => URL.revokeObjectURL(url)), [proofPreviews]);

  const activeTopRecord = useMemo(
    () =>
      records
        .filter((record) => record.species === species && record.recordType === "size")
        .sort((a, b) => b.value - a.value)[0] ?? null,
    [records, species]
  );
  const pendingSameType = useMemo(
    () =>
      mySubmissions.find(
        (item) =>
          item.status === "pending" &&
          item.species.trim().toLowerCase() === species.trim().toLowerCase() &&
          item.recordType === "size"
      ),
    [mySubmissions, species]
  );

  const numericValue = Number(value);
  const hasValidContact = Boolean(
    (contactPhone.trim() && PHONE_REGEX.test(contactPhone.trim())) ||
      (contactEmail.trim() && EMAIL_REGEX.test(contactEmail.trim()))
  );
  const isChecklistDone = checklistPhotoClear && checklistToolVisible && checklistRealInfo;
  const isValueValid = Boolean(value && Number.isFinite(numericValue) && numericValue > 0);
  const proofCount = existingProofPhotos.length + proofFiles.length;
  const isFormReady =
    Boolean(species.trim()) &&
    isValueValid &&
    proofCount > 0 &&
    hasValidContact &&
    isChecklistDone &&
    consentToContact;

  const clearForm = () => {
    setEditingSubmissionId(null);
    setSpecies("");
    setValue("");
    setMeasurementDate("");
    setDescription("");
    setContactPhone("");
    setContactEmail("");
    setChecklistPhotoClear(false);
    setChecklistToolVisible(false);
    setChecklistRealInfo(false);
    setConsentToContact(false);
    setExistingProofPhotos([]);
    setProofFiles([]);
  };

  // 계정이 바뀌면(로그아웃·다른 계정) 이전 계정 입력값을 비우고, 새 키 복원 전에는 저장하지 않는다.
  const [prevDraftKey, setPrevDraftKey] = useState(draftKey);
  if (prevDraftKey !== draftKey) {
    setPrevDraftKey(draftKey);
    setLoadedDraftKey(null);
    if (prevDraftKey) clearForm();
  }

  // 복원: 계정 구분 없던 v1 키와 다른 계정의 임시저장은 복원하지 않고 지운다.
  useEffect(() => {
    if (userLoading) return;
    clearOtherGuinnessDrafts(user?.id ?? null);
    if (!draftKey) return;
    const parsed = readGuinnessDraft<SubmissionDraft>(draftKey);
    if (parsed) {
      if (parsed.species) setSpecies(sanitizeSpeciesInput(parsed.species));
      setValue(parsed.value || "");
      setMeasurementDate(parsed.measurementDate || "");
      setDescription(parsed.description || "");
      setContactPhone(parsed.contactPhone || "");
      setContactEmail(parsed.contactEmail || "");
      setChecklistPhotoClear(Boolean(parsed.checklistPhotoClear));
      setChecklistToolVisible(Boolean(parsed.checklistToolVisible));
      setChecklistRealInfo(Boolean(parsed.checklistRealInfo));
      setConsentToContact(Boolean(parsed.consentToContact));
    }
    setLoadedDraftKey(draftKey);
  }, [draftKey, user?.id, userLoading]);

  useEffect(() => {
    if (!draftKey || loadedDraftKey !== draftKey) return;
    const draft: SubmissionDraft = {
      species,
      recordType: "size",
      value,
      measurementDate,
      description,
      contactPhone,
      contactEmail,
      checklistPhotoClear,
      checklistToolVisible,
      checklistRealInfo,
      consentToContact,
    };
    writeGuinnessDraft(draftKey, draft);
  }, [
    draftKey,
    loadedDraftKey,
    species,
    value,
    measurementDate,
    description,
    contactPhone,
    contactEmail,
    checklistPhotoClear,
    checklistToolVisible,
    checklistRealInfo,
    consentToContact,
  ]);

  const resetForm = () => {
    clearForm();
    if (draftKey) removeGuinnessDraft(draftKey);
  };

  const startResubmit = (submission: GuinnessSubmission) => {
    setEditingSubmissionId(submission.id);
    setSpecies(sanitizeSpeciesInput(submission.species));
    setValue(String(submission.value));
    setMeasurementDate(
      submission.measurementDate ? new Date(submission.measurementDate).toISOString().slice(0, 10) : ""
    );
    setDescription(submission.description || "");
    setContactPhone(submission.contactPhone || "");
    setContactEmail(submission.contactEmail || "");
    setConsentToContact(Boolean(submission.consentToContact));
    setExistingProofPhotos(submission.proofPhotos || []);
    setProofFiles([]);
    setChecklistPhotoClear(true);
    setChecklistToolVisible(true);
    setChecklistRealInfo(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSpeciesChange = (next: string) => {
    setSpecies(isSpeciesComposing ? next : sanitizeSpeciesInput(next));
  };

  const handleProofChange = (event: ChangeEvent<HTMLInputElement>) => {
    const incoming = Array.from(event.target.files || []);
    event.target.value = "";
    if (!incoming.length) return;
    const remaining = MAX_PROOF_COUNT - proofCount;
    if (remaining <= 0) {
      toast.info("증빙 사진은 최대 3장까지 등록할 수 있습니다.");
      return;
    }
    const picked: File[] = [];
    for (const file of incoming.slice(0, remaining)) {
      if (!file.type.startsWith("image/")) {
        toast.error("이미지 파일만 업로드할 수 있습니다.");
        continue;
      }
      if (file.size > MAX_IMAGE_SIZE) {
        toast.error("증빙 사진은 장당 10MB 이하만 업로드할 수 있습니다.");
        continue;
      }
      picked.push(file);
    }
    setProofFiles((prev) => [...prev, ...picked].slice(0, MAX_PROOF_COUNT));
  };

  const handleSubmit = async () => {
    if (submitting) return;
    const normalizedSpecies = species.trim();
    const fail = (message: string) => toast.error(message);
    if (!normalizedSpecies) return fail("종명을 입력해주세요.");
    if (!SPECIES_NAME_REGEX.test(normalizedSpecies)) return fail("종명은 한글만 2~30자로 입력해주세요.");
    if (!isValueValid) return fail("측정값을 올바르게 입력해주세요.");
    if (proofCount === 0) return fail("증빙 사진을 최소 1장 첨부해주세요.");
    if (!hasValidContact) return fail("전화번호 또는 이메일 형식을 확인해주세요.");
    if (!isChecklistDone) return fail("신청 전 체크리스트를 모두 확인해주세요.");
    if (!consentToContact) return fail("심사 연락 및 개인정보 처리 동의가 필요합니다.");
    if (!editingSubmissionId && pendingSameType) {
      return fail("해당 항목은 심사 진행 중입니다. 결과 확인 후 다시 신청해주세요.");
    }

    try {
      setSubmitting(true);
      const uploaded = await Promise.all(proofFiles.map(uploadProofFile));
      const finalProofPhotos = [...existingProofPhotos, ...uploaded].slice(0, MAX_PROOF_COUNT);
      if (!finalProofPhotos.length) throw new Error("증빙 사진 업로드에 실패했습니다.");

      const response = await authFetch("/api/guinness/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: editingSubmissionId ? "resubmit" : "submit",
          id: editingSubmissionId || undefined,
          species: normalizedSpecies,
          recordType: "size",
          value: numericValue,
          measurementDate,
          description: description.trim(),
          contactPhone: contactPhone.trim(),
          contactEmail: contactEmail.trim(),
          consentToContact,
          proofPhotos: finalProofPhotos,
        }),
      });
      const result = await response.json().catch(() => null);
      if (!result?.success) throw new Error(result?.error || "신청 등록에 실패했습니다.");

      toast.success(
        editingSubmissionId
          ? "수정 재신청이 접수되었습니다."
          : "기록 신청이 접수되었습니다. 심사 후 반영됩니다."
      );
      resetForm();
      void submissionsQuery.mutate();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "신청 처리 중 오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  if (userLoading || loggedOut) {
    return (
      <Layout canGoBack showHome title="브리디북 등록" seoTitle="브리디북 등록">
        <div className="flex min-h-[60vh] items-center justify-center">
          <BloodlineSpinner />
        </div>
      </Layout>
    );
  }

  const ctaDisabled = !isFormReady || submitting;
  // 날짜 입력 max 는 로컬 날짜(toISOString 은 UTC 라 한국 오전 9시 전엔 어제가 된다).
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  return (
    <Layout canGoBack showHome title="브리디북 등록" seoTitle="브리디북 등록">
      <div className="px-4 pb-8">
        <p className="pt-3 text-[13px] text-app-muted">
          증빙 자료와 연락처를 제출하면 심사 후 공식 기록으로 등록됩니다
        </p>

        {editingSubmissionId ? (
          <div className="mt-3 flex items-center justify-between">
            <p className="text-[15px] font-semibold text-app-text">반려 건 수정 재신청</p>
            <button
              type="button"
              onClick={resetForm}
              className="h-8 rounded-md bg-app-surface px-3 text-[13px] font-semibold text-app-text"
            >
              수정 취소
            </button>
          </div>
        ) : null}

        <Field
          label="종명"
          htmlFor="guinness-species"
          helper="한글만 입력할 수 있습니다. 공식 종이 없으면 후보 종으로 접수됩니다."
        >
          <Input
            id="guinness-species"
            value={species}
            onChange={(event) => handleSpeciesChange(event.target.value)}
            onCompositionStart={() => setIsSpeciesComposing(true)}
            onCompositionEnd={(event) => {
              setIsSpeciesComposing(false);
              setSpecies(sanitizeSpeciesInput(event.currentTarget.value));
            }}
            onBlur={(event) => setSpecies(sanitizeSpeciesInput(event.currentTarget.value))}
            placeholder="종명을 검색하거나 직접 입력하세요"
            autoComplete="off"
            className={bloodlineInputClass}
          />
          {speciesChips.length > 0 ? (
            <div className="flex gap-2 overflow-x-auto scrollbar-hide">
              {speciesChips.slice(0, 8).map((item) => (
                <FilterChip
                  key={item.id}
                  label={item.name}
                  selected={species === item.name}
                  onClick={() => setSpecies(item.name)}
                />
              ))}
            </div>
          ) : species.trim() ? (
            <p className="text-[13px] text-app-muted">
              검색된 공식 종이 없습니다. 그대로 신청하면 후보 종으로 등록됩니다.
            </p>
          ) : null}
        </Field>

        <Field label="측정값 (체장, mm)" htmlFor="guinness-value">
          <Input
            id="guinness-value"
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder="체장 입력 (예: 84.5)"
            className={bloodlineInputClass}
          />
          <p className="text-[13px] text-app-muted">
            {species.trim()
              ? `현재 ${species} 공식 최고 기록: ${
                  activeTopRecord
                    ? `${formatRecordValue(activeTopRecord.value)}mm (${activeTopRecord.user.name})`
                    : "없음"
                }`
              : "종명을 입력하면 현재 공식 최고 기록을 보여드립니다."}
          </p>
        </Field>

        <Field label="측정일" htmlFor="guinness-date">
          <Input
            id="guinness-date"
            type="date"
            value={measurementDate}
            max={today}
            onChange={(event) => setMeasurementDate(event.target.value)}
            className={bloodlineInputClass}
          />
        </Field>

        <Field
          label="연락처"
          htmlFor="guinness-phone"
          helper="전화번호/이메일 중 1개 이상 필수, 형식 오류 시 신청이 제한됩니다."
        >
          <Input
            id="guinness-phone"
            type="tel"
            value={contactPhone}
            onChange={(event) => setContactPhone(event.target.value)}
            placeholder="전화번호 (예: 010-1234-5678)"
            className={bloodlineInputClass}
          />
          <Input
            type="email"
            aria-label="이메일"
            value={contactEmail}
            onChange={(event) => setContactEmail(event.target.value)}
            placeholder="이메일 (예: bredy@example.com)"
            className={bloodlineInputClass}
          />
        </Field>

        <Field label="설명" htmlFor="guinness-description">
          <Textarea
            id="guinness-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="측정 환경, 측정 도구, 개체 특이사항 등 심사에 필요한 내용을 입력해주세요."
            className={bloodlineTextareaClass}
          />
        </Field>

        <Field label="증빙 사진" helper="원본 사진 최대 3장. 측정 수치와 개체가 식별되게 촬영해주세요.">
          <div className="flex gap-2 overflow-x-auto scrollbar-hide">
            <label
              htmlFor="guinness-proof"
              aria-label="증빙 사진 추가"
              className="flex h-20 w-20 shrink-0 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-app-border bg-app-bg"
            >
              <svg width={18} height={18} viewBox="0 0 24 24" fill="none" aria-hidden="true" className="text-app-muted">
                <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" />
              </svg>
              <span className="text-[12px] text-app-muted">
                {proofCount}/{MAX_PROOF_COUNT}
              </span>
            </label>
            <input
              id="guinness-proof"
              type="file"
              multiple
              accept="image/*"
              className="sr-only"
              onChange={handleProofChange}
            />
            {existingProofPhotos.map((photoId, index) => (
              <div
                key={`existing-${photoId}-${index}`}
                className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-app-surface"
              >
                <Image
                  src={makeImageUrl(photoId, "public")}
                  alt=""
                  width={80}
                  height={80}
                  className="h-20 w-20 object-cover"
                />
                <RemoveBadge
                  onClick={() => setExistingProofPhotos((prev) => prev.filter((_, i) => i !== index))}
                />
              </div>
            ))}
            {proofPreviews.map((preview, index) => (
              <div
                key={`${preview}-${index}`}
                className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-app-surface"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={preview} alt={`증빙 사진 ${index + 1}`} className="h-20 w-20 object-cover" />
                <RemoveBadge onClick={() => setProofFiles((prev) => prev.filter((_, i) => i !== index))} />
              </div>
            ))}
          </div>
        </Field>

        <Field label="신청 전 체크리스트">
          <CheckRow
            checked={checklistPhotoClear}
            onToggle={() => setChecklistPhotoClear((prev) => !prev)}
            label="사진에서 개체와 측정 수치가 명확히 보입니다."
          />
          <CheckRow
            checked={checklistToolVisible}
            onToggle={() => setChecklistToolVisible((prev) => !prev)}
            label="측정 도구(자/저울)가 식별 가능하게 촬영했습니다."
          />
          <CheckRow
            checked={checklistRealInfo}
            onToggle={() => setChecklistRealInfo((prev) => !prev)}
            label="허위/도용 자료 제출 시 제재될 수 있음을 확인했습니다."
          />
          <CheckRow
            checked={consentToContact}
            onToggle={() => setConsentToContact((prev) => !prev)}
            label="심사 안내를 위한 연락 및 개인정보 처리에 동의합니다."
          />
        </Field>

        <section className="mt-8">
          <h2 className="text-[17px] font-bold text-app-text">내 신청 현황</h2>
          <div className="mt-3 flex flex-col gap-2.5">
            {submissionsQuery.isLoading ? (
              <div className="flex justify-center rounded-xl border border-app-border bg-app-elevated p-4">
                <BloodlineSpinner />
              </div>
            ) : submissionsQuery.error && !submissionsQuery.data ? (
              <div className="rounded-xl border border-app-border bg-app-elevated p-4 text-center">
                <p className="text-[14px] text-app-muted">신청 현황을 불러오지 못했어요.</p>
                <button
                  type="button"
                  onClick={() => void submissionsQuery.mutate()}
                  className="mt-3 h-10 rounded-md bg-app-surface px-4 text-[14px] font-semibold text-app-text"
                >
                  다시 시도
                </button>
              </div>
            ) : mySubmissions.length > 0 ? (
              mySubmissions.map((submission) => (
                <div key={submission.id} className="rounded-xl border border-app-border bg-app-elevated p-4">
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-[16px] font-semibold text-app-text">
                        {submission.species} · 체장 {formatRecordValue(submission.value)}mm
                      </p>
                      <p className="mt-1 text-[13px] text-app-muted">
                        신청일 {formatDate(submission.submittedAt)}
                      </p>
                      {submission.measurementDate ? (
                        <p className="mt-0.5 text-[13px] text-app-muted">
                          측정일 {formatDate(submission.measurementDate)}
                        </p>
                      ) : null}
                      {submission.status === "pending" ? (
                        <p className="mt-0.5 text-[13px] text-app-muted">{getSlaText(submission.slaDueAt)}</p>
                      ) : null}
                    </div>
                    <span className="shrink-0 rounded-md bg-app-surface px-2 py-1 text-[12px] font-semibold text-app-muted">
                      {STATUS_TEXT[submission.status]}
                    </span>
                  </div>
                  {submission.reviewMemo ? (
                    <p className="mt-2.5 text-[14px] text-app-muted">심사 메모: {submission.reviewMemo}</p>
                  ) : null}
                  {submission.reviewReasonCode ? (
                    <p className="mt-1 text-[14px] text-app-muted">
                      반려 사유: {REVIEW_REASON_LABELS[submission.reviewReasonCode] || "기타"}
                    </p>
                  ) : null}
                  {submission.status === "rejected" ? (
                    <button
                      type="button"
                      onClick={() => startResubmit(submission)}
                      className="mt-3 h-10 rounded-md bg-app-surface px-4 text-[14px] font-semibold text-app-text"
                    >
                      수정 후 재신청
                    </button>
                  ) : null}
                </div>
              ))
            ) : (
              <p className="text-[14px] text-app-muted">아직 신청한 내역이 없습니다.</p>
            )}
          </div>
        </section>
      </div>

      <BloodlineBottomBarSpacer />
      <BloodlineBottomBar>
        <button
          type="button"
          disabled={ctaDisabled}
          onClick={() => void handleSubmit()}
          className={cn(
            "inline-flex h-[52px] w-full items-center justify-center rounded-md text-[16px] font-semibold",
            ctaDisabled ? "bg-app-surface text-app-caption" : "bg-app-brand text-white"
          )}
        >
          {submitting ? "신청 접수 중..." : "브리디북 심사 신청"}
        </button>
      </BloodlineBottomBar>
    </Layout>
  );
}
