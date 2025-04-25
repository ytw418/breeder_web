"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import useMutation from "@libs/client/useMutation";
import Layout from "@components/features/layout";
import { Button } from "@components/ui/button";
import { Input } from "@components/ui/input";
import { Textarea } from "@components/ui/textarea";
import { Label } from "@components/ui/label";
import { useDropzone } from "react-dropzone";
import Image from "next/image";
import { makeImageUrl } from "@libs/client/utils";

interface PostForm {
  title: string;
  description: string;
  image?: FileList;
}

interface PostResponse {
  success: boolean;
  post: {
    id: number;
  };
}

export default function PostForm() {
  const router = useRouter();
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const { register, handleSubmit, watch } = useForm<PostForm>();
  const [createPost, { loading }] = useMutation<PostResponse>("/api/posts");

  const onDrop = (acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      const file = acceptedFiles[0];
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "image/*": [".png", ".jpg", ".jpeg", ".gif"],
    },
    maxFiles: 1,
  });

  const onValid = async (data: PostForm) => {
    if (loading) return;

    const formData = new FormData();
    formData.append("title", data.title);
    formData.append("description", data.description);
    if (data.image && data.image.length > 0) {
      formData.append("image", data.image[0]);
    }

    const response = await createPost(formData);
    if (response?.success) {
      router.push(`/posts/${response.post.id}`);
    }
  };

  return (
    <Layout canGoBack title="게시물 작성" seoTitle="게시물 작성">
      <form onSubmit={handleSubmit(onValid)} className="p-4 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="title">제목</Label>
          <Input
            {...register("title", { required: true })}
            id="title"
            placeholder="제목을 입력하세요"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="description">내용</Label>
          <Textarea
            {...register("description", { required: true })}
            id="description"
            placeholder="내용을 입력하세요"
            rows={10}
          />
        </div>
        <div className="space-y-2">
          <Label>이미지</Label>
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer ${
              isDragActive ? "border-primary" : "border-gray-300"
            }`}
          >
            <input {...getInputProps()} {...register("image")} />
            {imagePreview ? (
              <div className="relative w-full h-48">
                <Image
                  src={imagePreview}
                  alt="Preview"
                  fill
                  className="object-cover rounded-lg"
                />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center space-y-2">
                <svg
                  className="w-12 h-12 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
                <p className="text-sm text-gray-500">
                  이미지를 드래그하거나 클릭하여 업로드하세요
                </p>
              </div>
            )}
          </div>
        </div>
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? "업로드 중..." : "게시하기"}
        </Button>
      </form>
    </Layout>
  );
} 