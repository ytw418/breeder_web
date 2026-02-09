"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { Button } from "@components/ui/button";
import { Input } from "@components/ui/input";
import Layout from "@components/features/MainLayout";
import useMutation from "hooks/useMutation";
import { Product } from "@prisma/client";
import Image from "@components/atoms/Image";
import { toast } from "react-toastify";
import { Label } from "@components/ui/label";
import { cn } from "@libs/client/utils";
import { CATEGORIES, PRODUCT_TYPES } from "@libs/constants";
import MarkdownEditor from "@components/features/product/MarkdownEditor";

interface UploadProductForm {
  name: string;
  price: number;
  description: string;
}

interface UploadProductMutation {
  success: boolean;
  product: Product;
  error?: string;
  message?: string;
}

type SubmitStep = "idle" | "images" | "submit";
const MAX_IMAGE_COUNT = 5;
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/jpg"];

const LoadingSpinner = ({ step }: { step: SubmitStep }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm">
    <div className="flex min-w-[280px] flex-col items-center space-y-3 rounded-xl bg-white p-6 shadow-xl">
      <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      <p className="text-base font-semibold text-slate-900">
        {step === "images" ? "이미지를 업로드하고 있어요" : "상품을 등록하고 있어요"}
      </p>
      <p className="text-sm text-slate-500">화면을 닫지 말고 잠시만 기다려주세요.</p>
    </div>
  </div>
);

const UploadClient = () => {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors },
  } = useForm<UploadProductForm>({
    mode: "onChange",
    defaultValues: { description: "", price: 0 },
  });
  const [uploadProduct, { loading }] =
    useMutation<UploadProductMutation>("/api/products");
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [submitStep, setSubmitStep] = useState<SubmitStep>("idle");
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [selectedProductType, setSelectedProductType] = useState<string>("");
  const [categoryError, setCategoryError] = useState<string>("");
  const [productTypeError, setProductTypeError] = useState<string>("");

  const watchedName = watch("name", "");
  const watchedDescription = watch("description", "");
  const watchedPrice = watch("price");

  const previews = useMemo(
    () => imageFiles.map((file) => ({ file, url: URL.createObjectURL(file) })),
    [imageFiles]
  );

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const incoming = Array.from(files);
    const invalidType = incoming.find((file) => !ALLOWED_IMAGE_TYPES.includes(file.type));
    if (invalidType) {
      toast.error("JPG, PNG, WEBP 형식만 업로드할 수 있습니다.");
      e.target.value = "";
      return;
    }

    const invalidSize = incoming.find((file) => file.size > MAX_IMAGE_SIZE);
    if (invalidSize) {
      toast.error("이미지 1장당 최대 10MB까지 업로드할 수 있습니다.");
      e.target.value = "";
      return;
    }

    const merged = [...imageFiles, ...incoming];
    if (merged.length > MAX_IMAGE_COUNT) {
      toast.info(`이미지는 최대 ${MAX_IMAGE_COUNT}장까지 등록할 수 있습니다.`);
    }
    setImageFiles(merged.slice(0, MAX_IMAGE_COUNT));
    e.target.value = "";
  };

  const removeImage = (index: number) => {
    const newFiles = [...imageFiles];
    newFiles.splice(index, 1);
    setImageFiles(newFiles);
  };

  const uploadSingleImage = async (file: File, name: string) => {
    const fileApiResponse = await fetch("/api/files");
    const fileApiResult = await fileApiResponse.json();
    if (!fileApiResponse.ok || !fileApiResult?.uploadURL) {
      throw new Error("이미지 업로드 URL 발급에 실패했습니다.");
    }

    const formData = new FormData();
    formData.append("file", file, name);
    const uploadResponse = await fetch(fileApiResult.uploadURL, {
      method: "POST",
      body: formData,
    });
    const uploadResult = await uploadResponse.json();
    const imageId = uploadResult?.result?.id || fileApiResult?.id;
    if (!uploadResponse.ok || !imageId) {
      throw new Error("이미지 업로드에 실패했습니다.");
    }
    return imageId as string;
  };

  const onSubmit = async (formData: UploadProductForm) => {
    if (!selectedCategory) {
      setCategoryError("카테고리를 선택해주세요.");
      toast.error("카테고리를 선택해주세요.");
      return;
    }
    if (!selectedProductType) {
      setProductTypeError("상품 타입을 선택해주세요.");
      toast.error("상품 타입을 선택해주세요.");
      return;
    }

    try {
      setIsUploading(true);
      setSubmitStep("images");
      let photoIds: string[] = [];

      if (imageFiles.length > 0) {
        photoIds = await Promise.all(
          imageFiles.map((file) => uploadSingleImage(file, formData.name))
        );
      }

      setSubmitStep("submit");
      const result = await uploadProduct({
        data: {
          name: formData.name.trim(),
          price: formData.price,
          description: formData.description.trim(),
          photos: photoIds,
          category: selectedCategory,
          productType: selectedProductType,
        },
      });

      if (result.success && result.product?.id) {
        toast.success("상품이 등록되었습니다.");
        router.push(`/products/${result.product.id}`);
        return;
      }

      toast.error(result.error || result.message || "상품 등록에 실패했습니다.");
    } catch (error) {
      console.error("상품 등록 중 오류가 발생했습니다:", error);
      toast.error(
        error instanceof Error
          ? error.message
          : "상품 등록에 실패했습니다. 다시 시도해주세요."
      );
    } finally {
      setIsUploading(false);
      setSubmitStep("idle");
    }
  };

  useEffect(() => {
    if (selectedCategory) setCategoryError("");
  }, [selectedCategory]);

  useEffect(() => {
    if (selectedProductType) setProductTypeError("");
  }, [selectedProductType]);

  useEffect(() => {
    return () => {
      previews.forEach((preview) => URL.revokeObjectURL(preview.url));
    };
  }, [previews]);

  const isSubmitDisabled =
    isUploading ||
    loading ||
    !watchedName?.trim() ||
    !watchedDescription?.trim() ||
    !selectedCategory ||
    !selectedProductType ||
    !watchedPrice ||
    watchedPrice < 100;

  return (
    <Layout canGoBack title="상품 등록">
      {isUploading && <LoadingSpinner step={submitStep} />}
      <form
        onSubmit={handleSubmit(onSubmit, () => {
          toast.error("입력값을 확인해주세요.");
        })}
        className="mx-auto max-w-xl space-y-5 px-4 pb-28 pt-5"
      >
        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-900">상품 이미지</p>
            <span className="text-xs text-slate-500">{imageFiles.length}/{MAX_IMAGE_COUNT}</span>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-1">
            {previews.map((preview, index) => (
              <div key={`${preview.file.name}-${index}`} className="relative flex-shrink-0">
                <div className="w-24 h-24 rounded-xl overflow-hidden">
                  <Image
                    width={96}
                    height={96}
                    src={preview.url}
                    alt={`업로드이미지 ${index + 1}`}
                    className="w-full h-full object-cover"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removeImage(index)}
                  className="absolute -top-1 -right-1 bg-white rounded-full p-1 shadow-md hover:bg-gray-100"
                >
                  <svg
                    className="w-4 h-4 text-gray-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            ))}
            {imageFiles.length < MAX_IMAGE_COUNT && (
              <label className="w-24 h-24 cursor-pointer text-gray-600 hover:border-primary hover:text-primary flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-300 flex-shrink-0 transition-colors">
                <svg
                  className="h-8 w-8"
                  stroke="currentColor"
                  fill="none"
                  viewBox="0 0 48 48"
                  aria-hidden="true"
                >
                  <path
                    d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <span className="text-sm mt-2">사진 추가</span>
                <input
                  type="file"
                  className="hidden"
                  accept="image/png,image/jpeg,image/jpg,image/webp"
                  multiple
                  onChange={handleImageChange}
                />
              </label>
            )}
          </div>
          <p className="mt-2 text-xs text-slate-500">
            JPG, PNG, WEBP 형식 / 최대 10MB / 최대 {MAX_IMAGE_COUNT}장
          </p>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-4 space-y-4">
          <div className="space-y-2">
            <Label>카테고리</Label>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCategory(cat.id)}
                  className={cn(
                    "rounded-md border px-3 py-1.5 text-sm font-medium transition-colors",
                    selectedCategory === cat.id
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  )}
                >
                  {cat.name}
                </button>
              ))}
            </div>
            {categoryError ? <p className="text-xs text-red-500">{categoryError}</p> : null}
          </div>

          <div className="space-y-2">
            <Label>상품 타입</Label>
            <div className="flex gap-2">
              {PRODUCT_TYPES.map((type) => (
                <button
                  key={type.id}
                  type="button"
                  onClick={() => setSelectedProductType(type.id)}
                  className={cn(
                    "rounded-md border px-4 py-1.5 text-sm font-medium transition-colors",
                    selectedProductType === type.id
                      ? "border-slate-900 bg-slate-900 text-white"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  )}
                >
                  {type.name}
                </button>
              ))}
            </div>
            {productTypeError ? <p className="text-xs text-red-500">{productTypeError}</p> : null}
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-4 space-y-5">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="name">상품명</Label>
              <span className="text-xs text-slate-400">{watchedName.length}/60</span>
            </div>
            <Input
              id="name"
              {...register("name", {
                required: "상품명을 입력해주세요.",
                minLength: { value: 2, message: "상품명은 2자 이상 입력해주세요." },
                maxLength: { value: 60, message: "상품명은 60자 이하로 입력해주세요." },
              })}
              placeholder="예: 그란디스 사슴벌레 유충"
              className="focus:border-transparent"
            />
            {errors.name ? <p className="text-xs text-red-500">{errors.name.message}</p> : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="price">가격</Label>
            <Input
              id="price"
              type="number"
              inputMode="numeric"
              {...register("price", {
                required: "가격을 입력해주세요.",
                valueAsNumber: true,
                validate: {
                  valid: (value) =>
                    Number.isFinite(value) || "가격을 숫자로 입력해주세요.",
                  min: (value) => value >= 100 || "가격은 100원 이상 입력해주세요.",
                  max: (value) => value <= 1000000000 || "가격이 너무 큽니다.",
                },
              })}
              placeholder="가격을 입력해주세요 (숫자만)"
              className="focus:border-transparent"
            />
            {errors.price ? <p className="text-xs text-red-500">{errors.price.message}</p> : null}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="description">상품 설명</Label>
              <span className="text-xs text-slate-400">{watchedDescription.length}/3000</span>
            </div>
            <Controller
              name="description"
              control={control}
              rules={{
                required: "상품 설명을 입력해주세요.",
                minLength: { value: 10, message: "설명을 10자 이상 입력해주세요." },
                maxLength: { value: 3000, message: "설명은 3000자 이하로 입력해주세요." },
              }}
              render={({ field }) => (
                <MarkdownEditor
                  id="description"
                  value={field.value || ""}
                  onChange={field.onChange}
                  placeholder="사육 정보, 상태, 거래 방식 등 구매자가 궁금할 내용을 구체적으로 작성해주세요."
                  rows={9}
                />
              )}
            />
            {errors.description && (
              <p className="text-xs text-red-500">{errors.description.message}</p>
            )}
          </div>
        </section>

        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200/80 bg-white/92 backdrop-blur">
          <div className="mx-auto max-w-xl px-4 pb-[calc(10px+env(safe-area-inset-bottom))] pt-3">
            <Button
              type="submit"
              className="w-full"
              disabled={isSubmitDisabled}
              loading={isUploading}
            >
              상품 등록하기
            </Button>
            <p className="mt-2 text-center text-[11px] text-slate-400">
              등록 전 상품명, 가격, 설명, 카테고리를 다시 확인해주세요.
            </p>
          </div>
        </div>
      </form>
    </Layout>
  );
};

export default UploadClient;
