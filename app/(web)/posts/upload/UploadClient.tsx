"use client";

import Layout from "@components/features/layout";
import { Button } from "@components/ui/button";
import { Input } from "@components/ui/input";
import { Textarea } from "@components/ui/textarea";
import { Label } from "@components/ui/label";
import useMutation from "@libs/client/useMutation";
import { Post } from "@prisma/client";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";

interface UploadPostForm {
  title: string;
  description: string;
  image: FileList;
}

interface UploadPostMutation {
  success: boolean;
  post: Post;
}

const UploadClient = () => {
  const router = useRouter();
  const { register, handleSubmit, watch } = useForm<UploadPostForm>();
  const [uploadPost, { loading, data }] =
    useMutation<UploadPostMutation>("/api/posts");

  const onValid = async ({ title, image, description }: UploadPostForm) => {
    if (loading) return;

    if (image && image.length > 0) {
      const { uploadURL } = await (await fetch(`/api/files`)).json();
      const form = new FormData();
      form.append("file", image[0], title);
      const {
        result: { id },
      } = await (await fetch(uploadURL, { method: "POST", body: form })).json();

      uploadPost({
        data: { title, description, image: id },
        onCompleted(result) {
          console.log("uploadPost result :>> ", result);
          if (result.success) {
            return router.push(`/posts/${result.post.id}`);
          } else {
            alert("등록 실패");
          }
        },
      });
    } else {
      uploadPost({
        data: { title, description },
        onCompleted(result) {
          console.log("uploadPost result :>> ", result);
          if (result.success) {
            return router.push(`/posts/${result.post.id}`);
          } else {
            alert("등록 실패");
          }
        },
      });
    }
  };

  const image = watch("image");
  const [imagePreview, setImagePreview] = useState("");
  useEffect(() => {
    if (image && image.length > 0) {
      const file = image[0];
      setImagePreview(URL.createObjectURL(file));
    }
  }, [image]);
  return (
    <Layout canGoBack title="게시물 작성">
      <form className="p-4 space-y-6" onSubmit={handleSubmit(onValid)}>
        <div>
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
                onClick={() => setImagePreview("")}
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
            <label className="w-full cursor-pointer text-gray-600 hover:border-primary hover:text-primary flex items-center justify-center border-2 border-dashed border-gray-300 h-48 rounded-lg transition-colors">
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
                <span className="mt-2 text-sm">이미지 업로드</span>
              </div>
              <input
                {...register("image")}
                accept="image/*"
                className="hidden"
                type="file"
              />
            </label>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="title">제목</Label>
          <Input
            {...register("title", { required: true })}
            required
            name="title"
            type="text"
            placeholder="제목을 입력해주세요"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">내용</Label>
          <Textarea
            {...register("description", { required: true })}
            name="description"
            required
            placeholder="내용을 입력해주세요"
            className="min-h-[120px]"
          />
        </div>

        <Button
          variant="default"
          size="lg"
          fullWidth
          disabled={loading}
          type="submit"
        >
          {loading ? (
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
          ) : (
            "등록"
          )}
        </Button>
      </form>
    </Layout>
  );
};

export default UploadClient;
