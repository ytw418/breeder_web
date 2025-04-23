"use client";
import Layout from "@components/features/layout";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import useMutation from "@libs/client/useMutation";
import { Product } from "@prisma/client";
import { toast } from "react-toastify";

interface EditForm {
  name: string;
  price: number;
  description: string;
  photos: string[];
}

interface EditClientProps {
  product?: Product | null;
}

export default function EditClient({ product }: EditClientProps) {
  const router = useRouter();
  const [editProduct, { loading }] = useMutation<{ success: boolean }>(
    product ? `/api/products/${product.id}` : ""
  );
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<EditForm>({
    defaultValues: {
      name: product?.name || "",
      price: product?.price || 0,
      description: product?.description || "",
      photos: product?.photos || [],
    },
  });

  const onValid = async (data: EditForm) => {
    if (loading || !product) return;

    // 데이터 유효성 검사
    if (!data.name.trim()) {
      toast.error("상품명을 입력해주세요.");
      return;
    }
    if (data.price <= 0) {
      toast.error("가격은 0보다 커야 합니다.");
      return;
    }
    if (!data.description.trim()) {
      toast.error("상품 설명을 입력해주세요.");
      return;
    }

    await editProduct({
      data: {
        action: "update",
        data: {
          name: data.name.trim(),
          price: Number(data.price),
          description: data.description.trim(),
          photos: data.photos,
        },
      },
      onCompleted: (result) => {
        if (result.success) {
          toast.success("상품이 수정되었습니다.");
          router.push(`/products/${product.id}`);
          router.refresh();
        }
        if (!result.success) {
          toast.error("상품 수정에 실패했습니다.");
        }
      },
      onError: () => {
        toast.error("상품 수정에 실패했습니다.");
      },
    });
  };

  if (!product) {
    return (
      <Layout canGoBack title="상품 수정">
        <div className="flex items-center justify-center h-[50vh]">
          <p className="text-gray-500">상품 정보를 불러오는 중입니다...</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout canGoBack title="상품 수정">
      <form onSubmit={handleSubmit(onValid)} className="p-4 space-y-4">
        <div>
          <label
            htmlFor="name"
            className="mb-1 block text-sm font-medium text-gray-700"
          >
            상품명
          </label>
          <input
            {...register("name", { required: true })}
            type="text"
            id="name"
            className="appearance-none w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-primary focus:border-primary"
          />
          {errors.name && (
            <p className="mt-1 text-sm text-red-600">상품명을 입력해주세요.</p>
          )}
        </div>
        <div>
          <label
            htmlFor="price"
            className="mb-1 block text-sm font-medium text-gray-700"
          >
            가격
          </label>
          <input
            {...register("price", { required: true, min: 1 })}
            type="number"
            id="price"
            className="appearance-none w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-primary focus:border-primary"
          />
          {errors.price && (
            <p className="mt-1 text-sm text-red-600">
              가격은 0보다 커야 합니다.
            </p>
          )}
        </div>
        <div>
          <label
            htmlFor="description"
            className="mb-1 block text-sm font-medium text-gray-700"
          >
            상품 설명
          </label>
          <textarea
            {...register("description", { required: true })}
            id="description"
            rows={4}
            className="appearance-none w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-primary focus:border-primary"
          />
          {errors.description && (
            <p className="mt-1 text-sm text-red-600">
              상품 설명을 입력해주세요.
            </p>
          )}
        </div>
        <button
          type="submit"
          className="w-full bg-primary text-white py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
          disabled={loading}
        >
          {loading ? "수정 중..." : "수정하기"}
        </button>
      </form>
    </Layout>
  );
}
