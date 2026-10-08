"use client";

import { useRouter } from "next/navigation";
import useSWR from "swr";
import Layout from "@components/features/MainLayout";
import { QueryErrorState } from "@components/app/QueryErrorState";
import useUser from "hooks/useUser";
import type { ItemDetailResponse } from "pages/api/products/[id]";
import { ProductForm } from "../../_components/ProductForm";

/**
 * 상품 수정(앱 src/app/products/[id]/edit.tsx). 로그인 토큰으로 상세를 받아 소유자만 폼을 연다.
 * 네트워크 실패는 "다시 시도", 없는 상품·권한 없음은 안내 + 상품 목록 보기.
 */
export default function EditClient({ productId }: { productId: string }) {
  const router = useRouter();
  const { user, isLoading: userLoading } = useUser();
  const { data, error, isLoading, mutate } = useSWR<ItemDetailResponse>(
    productId ? `/api/products/${productId}` : null,
    { revalidateOnFocus: false }
  );
  const product = data?.product;
  const isOwner = Boolean(user?.id && product?.user?.id === user.id);
  const status = (error as { status?: number } | undefined)?.status;

  const renderBody = () => {
    if (userLoading || isLoading || (!data && !error)) {
      return (
        <div className="flex min-h-[60vh] items-center justify-center">
          <span
            role="status"
            aria-label="불러오는 중"
            className="h-6 w-6 animate-spin rounded-full border-2 border-app-border border-t-app-brand"
          />
        </div>
      );
    }
    if (error && !product && status !== 404 && status !== 403) {
      return (
        <div className="flex min-h-[60vh] items-center">
          <QueryErrorState
            className="w-full"
            title="상품 정보를 불러오지 못했어요"
            onRetry={() => void mutate()}
          />
        </div>
      );
    }
    if (!product || !isOwner || product.isDeleted) {
      return (
        <div className="flex min-h-[60vh] flex-col items-center justify-center px-5 text-center">
          <p className="text-[18px] font-bold text-app-text">수정 권한이 없습니다</p>
          <p className="mt-2 text-[15px] leading-[22px] text-app-muted">
            본인이 등록한 상품만 수정할 수 있어요.
          </p>
          <button
            type="button"
            onClick={() => router.replace("/products")}
            className="mt-5 h-[52px] w-full rounded-md bg-app-brand text-[16px] font-semibold text-white"
          >
            상품 목록 보기
          </button>
        </div>
      );
    }
    return (
      <ProductForm
        key={product.id}
        product={{
          id: product.id,
          name: product.name,
          price: product.price,
          description: product.description,
          photos: product.photos ?? [],
          category: product.category,
          productType: product.productType,
          // 붙인 혈통은 상세 응답의 요약으로 채운다. 회수·숨김된 혈통은 요약이 null 이라 "붙이기"로 보이고,
          // 손대지 않으면 저장 때 혈통 필드를 보내지 않아 서버 값이 그대로 남는다.
          bloodlineRootId: product.bloodline?.id ?? null,
          bloodlineName: product.bloodline?.name ?? null,
          pedigreeNote: product.bloodline ? product.pedigreeNote ?? null : null,
          bloodlineSummary: product.bloodline ?? null,
        }}
      />
    );
  };

  return (
    <Layout canGoBack title="상품 수정" headerRight={<></>}>
      {renderBody()}
    </Layout>
  );
}
