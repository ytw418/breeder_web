"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "@components/atoms/Image";
import Layout from "@components/features/MainLayout";
import { Button } from "@components/ui/button";
import { Input } from "@components/ui/input";
import { Textarea } from "@components/ui/textarea";
import useMutation from "hooks/useMutation";
import useUser from "hooks/useUser";
import { cn, makeImageUrl } from "@libs/client/utils";
import { toast } from "react-toastify";
import {
  AUCTION_EXTENSION_MS,
  AUCTION_EXTENSION_WINDOW_MS,
  AUCTION_MIN_START_PRICE,
  getBidIncrement,
} from "@libs/auctionRules";
import { getAuctionErrorMessage } from "@libs/client/auctionErrorMessage";
import { CreateAuctionResponse } from "pages/api/auctions";

interface AuctionForm {
  title: string;
  description: string;
  category: string;
  startPrice: number;
  endAt: string;
  sellerPhone: string;
  sellerEmail: string;
  sellerBlogUrl: string;
  sellerCafeNick: string;
  sellerBandNick: string;
  sellerTrustNote: string;
}

interface AuctionCreatePayload extends AuctionForm {
  title: string;
  description: string;
  category: string;
  photos: string[];
  sellerProofImage: string | null;
  startPrice: number;
}

interface PendingCreateSubmission {
  requestData: AuctionCreatePayload;
  signature: string;
}

/** 경매 카테고리 목록 */
const AUCTION_CATEGORIES = [
  "곤충",
  "파충류",
  "어류",
  "조류",
  "포유류",
  "기타",
];

/** 경매 기간 프리셋 */
const DURATION_PRESETS = [
  { label: "1시간", hours: 1 },
  { label: "3시간", hours: 3 },
  { label: "24시간", hours: 24 },
  { label: "48시간", hours: 48 },
  { label: "72시간", hours: 72 },
];

const normalizeSignatureText = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";

const toDateTimeLocalInputValue = (date: Date) => {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 16);
};

const getPresetEndAtValue = (hours: number) => {
  const base = new Date();
  // datetime-local은 분 단위로 저장되므로 올림 처리해 1시간 프리셋 경계 오류를 방지한다.
  if (base.getSeconds() > 0 || base.getMilliseconds() > 0) {
    base.setMinutes(base.getMinutes() + 1);
  }
  base.setSeconds(0, 0);
  const endDate = new Date(base.getTime() + hours * 60 * 60 * 1000);
  return toDateTimeLocalInputValue(endDate);
};

const formatConfirmDateTime = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const buildSubmissionSignature = (requestData: AuctionCreatePayload) =>
  JSON.stringify({
    title: normalizeSignatureText(requestData.title),
    description: normalizeSignatureText(requestData.description),
    category: normalizeSignatureText(requestData.category),
    startPrice: Number(requestData.startPrice),
    endAt: normalizeSignatureText(requestData.endAt),
    photos: requestData.photos.map((photo) => normalizeSignatureText(photo)),
    sellerPhone: normalizeSignatureText(requestData.sellerPhone),
    sellerEmail: normalizeSignatureText(requestData.sellerEmail),
    sellerBlogUrl: normalizeSignatureText(requestData.sellerBlogUrl),
    sellerCafeNick: normalizeSignatureText(requestData.sellerCafeNick),
    sellerBandNick: normalizeSignatureText(requestData.sellerBandNick),
    sellerTrustNote: normalizeSignatureText(requestData.sellerTrustNote),
    sellerProofImage: normalizeSignatureText(requestData.sellerProofImage),
  });

const CreateAuctionClient = () => {
  const router = useRouter();
  const { user, isLoading: isUserLoading } = useUser();
  const [photos, setPhotos] = useState<string[]>([]);
  const [sellerProofImage, setSellerProofImage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [proofUploading, setProofUploading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedDuration, setSelectedDuration] = useState<number | null>(null);
  const [agreedAuctionNotice, setAgreedAuctionNotice] = useState(false);
  const [agreedDisputePolicy, setAgreedDisputePolicy] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [createdAuctionId, setCreatedAuctionId] = useState<number | null>(null);
  const [lastCreatedSignature, setLastCreatedSignature] = useState<string | null>(null);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [pendingSubmission, setPendingSubmission] =
    useState<PendingCreateSubmission | null>(null);

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<AuctionForm>();

  const [createAuction, { loading }] = useMutation<CreateAuctionResponse>("/api/auctions");
  const watchedStartPrice = Number(watch("startPrice") || 0);
  const watchedEndAt = watch("endAt");
  const currentBidIncrement = getBidIncrement(watchedStartPrice);
  const extensionMinutes = Math.floor(AUCTION_EXTENSION_MS / (60 * 1000));
  const extensionWindowMinutes = Math.floor(
    AUCTION_EXTENSION_WINDOW_MS / (60 * 1000)
  );

  if (isUserLoading) {
    return (
      <Layout canGoBack title="경매 생성하기" seoTitle="경매 생성하기">
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700" />
        </div>
      </Layout>
    );
  }

  if (!user) {
    return (
      <Layout canGoBack title="경매 생성하기" seoTitle="경매 생성하기">
        <div className="relative min-h-[68vh] px-4 pt-6">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-900">경매 등록 안내</p>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
              경매 등록은 카카오 로그인 사용자만 가능합니다.
              로그인 후 바로 등록 화면으로 이동합니다.
            </p>
          </div>
        </div>
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/45" />
          <div className="relative w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
            <h2 className="text-lg font-bold text-slate-900">로그인이 필요합니다</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              경매 등록은 카카오 계정으로만 진행할 수 있습니다.
              지금 로그인하면 경매 등록 화면으로 바로 이동합니다.
            </p>
            <div className="mt-4 grid gap-2">
              <Link
                href="/auth/login?next=%2Fauctions%2Fcreate"
                className="inline-flex h-11 items-center justify-center rounded-xl bg-[#fee500] text-sm font-bold text-[#191919]"
              >
                카카오 로그인하기
              </Link>
              <button
                type="button"
                onClick={() => router.push("/auctions")}
                className="h-11 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700"
              >
                경매 목록으로 가기
              </button>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  /** 이미지 업로드 */
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    if (photos.length + files.length > 5) {
      toast.error("이미지는 최대 5장까지 등록 가능합니다.");
      return;
    }

    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        // Cloudflare Image upload
        const urlRes = await fetch("/api/files");
        const urlData = await urlRes.json();

        const form = new FormData();
        form.append("file", file);

        const uploadRes = await fetch(urlData.uploadURL, {
          method: "POST",
          body: form,
        });
        const uploadData = await uploadRes.json();

        if (uploadData.success) {
          setPhotos((prev) => [...prev, uploadData.result.id]);
        }
      }
    } catch {
      toast.error("이미지 업로드에 실패했습니다.");
    } finally {
      setUploading(false);
    }
  };

  /** 이미지 제거 */
  const handleRemoveImage = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const handleTrustProofUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setProofUploading(true);
    try {
      const urlRes = await fetch("/api/files");
      const urlData = await urlRes.json();

      const form = new FormData();
      form.append("file", file);

      const uploadRes = await fetch(urlData.uploadURL, {
        method: "POST",
        body: form,
      });
      const uploadData = await uploadRes.json();
      if (uploadData.success) {
        setSellerProofImage(uploadData.result.id);
      } else {
        toast.error("프로필 인증 이미지 업로드에 실패했습니다.");
      }
    } catch {
      toast.error("프로필 인증 이미지 업로드에 실패했습니다.");
    } finally {
      setProofUploading(false);
    }
  };

  /** 기간 프리셋 선택 */
  const handleDurationPreset = (hours: number) => {
    setSelectedDuration(hours);
    setValue("endAt", getPresetEndAtValue(hours), { shouldValidate: true });
  };

  /** 제출 */
  const onSubmit = (data: AuctionForm) => {
    if (loading || confirmModalOpen) return;
    if (!selectedCategory) {
      toast.error("카테고리를 선택해주세요.");
      return;
    }
    if (photos.length === 0) {
      toast.error("최소 1장의 사진을 등록해주세요.");
      return;
    }
    if (!agreedAuctionNotice || !agreedDisputePolicy) {
      toast.error("경매 주의사항 및 분쟁 정책 동의가 필요합니다.");
      return;
    }
    if (selectedDuration === null) {
      toast.error("경매 기간 프리셋(1시간/3시간 등)을 선택해주세요.");
      return;
    }

    const normalizedEndAt = getPresetEndAtValue(selectedDuration);

    const requestData = {
      ...data,
      title: normalizeSignatureText(data.title),
      description: normalizeSignatureText(data.description),
      endAt: normalizedEndAt,
      category: selectedCategory,
      photos,
      sellerProofImage,
      startPrice: Number(data.startPrice),
    };

    const signature = buildSubmissionSignature(requestData);

    if (lastCreatedSignature === signature) {
      toast.error("동일한 내용의 경매는 다시 등록할 수 없습니다. 기존 경매를 공유하거나 수정해주세요.");
      if (createdAuctionId) {
        setShareModalOpen(true);
      }
      return;
    }

    setPendingSubmission({
      requestData,
      signature,
    });
    setConfirmModalOpen(true);
  };

  const handleConfirmCreate = () => {
    if (!pendingSubmission || loading) return;

    const refreshedRequestData = selectedDuration
      ? {
          ...pendingSubmission.requestData,
          endAt: getPresetEndAtValue(selectedDuration),
        }
      : pendingSubmission.requestData;
    const refreshedSignature = buildSubmissionSignature(refreshedRequestData);

    if (lastCreatedSignature === refreshedSignature) {
      toast.error("동일한 내용의 경매는 다시 등록할 수 없습니다. 기존 경매를 공유하거나 수정해주세요.");
      return;
    }

    createAuction({
      data: refreshedRequestData,
      onCompleted(result) {
        if (result.success && result.auction?.id) {
          setLastCreatedSignature(refreshedSignature);
          setCreatedAuctionId(result.auction.id);
          setConfirmModalOpen(false);
          setPendingSubmission(null);
          setShareModalOpen(true);
          toast.success("경매가 등록되었습니다. SNS에 공유해보세요!");
        } else {
          toast.error(getAuctionErrorMessage(result.errorCode, result.error || "등록에 실패했습니다."));
        }
      },
      onError() {
        toast.error("오류가 발생했습니다.");
      },
    });
  };

  const handleCancelConfirm = () => {
    if (loading) return;
    setConfirmModalOpen(false);
  };

  const getCreatedAuctionPath = () =>
    createdAuctionId ? `/auctions/${createdAuctionId}` : "";

  const getCreatedAuctionUrl = () => {
    const path = getCreatedAuctionPath();
    if (!path) return "";
    if (typeof window === "undefined") return path;
    return new URL(path, window.location.origin).toString();
  };

  const copyToClipboard = async (value: string) => {
    if (!value) return;
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return;
    }
    const textarea = document.createElement("textarea");
    textarea.value = value;
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    document.execCommand("copy");
    document.body.removeChild(textarea);
  };

  const handleCopyAuctionLink = async () => {
    try {
      const url = getCreatedAuctionUrl();
      if (!url) {
        toast.error("공유 링크를 생성하지 못했습니다.");
        return;
      }
      await copyToClipboard(url);
      toast.success("경매 링크가 복사되었습니다.");
    } catch {
      toast.error("링크 복사에 실패했습니다.");
    }
  };

  const handleShareAuction = async () => {
    const url = getCreatedAuctionUrl();
    const path = getCreatedAuctionPath();
    if (!url || !path) {
      toast.error("공유 링크를 생성하지 못했습니다.");
      return;
    }
    try {
      if (navigator.share) {
        await navigator.share({
          title: "브리디 경매",
          text: "30초면 만드는 경매 도구, 지금 바로 참여해보세요.",
          url,
        });
        toast.success("공유를 완료했습니다.");
        return;
      }
      await copyToClipboard(url);
      toast.info("이 기기에서는 바로 공유를 지원하지 않아 링크를 복사했습니다.");
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") return;
      toast.error("공유에 실패했습니다.");
    }
  };

  const handleMoveToAuction = () => {
    const path = getCreatedAuctionPath();
    if (!path) return;
    setShareModalOpen(false);
    router.push(path);
  };

  return (
    <Layout canGoBack title="경매 생성하기" seoTitle="경매 생성하기">
      <form onSubmit={handleSubmit(onSubmit)} className="px-4 py-4 space-y-6 pb-28">
        {/* 이미지 업로드 */}
        <div>
          <label className="block text-sm font-semibold text-gray-900 mb-2">
            사진 등록 <span className="text-red-500">*</span>
            <span className="text-xs font-normal text-gray-400 ml-1">({photos.length}/5)</span>
          </label>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {/* 추가 버튼 */}
            {photos.length < 5 && (
              <label className="flex-shrink-0 w-20 h-20 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center cursor-pointer hover:border-primary transition-colors">
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleImageUpload}
                  className="hidden"
                />
                {uploading ? (
                  <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                ) : (
                  <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                )}
              </label>
            )}
            {/* 미리보기 */}
            {photos.map((photo, i) => (
              <div key={photo} className="relative flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden">
                <Image
                  src={makeImageUrl(photo, "avatar")}
                  className="w-full h-full object-cover"
                  width={80}
                  height={80}
                  alt={`사진 ${i + 1}`}
                />
                <button
                  type="button"
                  onClick={() => handleRemoveImage(i)}
                  className="absolute top-1 right-1 w-5 h-5 bg-black/60 rounded-full flex items-center justify-center"
                >
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* 카테고리 */}
        <div>
          <label className="block text-sm font-semibold text-gray-900 mb-2">
            카테고리 <span className="text-red-500">*</span>
          </label>
          <div className="flex flex-wrap gap-2">
            {AUCTION_CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={cn(
                  "px-3 py-1.5 rounded-full text-sm font-medium transition-colors",
                  selectedCategory === cat
                    ? "bg-gray-900 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                )}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* 제목 */}
        <div>
          <label className="block text-sm font-semibold text-gray-900 mb-2">
            제목 <span className="text-red-500">*</span>
          </label>
          <Input
            {...register("title", { required: "제목을 입력해주세요." })}
            placeholder="예: 헤라클레스 DHH 150mm 수컷"
          />
          {errors.title && (
            <p className="text-xs text-red-500 mt-1">{errors.title.message}</p>
          )}
        </div>

        {/* 설명 */}
        <div>
          <label className="block text-sm font-semibold text-gray-900 mb-2">
            상세 설명 <span className="text-red-500">*</span>
          </label>
          <Textarea
            {...register("description", { required: "설명을 입력해주세요." })}
            placeholder="개체 정보, 사육 환경, 특이사항 등을 자세히 적어주세요."
            rows={5}
          />
          {errors.description && (
            <p className="text-xs text-red-500 mt-1">{errors.description.message}</p>
          )}
        </div>

        {/* 시작가 */}
        <div>
          <div className="mb-2 flex items-center justify-between gap-2">
            <label className="block text-sm font-semibold text-gray-900">
              시작가 <span className="text-red-500">*</span>
            </label>
            {watchedStartPrice > 0 ? (
              <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
                {watchedStartPrice.toLocaleString()}원
              </span>
            ) : null}
          </div>
          <div className="relative">
            <Input
              type="number"
              {...register("startPrice", {
                required: "시작가를 입력해주세요.",
                min: {
                  value: AUCTION_MIN_START_PRICE,
                  message: `최소 ${AUCTION_MIN_START_PRICE.toLocaleString()}원 이상`,
                },
              })}
              placeholder="10000"
              className="pr-8"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">원</span>
          </div>
          {errors.startPrice && (
            <p className="text-xs text-red-500 mt-1">{errors.startPrice.message}</p>
          )}
          <p className="text-xs text-gray-500 mt-1">
            자동 입찰 단위: {currentBidIncrement.toLocaleString()}원
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-slate-800">경매 규칙 안내</p>
            <Link
              href="/auctions/rules"
              className="text-xs font-semibold text-slate-600 underline underline-offset-2"
            >
              전체 보기
            </Link>
          </div>
          <ul className="mt-2 space-y-1 text-xs text-slate-600">
            <li>• 입찰 단위는 현재가에 따라 자동 계산됩니다.</li>
            <li>• 마감 {extensionWindowMinutes}분 이내 입찰 시 경매 시간이 {extensionMinutes}분 연장됩니다.</li>
            <li>• 본인 경매에는 입찰할 수 없습니다.</li>
            <li>• 진행중 상태에서 등록 후 10분 이내, 입찰이 없을 때만 수정할 수 있습니다.</li>
            <li>• 동시 진행 경매는 계정당 최대 3개까지 등록 가능합니다.</li>
            <li>• 시작가 50만원 이상 경매는 연락처(전화/이메일) 정보가 필요합니다.</li>
          </ul>
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-900">
            <p className="font-semibold">거래/분쟁 안내</p>
            <p className="mt-1 leading-relaxed">
              본 서비스는 경매 중개 플랫폼이며, 거래 당사자 간 분쟁(허위 매물, 미발송, 환불 등)에 대해 법적 책임을 지지 않습니다.
              다만 문제 발생 시 신고를 접수하여 운영정책에 따라 계정/콘텐츠 조치를 진행합니다.
            </p>
            <p className="mt-1 leading-relaxed font-semibold">
              카카오 로그인 기반 계정은 위반 시 영구 참여 제한됩니다.
            </p>
            <a
              href="mailto:support@bredy.app?subject=[경매%20신고]%20문제%20접수"
              className="mt-1.5 inline-flex items-center font-semibold underline underline-offset-2"
            >
              신고 접수: support@bredy.app
            </a>
          </div>
          <div className="mt-3 space-y-2">
            <label className="flex items-start gap-2 text-xs text-slate-700">
              <input
                type="checkbox"
                checked={agreedAuctionNotice}
                onChange={(event) => setAgreedAuctionNotice(event.target.checked)}
                className="mt-0.5"
              />
              <span>경매 규칙(입찰 단위, 연장, 수정 가능 조건)을 확인했습니다.</span>
            </label>
            <label className="flex items-start gap-2 text-xs text-slate-700">
              <input
                type="checkbox"
                checked={agreedDisputePolicy}
                onChange={(event) => setAgreedDisputePolicy(event.target.checked)}
                className="mt-0.5"
              />
              <span>분쟁 책임 제한 및 신고 접수 정책을 확인했습니다.</span>
            </label>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-3.5">
          <h3 className="text-sm font-semibold text-slate-900">판매자 신뢰 정보 (선택)</h3>
          <p className="mt-1 text-xs text-slate-500">
            카페/밴드/블로그에서 신뢰 확인할 수 있는 정보를 함께 올리면 입찰 전환율이 높아집니다.
          </p>
          <div className="mt-3 grid grid-cols-1 gap-2.5">
            <Input
              {...register("sellerPhone")}
              placeholder="연락처(전화번호)"
            />
            <Input
              {...register("sellerEmail")}
              placeholder="연락 이메일"
            />
            <Input
              {...register("sellerBlogUrl")}
              placeholder="블로그/프로필 URL"
            />
            <Input
              {...register("sellerCafeNick")}
              placeholder="카페 닉네임"
            />
            <Input
              {...register("sellerBandNick")}
              placeholder="밴드 닉네임"
            />
            <Textarea
              {...register("sellerTrustNote")}
              rows={3}
              placeholder="예: OO카페 활동 4년, 최근 3개월 거래 20건 무분쟁"
            />
            <div className="rounded-lg border border-slate-200 p-2.5">
              <p className="text-xs font-medium text-slate-700">커뮤니티 프로필 캡처 (선택)</p>
              <p className="mt-0.5 text-[11px] text-slate-500">
                카페/밴드 프로필 캡처를 올리면 신뢰도 안내에 표시됩니다.
              </p>
              <div className="mt-2 flex items-center gap-2">
                <label className="inline-flex cursor-pointer items-center rounded-md border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-700">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleTrustProofUpload}
                    className="hidden"
                  />
                  {proofUploading ? "업로드 중..." : "이미지 업로드"}
                </label>
                {sellerProofImage ? (
                  <button
                    type="button"
                    onClick={() => setSellerProofImage(null)}
                    className="text-xs text-rose-600 underline underline-offset-2"
                  >
                    삭제
                  </button>
                ) : null}
              </div>
              {sellerProofImage ? (
                <div className="relative mt-2 h-28 w-40 overflow-hidden rounded-md border border-slate-200">
                  <Image
                    src={makeImageUrl(sellerProofImage, "public")}
                    className="object-cover"
                    fill
                    alt="커뮤니티 프로필 캡처"
                  />
                </div>
              ) : null}
            </div>
          </div>
        </div>

        {/* 경매 기간 */}
        <div>
          <label className="block text-sm font-semibold text-gray-900 mb-2">
            경매 기간 <span className="text-red-500">*</span>
          </label>
          <div className="flex flex-wrap gap-2 mb-3">
            {DURATION_PRESETS.map((preset) => (
              <button
                key={preset.hours}
                type="button"
                onClick={() => handleDurationPreset(preset.hours)}
                className={cn(
                  "px-3 py-1.5 rounded-full text-sm font-medium transition-colors",
                  selectedDuration === preset.hours
                    ? "bg-gray-900 text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                )}
              >
                {preset.label}
              </button>
            ))}
          </div>
          <Input
            type="hidden"
            {...register("endAt", { required: "종료 시간을 선택해주세요." })}
          />
          <Input
            type="text"
            value={watchedEndAt ? formatConfirmDateTime(watchedEndAt) : ""}
            placeholder="상단 시간 프리셋을 선택해주세요."
            readOnly
            className="bg-slate-100 text-slate-600"
          />
          {errors.endAt && (
            <p className="text-xs text-red-500 mt-1">{errors.endAt.message}</p>
          )}
          <p className="mt-1 text-[11px] text-slate-500">
            경매 종료 시간은 프리셋 버튼으로만 설정할 수 있습니다.
          </p>
        </div>

        {/* 등록 버튼 */}
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 p-4 z-10">
          <div className="max-w-xl mx-auto">
            <Button
              type="submit"
              disabled={loading || uploading || proofUploading}
              className="w-full h-12 text-base font-semibold rounded-xl"
            >
              {loading ? "등록 중..." : "경매 등록하기"}
            </Button>
          </div>
        </div>
      </form>

      {confirmModalOpen && pendingSubmission ? (
        <div className="fixed inset-0 z-[95] flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/60"
            onClick={handleCancelConfirm}
            aria-label="등록 확인 팝업 닫기"
          />
          <div className="relative w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
            <h2 className="text-lg font-bold text-slate-900">정말 이 내용으로 등록하시겠습니까?</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              등록 후에는 동일 내용 재등록이 제한될 수 있습니다. 가격과 시간을 다시 확인해주세요.
            </p>

            <div className="mt-4 space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500">시작가</span>
                <span className="text-base font-bold text-slate-900">
                  {Number(pendingSubmission.requestData.startPrice).toLocaleString()}원
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500">종료 시간</span>
                <span className="text-sm font-semibold text-slate-800">
                  {formatConfirmDateTime(pendingSubmission.requestData.endAt)}
                </span>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleCancelConfirm}
                disabled={loading}
                className="h-11 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-60"
              >
                다시 확인
              </button>
              <button
                type="button"
                onClick={handleConfirmCreate}
                disabled={loading}
                className="h-11 rounded-xl bg-slate-900 text-sm font-semibold text-white transition-colors hover:bg-slate-800 disabled:opacity-60"
              >
                {loading ? "등록 중..." : "이대로 등록"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {shareModalOpen ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/60"
            onClick={() => setShareModalOpen(false)}
            aria-label="공유 팝업 닫기"
          />
          <div className="relative w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
            <h2 className="text-lg font-bold text-slate-900">생성한 경매를 SNS에 공유해보세요!</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              지금 공유하면 더 빠르게 입찰자를 모을 수 있어요.
            </p>
            <div className="mt-4 grid gap-2">
              <button
                type="button"
                onClick={handleCopyAuctionLink}
                className="h-11 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
              >
                링크 복사하기
              </button>
              <button
                type="button"
                onClick={handleShareAuction}
                className="h-11 rounded-xl bg-slate-900 text-sm font-semibold text-white transition-colors hover:bg-slate-800"
              >
                바로 공유하기
              </button>
              <button
                type="button"
                onClick={handleMoveToAuction}
                className="h-11 rounded-xl bg-[#fee500] text-sm font-bold text-[#191919] transition-colors hover:brightness-95"
              >
                경매 상세로 이동
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </Layout>
  );
};

export default CreateAuctionClient;
