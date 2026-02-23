"use client";

import Layout from "@components/features/MainLayout";
import { Button } from "@components/ui/button";
import { Input } from "@components/ui/input";
import { Textarea } from "@components/ui/textarea";
import { Label } from "@components/ui/label";
import useMutation from "hooks/useMutation";
import { Post } from "@prisma/client";
import Image from "@components/atoms/Image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { cn } from "@libs/client/utils";
import { POST_CATEGORIES } from "@libs/constants";
import { TOP_LEVEL_CATEGORIES } from "@libs/categoryTaxonomy";
import { toPostPath } from "@libs/post-route";
import { toast } from "react-toastify";

interface UploadPostForm {
  title: string;
  description: string;
}

interface UploadPostMutation {
  success: boolean;
  post: Post;
  error?: string;
  message?: string;
}

type SubmitStep = "idle" | "image" | "submit";
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/jpg"];

const LoadingOverlay = ({ step }: { step: SubmitStep }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm">
    <div className="min-w-[280px] rounded-xl bg-white p-6 text-center shadow-xl">
      <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      <p className="mt-3 text-base font-semibold text-slate-900">
        {step === "image" ? "이미지를 업로드하고 있어요" : "게시글을 등록하고 있어요"}
      </p>
      <p className="mt-1 text-sm text-slate-500">잠시만 기다려주세요.</p>
    </div>
  </div>
);

const UploadClient = () => {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<UploadPostForm>({
    mode: "onChange",
  });
  const [uploadPost, { loading }] =
    useMutation<UploadPostMutation>("/api/posts");

  // 카테고리 선택 상태
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [categoryError, setCategoryError] = useState<string>("");
  const [selectedSpecies, setSelectedSpecies] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStep, setSubmitStep] = useState<SubmitStep>("idle");
  const [imageFile, setImageFile] = useState<File | null>(null);

  const watchedTitle = watch("title", "");
  const watchedDescription = watch("description", "");

  const onValid = async ({ title, description }: UploadPostForm) => {
    if (loading || isSubmitting) return;
    if (!selectedCategory) {
      setCategoryError("카테고리를 선택해주세요.");
      toast.error("카테고리를 선택해주세요.");
      return;
    }

    try {
      setIsSubmitting(true);
      let uploadedImageId = "";

      if (imageFile) {
        setSubmitStep("image");
        const fileApiResponse = await fetch("/api/files");
        const fileApiResult = await fileApiResponse.json();
        if (!fileApiResponse.ok || !fileApiResult?.uploadURL) {
          throw new Error("이미지 업로드 URL 발급에 실패했습니다.");
        }

        const formData = new FormData();
        formData.append("file", imageFile, title);
        const uploadResponse = await fetch(fileApiResult.uploadURL, {
          method: "POST",
          body: formData,
        });
        const uploadResult = await uploadResponse.json();
        uploadedImageId = uploadResult?.result?.id || fileApiResult?.id || "";
        if (!uploadResponse.ok || !uploadedImageId) {
          throw new Error("이미지 업로드에 실패했습니다.");
        }
      }

      setSubmitStep("submit");
      const result = await uploadPost({
        data: {
          title: title.trim(),
          description: description.trim(),
          image: uploadedImageId,
          category: selectedCategory,
          species: selectedSpecies,
        },
      });

      if (result.success && result.post?.id) {
        toast.success("게시글이 등록되었습니다.");
        router.push(toPostPath(result.post.id, result.post.title));
        return;
      }

      toast.error(result.error || result.message || "게시글 등록에 실패했습니다.");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "게시글 등록 중 오류가 발생했습니다."
      );
    } finally {
      setIsSubmitting(false);
      setSubmitStep("idle");
    }
  };

  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      toast.error("JPG, PNG, WEBP 형식만 업로드할 수 있습니다.");
      event.target.value = "";
      return;
    }

    if (file.size > MAX_IMAGE_SIZE) {
      toast.error("이미지는 최대 10MB까지 업로드할 수 있습니다.");
      event.target.value = "";
      return;
    }

    setImageFile(file);
    event.target.value = "";
  };

  const removeImage = () => setImageFile(null);

  const [imagePreview, setImagePreview] = useState("");
  useEffect(() => {
    if (!imageFile) {
      setImagePreview("");
      return;
    }
    const nextPreview = URL.createObjectURL(imageFile);
    setImagePreview(nextPreview);
    return () => URL.revokeObjectURL(nextPreview);
  }, [imageFile]);

  useEffect(() => {
    if (selectedCategory) setCategoryError("");
  }, [selectedCategory]);

  const isSubmitDisabled =
    isSubmitting ||
    loading ||
    !selectedCategory ||
    !watchedTitle.trim() ||
    !watchedDescription.trim();

  return (
    <Layout canGoBack title="글 작성" seoTitle="글 작성">
      {isSubmitting ? <LoadingOverlay step={submitStep} /> : null}
      <form
        className="mx-auto max-w-xl space-y-5 px-4 pb-28 pt-5"
        onSubmit={handleSubmit(onValid, () => {
          toast.error("입력값을 확인해주세요.");
        })}
      >
        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <Label>카테고리</Label>
          <div className="flex flex-wrap gap-2">
            {POST_CATEGORIES.map((cat) => (
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
          {categoryError ? <p className="mt-2 text-xs text-red-500">{categoryError}</p> : null}
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <Label>관심 생물군 (선택)</Label>
          <div className="mt-2 flex flex-wrap gap-2">
            {TOP_LEVEL_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedSpecies((prev) => (prev === cat.id ? "" : cat.id))}
                className={cn(
                  "rounded-md border px-3 py-1.5 text-sm font-medium transition-colors",
                  selectedSpecies === cat.id
                    ? "border-primary bg-primary text-white"
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                )}
              >
                {cat.name}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-slate-500">게시글 노출/필터링에 사용됩니다.</p>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="mb-2 flex items-center justify-between">
            <Label>대표 이미지 (선택)</Label>
            <span className="text-xs text-slate-500">최대 10MB</span>
          </div>
          {imagePreview ? (
            <div className="relative">
              <Image
                width={500}
                height={500}
                src={imagePreview}
                alt="업로드이미지"
                className="w-full text-gray-600 rounded-lg h-48 object-cover"
              />
              <button
                type="button"
                onClick={removeImage}
                className="absolute top-2 right-2 p-2 bg-white/80 rounded-full hover:bg-white transition-colors"
              >
                <svg
                  className="w-5 h-5 text-gray-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          ) : (
            <label className="w-full cursor-pointer text-slate-600 hover:border-primary hover:text-primary flex items-center justify-center border-2 border-dashed border-slate-300 h-48 rounded-lg transition-colors">
              <div className="flex flex-col items-center">
                <svg
                  className="h-12 w-12"
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
                <span className="mt-2 text-sm">이미지 업로드 (선택)</span>
              </div>
              <input
                accept="image/png,image/jpeg,image/jpg,image/webp"
                className="hidden"
                type="file"
                onChange={handleImageChange}
              />
            </label>
          )}
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-4 space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="title">제목</Label>
              <span className="text-xs text-slate-400">{watchedTitle.length}/80</span>
            </div>
            <Input
              {...register("title", {
                required: "제목을 입력해주세요.",
                minLength: { value: 2, message: "제목은 2자 이상 입력해주세요." },
                maxLength: { value: 80, message: "제목은 80자 이하로 입력해주세요." },
              })}
              name="title"
              type="text"
              placeholder="제목을 입력해주세요"
            />
            {errors.title ? <p className="text-xs text-red-500">{errors.title.message}</p> : null}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="description">내용</Label>
              <span className="text-xs text-slate-400">{watchedDescription.length}/2000</span>
            </div>
            <Textarea
              {...register("description", {
                required: "내용을 입력해주세요.",
                minLength: { value: 10, message: "내용을 10자 이상 입력해주세요." },
                maxLength: { value: 2000, message: "내용은 2000자 이하로 입력해주세요." },
              })}
              name="description"
              placeholder="곤충에 대한 이야기를 자유롭게 나눠보세요"
              className="min-h-[180px]"
            />
            {errors.description ? (
              <p className="text-xs text-red-500">{errors.description.message}</p>
            ) : null}
          </div>
        </section>

        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200/80 bg-white/92 backdrop-blur">
          <div className="mx-auto max-w-xl px-4 pb-[calc(10px+env(safe-area-inset-bottom))] pt-3">
            <Button
              variant="default"
              size="lg"
              fullWidth
              disabled={isSubmitDisabled}
              loading={isSubmitting}
              type="submit"
            >
              게시글 등록하기
            </Button>
            <p className="mt-2 text-center text-[11px] text-slate-400">
              커뮤니티 운영 가이드를 지켜 작성해주세요.
            </p>
          </div>
        </div>
      </form>
    </Layout>
  );
};

export default UploadClient;
