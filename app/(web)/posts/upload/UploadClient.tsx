"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import Button from "@components/button";
import Input from "@components/input";
import Layout from "@components/features/layout";
import TextArea from "@components/textarea";
import useMutation from "@libs/client/useMutation";
import { Post } from "@prisma/client";
import Image from "next/image";

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
      <form className="p-4 space-y-4" onSubmit={handleSubmit(onValid)}>
        <div>
          {imagePreview ? (
            <Image
              width={500}
              height={500}
              src={imagePreview}
              alt="업로드이미지"
              className="w-full text-gray-600 rounded-md h-48 object-cover"
            />
          ) : (
            <label className="w-full cursor-pointer text-gray-600 hover:border-orange-500 hover:text-orange-500 flex items-center justify-center border-2 border-dashed border-gray-300 h-48 rounded-md">
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
              <input
                {...register("image")}
                accept="image/*"
                className="hidden"
                type="file"
              />
            </label>
          )}
        </div>
        <Input
          register={register("title", { required: true })}
          required
          label="제목"
          name="name"
          type="text"
        />
        <TextArea
          register={register("description", { required: true })}
          name="description"
          label="내용"
          required
        />
        <Button text={loading ? "등록중..." : "등록"} />
      </form>
    </Layout>
  );
};

export default UploadClient;
