"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useParams, useRouter } from "next/navigation";
import useSWR from "swr";
import Layout from "@components/features/MainLayout";
import Image from "@components/atoms/Image";
import { Button } from "@components/ui/button";
import { Input } from "@components/ui/input";
import { Textarea } from "@components/ui/textarea";
import useMutation from "hooks/useMutation";
import { cn, makeImageUrl } from "@libs/client/utils";
import { toast } from "react-toastify";
import { AuctionDetailResponse } from "pages/api/auctions/[id]";
import { AUCTION_MIN_START_PRICE, getBidIncrement } from "@libs/auctionRules";
import { getAuctionErrorMessage } from "@libs/client/auctionErrorMessage";

interface AuctionEditForm {
  title: string;
  description: string;
  startPrice: number;
  endAt: string;
  sellerPhone: string;
  sellerEmail: string;
  sellerBlogUrl: string;
  sellerCafeNick: string;
  sellerBandNick: string;
  sellerTrustNote: string;
}

interface AuctionUpdateResponse {
  success: boolean;
  error?: string;
  errorCode?: string;
  auction?: { id: number };
}

const AUCTION_CATEGORIES = [
  "곤충",
  "파충류",
  "어류",
  "조류",
  "포유류",
  "기타",
];

const DURATION_PRESETS = [
  { label: "24시간", hours: 24 },
  { label: "48시간", hours: 48 },
  { label: "72시간", hours: 72 },
];

const toDateTimeLocalValue = (value: string | Date) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
};

const EditAuctionClient = () => {
  const params = useParams();
  const router = useRouter();
  const [photos, setPhotos] = useState<string[]>([]);
  const [sellerProofImage, setSellerProofImage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [proofUploading, setProofUploading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedDuration, setSelectedDuration] = useState<number | null>(null);

  const { data } = useSWR<AuctionDetailResponse>(
    params?.id ? `/api/auctions/${params.id}` : null
  );

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<AuctionEditForm>();

  const [updateAuction, { loading }] = useMutation<AuctionUpdateResponse>(
    params?.id ? `/api/auctions/${params.id}` : ""
  );

  useEffect(() => {
    if (!data?.auction) return;
    reset({
      title: data.auction.title,
      description: data.auction.description,
      startPrice: data.auction.startPrice,
      endAt: toDateTimeLocalValue(data.auction.endAt),
      sellerPhone: data.auction.sellerPhone || "",
      sellerEmail: data.auction.sellerEmail || "",
      sellerBlogUrl: data.auction.sellerBlogUrl || "",
      sellerCafeNick: data.auction.sellerCafeNick || "",
      sellerBandNick: data.auction.sellerBandNick || "",
      sellerTrustNote: data.auction.sellerTrustNote || "",
    });
    setSelectedCategory(data.auction.category || "");
    setPhotos(data.auction.photos || []);
    setSellerProofImage(data.auction.sellerProofImage || null);
  }, [data?.auction, reset]);

  const watchedStartPrice = Number(watch("startPrice") || 0);
  const currentBidIncrement = getBidIncrement(watchedStartPrice);
  const editAvailableUntilText = useMemo(() => {
    if (!data?.editAvailableUntil) return "-";
    return new Date(data.editAvailableUntil).toLocaleString();
  }, [data?.editAvailableUntil]);

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

  const handleDurationPreset = (hours: number) => {
    setSelectedDuration(hours);
    const endDate = new Date(Date.now() + hours * 60 * 60 * 1000);
    setValue("endAt", toDateTimeLocalValue(endDate));
  };

  const onSubmit = (form: AuctionEditForm) => {
    if (!selectedCategory) {
      toast.error("카테고리를 선택해주세요.");
      return;
    }
    if (photos.length === 0) {
      toast.error("최소 1장의 사진을 등록해주세요.");
      return;
    }

    updateAuction({
      data: {
        action: "update",
        ...form,
        category: selectedCategory,
        photos,
        sellerProofImage,
        startPrice: Number(form.startPrice),
      },
      onCompleted(result) {
        if (!result.success) {
          return toast.error(
            getAuctionErrorMessage(result.errorCode, result.error || "수정에 실패했습니다.")
          );
        }
        toast.success("경매가 수정되었습니다.");
        router.push(`/auctions/${params?.id}`);
      },
      onError() {
        toast.error("오류가 발생했습니다.");
      },
    });
  };

  if (!data?.auction) {
    return (
      <Layout canGoBack title="경매 수정" seoTitle="경매 수정">
        <div className="flex items-center justify-center h-[60vh]">
          <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
        </div>
      </Layout>
    );
  }

  if (!data.isOwner) {
    return (
      <Layout canGoBack title="경매 수정" seoTitle="경매 수정">
        <div className="px-4 py-10 text-center">
          <p className="text-sm text-slate-600">본인 경매만 수정할 수 있습니다.</p>
        </div>
      </Layout>
    );
  }

  if (!data.canEdit) {
    return (
      <Layout canGoBack title="경매 수정" seoTitle="경매 수정">
        <div className="px-4 py-8">
          <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-2">
            <p className="text-sm font-semibold text-slate-900">수정 가능 시간이 지났습니다</p>
            <p className="text-sm text-slate-600">
              경매 등록 후 1시간 이내, 입찰이 없는 경우에만 수정할 수 있습니다.
            </p>
            <p className="text-xs text-slate-400">수정 가능 마감: {editAvailableUntilText}</p>
            <Button
              type="button"
              className="mt-2"
              onClick={() => router.push(`/auctions/${params?.id}`)}
            >
              상세로 돌아가기
            </Button>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout canGoBack title="경매 수정" seoTitle="경매 수정">
      <form onSubmit={handleSubmit(onSubmit)} className="px-4 py-4 space-y-6 pb-28">
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-3">
          <p className="text-sm font-semibold text-slate-800">수정 가능 조건</p>
          <p className="mt-1 text-xs text-slate-600">
            등록 후 1시간 이내 + 입찰 없음 상태에서만 수정할 수 있습니다.
          </p>
          <p className="mt-1 text-xs text-slate-500">수정 가능 마감: {editAvailableUntilText}</p>
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-900 mb-2">
            사진 등록 <span className="text-red-500">*</span>
            <span className="text-xs font-normal text-gray-400 ml-1">({photos.length}/5)</span>
          </label>
          <div className="flex gap-2 overflow-x-auto pb-2">
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

        <div>
          <label className="block text-sm font-semibold text-gray-900 mb-2">
            시작가 <span className="text-red-500">*</span>
          </label>
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

        <div className="rounded-xl border border-slate-200 bg-white p-3.5">
          <h3 className="text-sm font-semibold text-slate-900">판매자 신뢰 정보 (선택)</h3>
          <div className="mt-3 grid grid-cols-1 gap-2.5">
            <Input {...register("sellerPhone")} placeholder="연락처(전화번호)" />
            <Input {...register("sellerEmail")} placeholder="연락 이메일" />
            <Input {...register("sellerBlogUrl")} placeholder="블로그/프로필 URL" />
            <Input {...register("sellerCafeNick")} placeholder="카페 닉네임" />
            <Input {...register("sellerBandNick")} placeholder="밴드 닉네임" />
            <Textarea
              {...register("sellerTrustNote")}
              rows={3}
              placeholder="예: OO카페 활동 4년, 최근 3개월 거래 20건 무분쟁"
            />

            <div className="rounded-lg border border-slate-200 p-2.5">
              <p className="text-xs font-medium text-slate-700">커뮤니티 프로필 캡처 (선택)</p>
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
                +{preset.label}
              </button>
            ))}
          </div>
          <Input
            type="datetime-local"
            {...register("endAt", { required: "종료 시간을 선택해주세요." })}
          />
          {errors.endAt && (
            <p className="text-xs text-red-500 mt-1">{errors.endAt.message}</p>
          )}
        </div>

        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 p-4 z-10">
          <div className="max-w-xl mx-auto">
            <Button
              type="submit"
              disabled={loading || uploading || proofUploading || isSubmitting}
              className="w-full h-12 text-base font-semibold rounded-xl"
            >
              {loading ? "수정 중..." : "경매 수정 완료"}
            </Button>
          </div>
        </div>
      </form>
    </Layout>
  );
};

export default EditAuctionClient;
