"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import Layout from "@components/features/MainLayout";
import Image from "@components/atoms/Image";
import { makeImageUrl } from "@libs/client/utils";
import { Button } from "@components/ui/button";
import { Input } from "@components/ui/input";
import { Textarea } from "@components/ui/textarea";
import { toast } from "react-toastify";
import { RankingResponse } from "pages/api/ranking";
import {
  GuinnessSubmission,
  GuinnessSubmissionsResponse,
} from "pages/api/guinness/submissions";
import { GuinnessSpeciesListResponse } from "pages/api/guinness/species";

const STATUS_TEXT: Record<GuinnessSubmission["status"], string> = {
  pending: "심사 대기",
  approved: "승인 완료",
  rejected: "반려",
};

const STATUS_CLASS: Record<GuinnessSubmission["status"], string> = {
  pending: "bg-amber-100 text-amber-700",
  approved: "bg-emerald-100 text-emerald-700",
  rejected: "bg-rose-100 text-rose-700",
};

const PHONE_REGEX = /^[0-9+\-\s()]{8,20}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SPECIES_NAME_REGEX = /^[가-힣ㄱ-ㅎㅏ-ㅣ]{2,30}$/;
const DRAFT_KEY = "guinness_submission_draft_v1";
const SLA_HOURS = 72;
const sanitizeSpeciesInput = (value: string) =>
  String(value || "").replace(/[^가-힣ㄱ-ㅎㅏ-ㅣ]/g, "");

const REVIEW_REASON_LABELS: Record<string, string> = {
  photo_blur: "증빙 사진 식별 어려움",
  measurement_not_visible: "측정값/도구 확인 불가",
  contact_missing: "연락처 정보 미흡",
  invalid_value: "측정값 신뢰 어려움",
  insufficient_description: "설명/근거 부족",
  suspected_manipulation: "조작 의심",
  other: "기타",
};

const getMedalClass = (rank: number) => {
  if (rank === 1) return "bg-yellow-400 text-white";
  if (rank === 2) return "bg-gray-400 text-white";
  if (rank === 3) return "bg-amber-700 text-white";
  return "bg-gray-100 text-gray-600";
};

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

const getSlaText = (dueAt: string | Date) => {
  const due = new Date(dueAt).getTime();
  const diff = due - Date.now();
  if (Number.isNaN(due)) return "SLA 정보 없음";
  if (diff <= 0) {
    const overHours = Math.floor(Math.abs(diff) / (1000 * 60 * 60));
    return `심사 지연 ${overHours}시간`;
  }
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  return `심사 목표까지 ${hours}시간 ${mins}분`;
};

export default function GuinnessApplyClient() {
  const { data: rankingData } = useSWR<RankingResponse>("/api/ranking?tab=guinness");
  const { data: submissionData, mutate } =
    useSWR<GuinnessSubmissionsResponse>("/api/guinness/submissions");

  const [species, setSpecies] = useState("");
  const [isSpeciesComposing, setIsSpeciesComposing] = useState(false);
  const [recordType] = useState<"size">("size");
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
  const [submitting, setSubmitting] = useState(false);
  const [editingSubmissionId, setEditingSubmissionId] = useState<number | null>(null);
  const { data: popularSpeciesData } = useSWR<GuinnessSpeciesListResponse>(
    "/api/guinness/species?limit=12"
  );
  const { data: searchedSpeciesData } = useSWR<GuinnessSpeciesListResponse>(
    `/api/guinness/species?q=${encodeURIComponent(species)}&limit=12`
  );

  const proofPreviews = useMemo(
    () => proofFiles.map((file) => URL.createObjectURL(file)),
    [proofFiles]
  );

  useEffect(() => {
    return () => {
      proofPreviews.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [proofPreviews]);

  useEffect(() => {
    const saved = localStorage.getItem(DRAFT_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as SubmissionDraft;
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
      } catch {
        localStorage.removeItem(DRAFT_KEY);
      }
    }
  }, []);

  useEffect(() => {
    const draft: SubmissionDraft = {
      species,
      recordType,
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
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  }, [
    species,
    recordType,
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

  const records = (rankingData?.records || []).filter(
    (record) => record.recordType === "size"
  );
  const mySubmissions = submissionData?.submissions || [];
  const popularSpecies = popularSpeciesData?.species || [];
  const searchedSpecies = searchedSpeciesData?.species || [];

  const speciesSuggestions = useMemo(() => {
    const seen = new Set<string>();
    const merged = [...searchedSpecies, ...popularSpecies];
    return merged.filter((item) => {
      if (seen.has(item.name)) return false;
      seen.add(item.name);
      return true;
    });
  }, [popularSpecies, searchedSpecies]);

  const speciesSearchResults = useMemo(() => {
    if (!species.trim()) return [];
    return searchedSpecies.slice(0, 8);
  }, [searchedSpecies, species]);

  const activeTopRecord = useMemo(() => {
    return (
      records
        .filter((record) => record.species === species && record.recordType === recordType)
        .sort((a, b) => b.value - a.value)[0] || null
    );
  }, [records, species, recordType]);

  const pendingSameType = useMemo(
    () =>
      mySubmissions.find(
        (item) =>
          item.status === "pending" &&
          item.species.trim().toLowerCase() === species.trim().toLowerCase() &&
          item.recordType === recordType
      ),
    [mySubmissions, recordType, species]
  );

  const hasValidContact = Boolean(
    (contactPhone.trim() && PHONE_REGEX.test(contactPhone.trim())) ||
      (contactEmail.trim() && EMAIL_REGEX.test(contactEmail.trim()))
  );
  const isChecklistDone =
    checklistPhotoClear && checklistToolVisible && checklistRealInfo;
  const isValueValid = Boolean(value && Number(value) > 0);
  const isFormReady =
    Boolean(species.trim()) &&
    isValueValid &&
    existingProofPhotos.length + proofFiles.length > 0 &&
    hasValidContact &&
    isChecklistDone &&
    consentToContact;

  const uploadProofPhotos = async () => {
    const ids = await Promise.all(
      proofFiles.map(async (file) => {
        const uploadUrlResponse = await fetch("/api/files");
        const { uploadURL } = await uploadUrlResponse.json();
        const form = new FormData();
        form.append("file", file, file.name);
        const uploadResponse = await fetch(uploadURL, { method: "POST", body: form });
        const uploaded = await uploadResponse.json();
        return uploaded?.result?.id as string;
      })
    );

    const filtered = ids.filter(Boolean);
    return filtered;
  };

  const handleSpeciesInputChange = (value: string) => {
    if (isSpeciesComposing) {
      setSpecies(value);
      return;
    }
    setSpecies(sanitizeSpeciesInput(value));
  };

  const startResubmit = (submission: GuinnessSubmission) => {
    setEditingSubmissionId(submission.id);
    setSpecies(sanitizeSpeciesInput(submission.species));
    setValue(String(submission.value));
    setMeasurementDate(
      submission.measurementDate
        ? new Date(submission.measurementDate).toISOString().slice(0, 10)
        : ""
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

  const resetForm = () => {
    setEditingSubmissionId(null);
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
    localStorage.removeItem(DRAFT_KEY);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (submitting) return;

    const normalizedSpecies = species.trim();
    if (!normalizedSpecies) {
      toast.error("종명을 입력해주세요.");
      return;
    }
    if (!SPECIES_NAME_REGEX.test(normalizedSpecies)) {
      toast.error("종명은 한글만 2~30자로 입력해주세요.");
      return;
    }
    if (!isValueValid) {
      toast.error("측정값을 올바르게 입력해주세요.");
      return;
    }
    if (existingProofPhotos.length + proofFiles.length === 0) {
      toast.error("증빙 사진을 최소 1장 첨부해주세요.");
      return;
    }
    if (!hasValidContact) {
      toast.error("전화번호 또는 이메일 형식을 확인해주세요.");
      return;
    }
    if (!isChecklistDone) {
      toast.error("신청 전 체크리스트를 모두 확인해주세요.");
      return;
    }
    if (!consentToContact) {
      toast.error("심사 연락 및 개인정보 처리 동의가 필요합니다.");
      return;
    }
    if (pendingSameType) {
      toast.error("해당 항목은 심사 진행 중입니다. 결과 확인 후 다시 신청해주세요.");
      return;
    }

    try {
      setSubmitting(true);
      const uploadedProofPhotos = await uploadProofPhotos();
      const finalProofPhotos = [...existingProofPhotos, ...uploadedProofPhotos].slice(
        0,
        3
      );
      if (!finalProofPhotos.length) {
        throw new Error("증빙 사진 업로드에 실패했습니다.");
      }

      const res = await fetch("/api/guinness/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: editingSubmissionId ? "resubmit" : "submit",
          id: editingSubmissionId || undefined,
          species: normalizedSpecies,
          recordType,
          value: Number(value),
          measurementDate,
          description: description.trim(),
          contactPhone: contactPhone.trim(),
          contactEmail: contactEmail.trim(),
          consentToContact,
          proofPhotos: finalProofPhotos,
        }),
      });

      const result = await res.json();
      if (!result.success) {
        throw new Error(result.error || "신청 등록에 실패했습니다.");
      }

      toast.success(
        editingSubmissionId
          ? "수정 재신청이 접수되었습니다."
          : "기록 신청이 접수되었습니다. 심사 후 반영됩니다."
      );
      resetForm();
      mutate();
    } catch (error: any) {
      toast.error(error?.message || "신청 처리 중 오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Layout canGoBack title="브리디북 등록" seoTitle="브리디북 등록" showHome>
      <div className="app-page pb-10">
        <section className="px-4 pt-5">
          <div className="app-card border-transparent bg-gradient-to-r from-amber-500 to-orange-500 p-5 text-white">
            <p className="text-xs font-semibold text-white/80">Bredy Records</p>
            <h1 className="mt-1 text-2xl font-bold">브리디북 체장 등록</h1>
            <p className="mt-2 text-sm text-white/90 leading-relaxed">
              증빙 자료와 연락처를 제출하면 어드민 심사를 거쳐 공식 기록으로 등록됩니다.
            </p>
            <Link
              href="/guinness"
              className="mt-4 inline-flex h-9 items-center rounded-lg bg-white/95 px-3 text-xs font-semibold text-amber-700"
            >
              브리디북 보기
            </Link>
          </div>
        </section>

        <section className="px-4 pt-8">
          <div className="app-card p-4">
            <div className="mb-4">
              <div className="flex items-center justify-between gap-3">
                <h2 className="app-section-title">
                  {editingSubmissionId ? "반려 건 수정 재신청" : "기록 신청하기"}
                </h2>
                {editingSubmissionId && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={resetForm}
                  >
                    수정 취소
                  </Button>
                )}
              </div>
              <p className="mt-1 text-xs text-slate-500">
                신청 후 최대 {SLA_HOURS}시간 내 심사를 목표로 하며, 승인 시 브리디북에 반영됩니다.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_140px]">
                <div className="space-y-2">
                  <Input
                    list="guinness-species-list"
                    value={species}
                    onChange={(event) =>
                      handleSpeciesInputChange(event.target.value)
                    }
                    onCompositionStart={() => setIsSpeciesComposing(true)}
                    onCompositionEnd={(event) => {
                      setIsSpeciesComposing(false);
                      setSpecies(sanitizeSpeciesInput(event.currentTarget.value));
                    }}
                    onBlur={(event) =>
                      setSpecies(sanitizeSpeciesInput(event.currentTarget.value))
                    }
                    placeholder="종명을 검색하거나 직접 입력하세요"
                  />
                  <datalist id="guinness-species-list">
                    {speciesSuggestions.map((item) => (
                      <option key={item.id} value={item.name} />
                    ))}
                  </datalist>
                  <p className="text-[11px] leading-relaxed text-slate-500">
                    한글만 입력할 수 있습니다. 검색 결과가 없으면 후보 종으로 접수되며,
                    어드민 승인 후 공식 분류에 반영됩니다.
                  </p>
                  {species.trim() && (
                    <div className="rounded-md border border-slate-200 bg-slate-50 px-2 py-2">
                      <p className="px-1 text-[11px] font-semibold text-slate-500">
                        검색 결과
                      </p>
                      {speciesSearchResults.length > 0 ? (
                        <div className="mt-1 flex flex-wrap gap-1.5">
                          {speciesSearchResults.map((item) => (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => setSpecies(item.name)}
                              className={`rounded-full border px-2.5 py-1 text-xs ${
                                species === item.name
                                  ? "border-slate-900 bg-slate-900 text-white"
                                  : "border-slate-200 bg-white text-slate-600"
                              }`}
                            >
                              {item.name}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-1 px-1 text-xs text-slate-500">
                          검색된 공식 종이 없습니다. 그대로 신청하면 후보 종으로 등록됩니다.
                        </p>
                      )}
                    </div>
                  )}
                  {popularSpecies.length > 0 && (
                    <div className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-1">
                      {popularSpecies.slice(0, 8).map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setSpecies(item.name)}
                          className={`shrink-0 rounded-full border px-2.5 py-1 text-xs transition-colors ${
                            species === item.name
                              ? "border-slate-900 bg-slate-900 text-white"
                              : "border-slate-200 bg-white text-slate-600"
                          }`}
                        >
                          {item.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex h-10 items-center rounded-md border border-gray-200 px-3 text-sm text-slate-700">
                  체장 (mm)
                </div>
              </div>

              <div className="rounded-md border border-amber-100 bg-amber-50 px-3 py-2">
                <p className="text-xs text-amber-800">
                  {species.trim() ? (
                    <>
                      현재 {species} 체장 공식 최고 기록:
                      {" "}
                      <span className="font-semibold">
                        {activeTopRecord
                          ? `${activeTopRecord.value}mm (${activeTopRecord.user.name})`
                          : "없음"}
                      </span>
                    </>
                  ) : (
                    <>종명을 입력하면 현재 공식 최고 기록을 보여드립니다.</>
                  )}
                </p>
              </div>

              <Input
                type="number"
                min={0}
                step="0.01"
                value={value}
                onChange={(event) => setValue(event.target.value)}
                placeholder="체장 입력 (예: 84.5)"
              />

              <Input
                type="date"
                value={measurementDate}
                onChange={(event) => setMeasurementDate(event.target.value)}
                max={new Date().toISOString().slice(0, 10)}
              />

              <div className="grid grid-cols-1 gap-2">
                <Input
                  value={contactPhone}
                  onChange={(event) => setContactPhone(event.target.value)}
                  placeholder="전화번호 (예: 010-1234-5678)"
                />
                <Input
                  value={contactEmail}
                  onChange={(event) => setContactEmail(event.target.value)}
                  placeholder="이메일 (예: bredy@example.com)"
                />
                <p className="text-[11px] text-slate-400">
                  전화번호/이메일 중 1개 이상 필수, 형식 오류 시 신청이 제한됩니다.
                </p>
              </div>

              <Textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={4}
                placeholder="측정 환경, 측정 도구, 개체 특이사항 등 심사에 필요한 내용을 입력해주세요."
              />

              <div className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-3">
                <p className="text-xs font-semibold text-slate-700">증빙 사진 첨부</p>
                <p className="mt-1 text-[11px] text-slate-500">
                  원본 사진 최대 3장. 측정 수치와 개체가 식별되게 촬영해주세요.
                </p>
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={(event) => {
                    const incoming = Array.from(event.target.files || []);
                    if (!incoming.length) return;
                    const remain = Math.max(
                      0,
                      3 - (existingProofPhotos.length + proofFiles.length)
                    );
                    if (remain <= 0) {
                      toast.info("증빙 사진은 최대 3장까지 등록할 수 있습니다.");
                      return;
                    }
                    const combined = [...proofFiles, ...incoming.slice(0, remain)];
                    setProofFiles(combined);
                    event.currentTarget.value = "";
                  }}
                  className="mt-2 block w-full text-xs text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-white file:px-2 file:py-1 file:text-xs file:font-medium file:text-slate-700"
                />
                {(existingProofPhotos.length > 0 || proofPreviews.length > 0) && (
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    {existingProofPhotos.map((photoId, index) => (
                      <div
                        key={`existing-${photoId}-${index}`}
                        className="relative aspect-square overflow-hidden rounded-md bg-white border border-slate-200"
                      >
                        <Image
                          src={makeImageUrl(photoId, "public")}
                          alt=""
                          width={160}
                          height={160}
                          className="h-full w-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setExistingProofPhotos((prev) =>
                              prev.filter((_, i) => i !== index)
                            )
                          }
                          className="absolute right-1 top-1 rounded-full bg-black/60 px-1.5 py-0.5 text-[10px] text-white"
                        >
                          삭제
                        </button>
                      </div>
                    ))}
                    {proofPreviews.map((preview, index) => (
                      <div
                        key={`${preview}-${index}`}
                        className="relative aspect-square overflow-hidden rounded-md bg-white border border-slate-200"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={preview}
                          alt={`proof-${index}`}
                          className="w-full h-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setProofFiles((prev) => prev.filter((_, i) => i !== index))
                          }
                          className="absolute right-1 top-1 rounded-full bg-black/60 px-1.5 py-0.5 text-[10px] text-white"
                        >
                          삭제
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-lg border border-slate-100 bg-white px-3 py-3">
                <p className="text-xs font-semibold text-slate-700">신청 전 체크리스트</p>
                <label className="mt-2 flex items-start gap-2 text-xs text-slate-600">
                  <input
                    type="checkbox"
                    checked={checklistPhotoClear}
                    onChange={(event) => setChecklistPhotoClear(event.target.checked)}
                  />
                  사진에서 개체와 측정 수치가 명확히 보입니다.
                </label>
                <label className="mt-1.5 flex items-start gap-2 text-xs text-slate-600">
                  <input
                    type="checkbox"
                    checked={checklistToolVisible}
                    onChange={(event) => setChecklistToolVisible(event.target.checked)}
                  />
                  측정 도구(자/저울)가 식별 가능하게 촬영했습니다.
                </label>
                <label className="mt-1.5 flex items-start gap-2 text-xs text-slate-600">
                  <input
                    type="checkbox"
                    checked={checklistRealInfo}
                    onChange={(event) => setChecklistRealInfo(event.target.checked)}
                  />
                  허위/도용 자료 제출 시 제재될 수 있음을 확인했습니다.
                </label>
              </div>

              <label className="flex items-start gap-2 text-xs text-slate-600">
                <input
                  type="checkbox"
                  checked={consentToContact}
                  onChange={(event) => setConsentToContact(event.target.checked)}
                />
                심사 안내를 위한 연락 및 개인정보 처리에 동의합니다.
              </label>

              <Button type="submit" disabled={!isFormReady || submitting} className="w-full">
                {submitting ? "신청 접수 중..." : "브리디북 심사 신청"}
              </Button>
            </form>
          </div>
        </section>

        <section className="px-4 pt-8">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="app-section-title">내 신청 현황</h2>
            <span className="text-xs text-slate-400">{mySubmissions.length}건</span>
          </div>
          <div className="space-y-2">
            {mySubmissions.length > 0 ? (
              mySubmissions.map((submission) => (
                <div
                  key={submission.id}
                  className="app-card p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {submission.species} · 체장 {submission.value}mm
                      </p>
                      <p className="mt-1 text-xs text-slate-400">
                        신청일 {new Date(submission.submittedAt).toLocaleString()}
                      </p>
                      {submission.measurementDate && (
                        <p className="mt-1 text-xs text-slate-400">
                          측정일 {new Date(submission.measurementDate).toLocaleDateString()}
                        </p>
                      )}
                      {submission.status === "pending" && (
                        <p className="mt-1 text-xs text-amber-700">
                          {getSlaText(submission.slaDueAt)}
                        </p>
                      )}
                    </div>
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_CLASS[submission.status]}`}
                    >
                      {STATUS_TEXT[submission.status]}
                    </span>
                  </div>
                  {submission.reviewMemo && (
                    <p className="mt-2 rounded-md bg-slate-50 px-2 py-1.5 text-xs text-slate-600">
                      심사 메모: {submission.reviewMemo}
                    </p>
                  )}
                  {submission.reviewReasonCode && (
                    <p className="mt-1 text-xs text-slate-500">
                      반려 사유:{" "}
                      {REVIEW_REASON_LABELS[submission.reviewReasonCode] || "기타"}
                    </p>
                  )}
                  {submission.status === "rejected" && (
                    <div className="mt-3 flex justify-end">
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => startResubmit(submission)}
                      >
                        수정 후 재신청
                      </Button>
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="app-card border-dashed px-4 py-8 text-center">
                <p className="text-sm text-slate-500">아직 신청한 내역이 없습니다.</p>
              </div>
            )}
          </div>
        </section>
      </div>
    </Layout>
  );
}
