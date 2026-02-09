"use client";

import { useEffect, useState } from "react";
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
}

const LoadingSpinner = () => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm">
    <div className="flex flex-col items-center space-y-4 bg-white p-8 rounded-2xl shadow-xl">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      <p className="text-lg font-medium text-gray-900">
        상품을 등록하고 있어요
      </p>
      <p className="text-sm text-gray-500">잠시만 기다려주세요</p>
    </div>
  </div>
);

const UploadClient = () => {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<UploadProductForm>({
    defaultValues: { description: "" },
  });
  const [uploadProduct, { loading, data }] =
    useMutation<UploadProductMutation>("/api/products");
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [selectedProductType, setSelectedProductType] = useState<string>("");

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const newFiles = Array.from(files);
      const totalFiles = [...imageFiles, ...newFiles].slice(0, 5);
      setImageFiles(totalFiles);
      const newPreviews = totalFiles.map((file) => URL.createObjectURL(file));
      setPreviews(newPreviews);
    }
  };

  const removeImage = (index: number) => {
    const newFiles = [...imageFiles];
    const newPreviews = [...previews];
    URL.revokeObjectURL(previews[index]);
    newFiles.splice(index, 1);
    newPreviews.splice(index, 1);
    setImageFiles(newFiles);
    setPreviews(newPreviews);
  };

  const onSubmit = async (data: UploadProductForm) => {
    if (!selectedCategory) {
      toast.error("카테고리를 선택해주세요.");
      return;
    }
    if (!selectedProductType) {
      toast.error("상품 타입을 선택해주세요.");
      return;
    }

    try {
      setIsUploading(true);
      let photoIds: string[] = [];

      if (imageFiles.length > 0) {
        photoIds = await Promise.all(
          imageFiles.map(async (file) => {
            const { uploadURL } = await (await fetch(`/api/files`)).json();
            const form = new FormData();
            form.append("file", file, data.name);
            const {
              result: { id },
            } = await (
              await fetch(uploadURL, { method: "POST", body: form })
            ).json();
            return id;
          })
        );
      }

      await uploadProduct({
        data: {
          name: data.name,
          price: data.price,
          description: data.description,
          photos: photoIds,
          category: selectedCategory,
          productType: selectedProductType,
        },
        onCompleted(result) {
          if (result.success) {
            router.push(`/products/${result.product.id}`);
          }
        },
      });
    } catch (error) {
      console.error("상품 등록 중 오류가 발생했습니다:", error);
      toast.error("상품 등록에 실패했습니다. 다시 시도해주세요.");
    } finally {
      setIsUploading(false);
    }
  };

  useEffect(() => {
    return () => {
      previews.forEach((preview) => URL.revokeObjectURL(preview));
    };
  }, []);

  return (
    <Layout canGoBack title="판매">
      {isUploading && <LoadingSpinner />}
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="space-y-8 px-4 py-10 max-w-xl mx-auto"
      >
        {/* 상품 이미지 */}
        <div className="space-y-2">
          <div className="font-medium text-gray-800">상품 이미지</div>
          <div className="flex gap-3 overflow-x-auto pb-4">
            {previews.map((preview, index) => (
              <div key={index} className="relative flex-shrink-0">
                <div className="w-24 h-24 rounded-xl overflow-hidden">
                  <Image
                    width={96}
                    height={96}
                    src={preview}
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
            {previews.length < 5 && (
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
                  accept="image/*"
                  multiple
                  onChange={handleImageChange}
                />
              </label>
            )}
          </div>
          <p className="text-sm text-gray-500">
            * 최대 5장까지 업로드 가능합니다.
          </p>
        </div>

        {/* 카테고리 선택 */}
        <div className="space-y-2">
          <Label>카테고리</Label>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                className={cn(
                  "px-4 py-2 rounded-full text-sm font-medium transition-colors border",
                  selectedCategory === cat.id
                    ? "bg-primary text-white border-primary"
                    : "bg-white text-gray-700 border-gray-200 hover:border-primary hover:text-primary"
                )}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>

        {/* 상품 타입 선택 */}
        <div className="space-y-2">
          <Label>상품 타입</Label>
          <div className="flex gap-2">
            {PRODUCT_TYPES.map((type) => (
              <button
                key={type.id}
                type="button"
                onClick={() => setSelectedProductType(type.id)}
                className={cn(
                  "px-6 py-2 rounded-full text-sm font-medium transition-colors border",
                  selectedProductType === type.id
                    ? "bg-primary text-white border-primary"
                    : "bg-white text-gray-700 border-gray-200 hover:border-primary hover:text-primary"
                )}
              >
                {type.name}
              </button>
            ))}
          </div>
        </div>

        {/* 상품 정보 */}
        <div className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="name">상품명</Label>
            <Input
              id="name"
              {...register("name", { required: "상품명을 입력해주세요" })}
              placeholder="상품명을 입력해주세요"
              className="focus:border-transparent"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">상품 설명</Label>
            <Controller
              name="description"
              control={control}
              rules={{ required: "상품 설명을 입력해주세요" }}
              render={({ field }) => (
                <MarkdownEditor
                  id="description"
                  value={field.value || ""}
                  onChange={field.onChange}
                  placeholder="상품 설명을 입력해주세요"
                  rows={8}
                />
              )}
            />
            {errors.description && (
              <p className="text-sm text-red-500">{errors.description.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="price">가격</Label>
            <Input
              id="price"
              type="number"
              {...register("price", {
                required: "가격을 입력해주세요",
                valueAsNumber: true,
              })}
              placeholder="가격을 입력해주세요"
              className="focus:border-transparent"
            />
          </div>

          <Button
            type="submit"
            className="w-full focus:border-transparent"
            disabled={isUploading}
            loading={isUploading}
          >
            {isUploading ? "상품 등록 중..." : "상품 등록하기"}
          </Button>
        </div>
      </form>
    </Layout>
  );
};

export default UploadClient;
