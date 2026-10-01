"use client";
import Layout from "@components/features/MainLayout";
import MarkdownEditor from "@components/features/product/MarkdownEditor";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import useMutation from "hooks/useMutation";
import { Product } from "@prisma/client";
import { toast } from "@libs/client/toast";
import { getProductPath } from "@libs/product-route";
import {
  PRODUCT_DESCRIPTION_MAX_LENGTH,
  PRODUCT_DESCRIPTION_MIN_LENGTH,
  PRODUCT_NAME_MAX_LENGTH,
  PRODUCT_NAME_MIN_LENGTH,
  PRODUCT_PRICE_MAX,
  PRODUCT_PRICE_MIN,
  validateProductInput,
} from "@libs/productRules";

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
  const [editProduct, { loading }] = useMutation<{ success: boolean; message?: string }>(
    product ? `/api/products/${product.id}` : ""
  );
  const {
    register,
    handleSubmit,
    control,
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

    // 서버와 같은 규칙으로 검사한다(@libs/productRules)
    const validation = validateProductInput({
      name: data.name,
      price: Number(data.price),
      description: data.description,
    });
    if (!validation.ok) {
      toast.error(validation.message);
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
          router.push(getProductPath(product.id, data.name));
          router.refresh();
        }
        if (!result.success) {
          toast.error(result.message || "상품 수정에 실패했습니다.");
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
            {...register("name", {
              required: "상품명을 입력해주세요.",
              validate: (value) => {
                const length = value.trim().length;
                if (length < PRODUCT_NAME_MIN_LENGTH)
                  return `상품명은 ${PRODUCT_NAME_MIN_LENGTH}자 이상 입력해주세요.`;
                if (length > PRODUCT_NAME_MAX_LENGTH)
                  return `상품명은 ${PRODUCT_NAME_MAX_LENGTH}자 이하로 입력해주세요.`;
                return true;
              },
            })}
            type="text"
            id="name"
            className="appearance-none w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-primary focus:border-primary"
          />
          {errors.name && (
            <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>
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
            {...register("price", {
              required: "가격을 입력해주세요.",
              valueAsNumber: true,
              validate: {
                valid: (value) =>
                  Number.isInteger(value) || "가격을 숫자로 입력해주세요.",
                min: (value) =>
                  value >= PRODUCT_PRICE_MIN ||
                  `가격은 ${PRODUCT_PRICE_MIN}원 이상 입력해주세요.`,
                max: (value) => value <= PRODUCT_PRICE_MAX || "가격이 너무 큽니다.",
              },
            })}
            type="number"
            id="price"
            className="appearance-none w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-primary focus:border-primary"
          />
          {errors.price && (
            <p className="mt-1 text-sm text-red-600">{errors.price.message}</p>
          )}
        </div>
        <div>
          <label
            htmlFor="description"
            className="mb-1 block text-sm font-medium text-gray-700"
          >
            상품 설명
          </label>
          <Controller
            name="description"
            control={control}
            rules={{
              required: "상품 설명을 입력해주세요.",
              validate: (value) => {
                const length = (value || "").trim().length;
                if (length < PRODUCT_DESCRIPTION_MIN_LENGTH)
                  return `설명을 ${PRODUCT_DESCRIPTION_MIN_LENGTH}자 이상 입력해주세요.`;
                if (length > PRODUCT_DESCRIPTION_MAX_LENGTH)
                  return `설명은 ${PRODUCT_DESCRIPTION_MAX_LENGTH}자 이하로 입력해주세요.`;
                return true;
              },
            }}
            render={({ field }) => (
              <MarkdownEditor
                id="description"
                value={field.value || ""}
                onChange={field.onChange}
                placeholder="상품 설명을 입력해주세요"
                rows={10}
              />
            )}
          />
          {errors.description && (
            <p className="mt-1 text-sm text-red-600">
              {errors.description.message}
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
