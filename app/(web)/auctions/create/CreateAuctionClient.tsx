"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import Image from "@components/atoms/Image";
import Layout from "@components/features/MainLayout";
import { Button } from "@components/ui/button";
import { Input } from "@components/ui/input";
import { Textarea } from "@components/ui/textarea";
import useMutation from "hooks/useMutation";
import { cn, makeImageUrl } from "@libs/client/utils";
import { toast } from "react-toastify";

interface AuctionForm {
  title: string;
  description: string;
  category: string;
  startPrice: number;
  minBidIncrement: number;
  endAt: string;
}

/** 종 카테고리 목록 */
const SPECIES_CATEGORIES = [
  "장수풍뎅이",
  "사슴벌레",
  "왕사슴벌레",
  "넓적사슴벌레",
  "코카서스장수풍뎅이",
  "헤라클레스장수풍뎅이",
  "기타",
];

/** 경매 기간 프리셋 */
const DURATION_PRESETS = [
  { label: "1시간", hours: 1 },
  { label: "6시간", hours: 6 },
  { label: "12시간", hours: 12 },
  { label: "1일", hours: 24 },
  { label: "3일", hours: 72 },
  { label: "7일", hours: 168 },
];

const CreateAuctionClient = () => {
  const router = useRouter();
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedDuration, setSelectedDuration] = useState<number | null>(null);

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<AuctionForm>({
    defaultValues: {
      minBidIncrement: 1000,
    },
  });

  const [createAuction, { loading }] = useMutation("/api/auctions");

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

  /** 기간 프리셋 선택 */
  const handleDurationPreset = (hours: number) => {
    setSelectedDuration(hours);
    const endDate = new Date(Date.now() + hours * 60 * 60 * 1000);
    const localDate = new Date(endDate.getTime() - endDate.getTimezoneOffset() * 60000);
    setValue("endAt", localDate.toISOString().slice(0, 16));
  };

  /** 제출 */
  const onSubmit = (data: AuctionForm) => {
    if (loading) return;
    if (!selectedCategory) {
      toast.error("종 카테고리를 선택해주세요.");
      return;
    }
    if (photos.length === 0) {
      toast.error("최소 1장의 사진을 등록해주세요.");
      return;
    }

    createAuction({
      data: {
        ...data,
        category: selectedCategory,
        photos,
        startPrice: Number(data.startPrice),
        minBidIncrement: Number(data.minBidIncrement),
      },
      onCompleted(result) {
        if (result.success) {
          toast.success("경매가 등록되었습니다!");
          router.push(`/auctions/${result.auction.id}`);
        } else {
          toast.error(result.error || "등록에 실패했습니다.");
        }
      },
      onError() {
        toast.error("오류가 발생했습니다.");
      },
    });
  };

  return (
    <Layout canGoBack title="경매 등록" seoTitle="경매 등록">
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

        {/* 종 카테고리 */}
        <div>
          <label className="block text-sm font-semibold text-gray-900 mb-2">
            종 카테고리 <span className="text-red-500">*</span>
          </label>
          <div className="flex flex-wrap gap-2">
            {SPECIES_CATEGORIES.map((cat) => (
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
          <label className="block text-sm font-semibold text-gray-900 mb-2">
            시작가 <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <Input
              type="number"
              {...register("startPrice", {
                required: "시작가를 입력해주세요.",
                min: { value: 1000, message: "최소 1,000원 이상" },
              })}
              placeholder="10000"
              className="pr-8"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">원</span>
          </div>
          {errors.startPrice && (
            <p className="text-xs text-red-500 mt-1">{errors.startPrice.message}</p>
          )}
        </div>

        {/* 최소 입찰 단위 */}
        <div>
          <label className="block text-sm font-semibold text-gray-900 mb-2">
            최소 입찰 단위
          </label>
          <div className="relative">
            <Input
              type="number"
              {...register("minBidIncrement")}
              placeholder="1000"
              className="pr-8"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">원</span>
          </div>
          <p className="text-xs text-gray-400 mt-1">기본값: 1,000원</p>
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
            type="datetime-local"
            {...register("endAt", { required: "종료 시간을 선택해주세요." })}
          />
          {errors.endAt && (
            <p className="text-xs text-red-500 mt-1">{errors.endAt.message}</p>
          )}
        </div>

        {/* 등록 버튼 */}
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 p-4 z-10">
          <div className="max-w-xl mx-auto">
            <Button
              type="submit"
              disabled={loading || uploading}
              className="w-full h-12 text-base font-semibold rounded-xl"
            >
              {loading ? "등록 중..." : "경매 등록하기"}
            </Button>
          </div>
        </div>
      </form>
    </Layout>
  );
};

export default CreateAuctionClient;
