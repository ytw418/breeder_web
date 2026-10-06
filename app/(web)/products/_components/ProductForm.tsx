"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useSWRConfig } from "swr";

import { FilterChip } from "@components/app/FilterChip";
import { PhotoGridEditor } from "@components/app/PhotoGridEditor";
import { PriceInput } from "@components/app/PriceInput";
import MarkdownEditor from "@components/features/product/MarkdownEditor";
import { useConfirmLeave } from "hooks/useConfirmLeave";
import { authFetch } from "@libs/client/authFetch";
import { cn } from "@libs/client/utils";
import { toast } from "@libs/client/toast";
import { PRODUCT_TYPES } from "@libs/constants";
import { findCategoryBranch, getSubcategories, TOP_LEVEL_CATEGORIES } from "@libs/categoryTaxonomy";
import { getProductPath } from "@libs/product-route";
import {
  firstProductFormError,
  PRODUCT_PHOTOS_MAX,
  PRODUCT_PRICE_MAX,
  validateProductForm,
  type ProductFormErrors,
} from "@libs/productRules";
import {
  markProductPhotoUploaded,
  resolveProductPhotoIds,
  toLocalProductPhotos,
  toRemoteProductPhotos,
  type ProductPhoto,
} from "./productPhotos";

type SubmitStep = "idle" | "images" | "submit";

export type ProductFormInitial = {
  id: number;
  name: string;
  price: number | null;
  description: string;
  photos: string[];
  category: string | null;
  productType: string | null;
};

function FieldLabel({ label, count }: { label: string; count?: string }) {
  return (
    <div className="mb-2 flex items-center justify-between">
      <span className="text-[15px] font-semibold text-app-text">{label}</span>
      {count ? <span className="text-[13px] text-app-muted">{count}</span> : null}
    </div>
  );
}

function ErrorText({ children, className }: { children?: string; className?: string }) {
  if (!children) return null;
  return <p className={cn("mt-1.5 text-[13px] text-app-danger", className)}>{children}</p>;
}

function ChipRow({ children }: { children: ReactNode }) {
  return <div className="flex h-11 items-center gap-1.5 overflow-x-auto scrollbar-hide">{children}</div>;
}

/**
 * 상품 등록·수정 당근 단일 폼(앱 src/app/products/upload.tsx · [id]/edit.tsx).
 * 사진(대표·순서·10장·10MB) → 상품명 0/60 → 카테고리(대분류·하위분류 칩) → 상품 타입 세그먼트
 * → 가격(₩, 무료나눔 칩) → 설명 0/3000. 하단 고정 CTA 52, 업로드 진행 오버레이, 이탈 확인.
 */
export function ProductForm({
  product,
  initialFree = false,
}: {
  /** 있으면 수정 모드 */
  product?: ProductFormInitial;
  /** 등록 화면 ?free=1 → 무료나눔 미리 선택 */
  initialFree?: boolean;
}) {
  const router = useRouter();
  const { mutate: globalMutate } = useSWRConfig();
  const isEdit = Boolean(product);

  const initial = useMemo(() => {
    const branch = findCategoryBranch(product?.category);
    const productType = PRODUCT_TYPES.some((type) => type.id === product?.productType)
      ? (product?.productType as string)
      : "";
    return {
      name: product?.name ?? "",
      category: branch.parent,
      subcategory: branch.child,
      productType,
      // 가격 미정(null)은 빈칸, 0원(무료나눔)은 0 그대로 둔다.
      price: product ? product.price : initialFree ? 0 : null,
      description: product?.description ?? "",
      photos: product?.photos ?? [],
    };
  }, [product, initialFree]);

  const [photos, setPhotos] = useState<ProductPhoto[]>(() => toRemoteProductPhotos(initial.photos));
  const [name, setName] = useState(initial.name);
  const [category, setCategory] = useState(initial.category);
  const [subcategory, setSubcategory] = useState(initial.subcategory);
  const [productType, setProductType] = useState(initial.productType);
  const [price, setPrice] = useState<number | null>(initial.price);
  const [isFree, setIsFree] = useState(initial.price === 0);
  const [description, setDescription] = useState(initial.description);
  const [errors, setErrors] = useState<ProductFormErrors>({});
  const [submitStep, setSubmitStep] = useState<SubmitStep>("idle");
  const busy = submitStep !== "idle";

  // 로컬 미리보기 주소는 화면을 떠날 때 정리한다.
  const photosRef = useRef(photos);
  photosRef.current = photos;
  useEffect(
    () => () => {
      photosRef.current.forEach((photo) => {
        if (photo.src.startsWith("blob:")) URL.revokeObjectURL(photo.src);
      });
    },
    []
  );

  const photosChanged =
    photos.length !== initial.photos.length ||
    photos.some((photo, index) => photo.remoteId !== initial.photos[index]);
  const dirty =
    name !== initial.name ||
    category !== initial.category ||
    subcategory !== initial.subcategory ||
    productType !== initial.productType ||
    price !== initial.price ||
    description !== initial.description ||
    photosChanged;
  const { leave, dialog } = useConfirmLeave(dirty && submitStep !== "submit");

  const clearError = (field: keyof ProductFormErrors) =>
    setErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });

  const toggleFree = () => {
    if (busy) return;
    const next = !isFree;
    setIsFree(next);
    setPrice(next ? 0 : null);
    clearError("price");
  };

  const addFiles = (files: File[]) => {
    const remaining = PRODUCT_PHOTOS_MAX - photos.length;
    if (files.length > remaining) {
      toast.info(`이미지는 최대 ${PRODUCT_PHOTOS_MAX}장까지 등록할 수 있습니다.`);
    }
    const { photos: added, error } = toLocalProductPhotos(files.slice(0, remaining));
    if (error) {
      toast.error(error);
      return;
    }
    setPhotos((prev) => [...prev, ...added]);
  };

  const submit = async () => {
    if (busy) return;
    const nextErrors = validateProductForm({ name, price, description, category, productType });
    setErrors(nextErrors);
    const firstError = firstProductFormError(nextErrors);
    if (firstError) {
      toast.error(firstError);
      return;
    }

    try {
      setSubmitStep("images");
      // 올라간 사진은 바로 remote 로 바꿔 둔다. 일부가 실패해 다시 누르면 남은 사진만 올린다.
      const snapshot = photos;
      const photoIds = await resolveProductPhotoIds(snapshot, (index, id) =>
        setPhotos((prev) => markProductPhotoUploaded(prev, snapshot[index], id))
      );

      setSubmitStep("submit");
      const fields = {
        name: name.trim(),
        price,
        description: description.trim(),
        photos: photoIds,
        category: subcategory || category,
        productType,
      };
      const res = await authFetch(isEdit ? `/api/products/${product!.id}` : "/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isEdit ? { action: "update", data: fields } : fields),
      });
      const result = (await res.json().catch(() => null)) as {
        success?: boolean;
        product?: { id: number };
        error?: string;
        message?: string;
      } | null;
      if (!res.ok || !result?.success) {
        throw new Error(
          result?.error || result?.message || (isEdit ? "상품 수정에 실패했습니다." : "상품 등록에 실패했습니다.")
        );
      }

      // 홈·상품 목록·프로필 내역·상세를 다시 받는다.
      void globalMutate(
        (key) => typeof key === "string" && /^(\$inf\$)?\/api\/(products|users\/)/.test(key)
      );
      if (isEdit) {
        toast.success("상품이 수정되었습니다.");
        const path = getProductPath(product!.id, fields.name);
        leave(() => {
          router.replace(path);
          router.refresh();
        });
      } else {
        const id = result.product?.id;
        toast.success("상품이 등록되었습니다.");
        leave(() => router.replace(id ? getProductPath(id, fields.name) : "/"));
      }
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : isEdit
            ? "상품 수정에 실패했습니다."
            : "상품 등록에 실패했습니다. 다시 시도해주세요."
      );
    } finally {
      setSubmitStep("idle");
    }
  };

  const subcategories = category ? getSubcategories(category) : [];
  const selectedCategoryLabel =
    subcategory || TOP_LEVEL_CATEGORIES.find((cat) => cat.id === category)?.name || "";
  const uploadedCount = photos.filter((photo) => photo.remoteId).length;
  const ctaLabel = isEdit ? "수정하기" : "상품 등록하기";

  return (
    <>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
        className="flex flex-col gap-5 px-5 pb-[calc(52px+40px+env(safe-area-inset-bottom))] pt-5"
        noValidate
      >
        {/* 사진 */}
        <PhotoGridEditor
          photos={photos}
          onChange={(next) => setPhotos(next as ProductPhoto[])}
          max={PRODUCT_PHOTOS_MAX}
          onAdd={addFiles}
          disabled={busy}
        />

        {/* 상품명 */}
        <div>
          <FieldLabel label="상품명" count={`${name.length}/60`} />
          <input
            value={name}
            disabled={busy}
            maxLength={60}
            onChange={(event) => {
              setName(event.target.value);
              clearError("name");
            }}
            placeholder="상품명"
            aria-label="상품명"
            aria-invalid={Boolean(errors.name)}
            className={cn(
              "h-12 w-full rounded-lg border bg-app-bg px-3.5 text-[16px] text-app-text placeholder:text-app-caption focus:border-app-text focus:outline-none focus:ring-0 disabled:opacity-50",
              errors.name ? "border-app-danger" : "border-app-border"
            )}
          />
          <ErrorText>{errors.name}</ErrorText>
        </div>

        {/* 카테고리 */}
        <div>
          <div className="mb-0.5 flex h-8 items-center">
            <span className="text-[15px] font-semibold text-app-text">카테고리</span>
            <span
              className={cn(
                "ml-auto max-w-[55%] truncate text-[15px]",
                selectedCategoryLabel ? "text-app-text" : "text-app-caption"
              )}
            >
              {selectedCategoryLabel || "선택"}
            </span>
          </div>
          <fieldset disabled={busy} className="min-w-0">
            <ChipRow>
              {TOP_LEVEL_CATEGORIES.map((cat) => (
                <FilterChip
                  key={cat.id}
                  label={cat.name}
                  selected={category === cat.id}
                  onClick={() => {
                    // 같은 대분류를 다시 누르면 고른 하위분류를 그대로 둔다.
                    if (category === cat.id) return;
                    setCategory(cat.id);
                    setSubcategory("");
                    clearError("category");
                  }}
                />
              ))}
            </ChipRow>
            {subcategories.length > 0 ? (
              <ChipRow>
                {subcategories.map((sub) => (
                  <FilterChip
                    key={sub}
                    label={sub}
                    selected={subcategory === sub}
                    // 선택된 하위분류를 다시 누르면 해제해 대분류로 저장한다.
                    onClick={() => setSubcategory(subcategory === sub ? "" : sub)}
                  />
                ))}
              </ChipRow>
            ) : null}
          </fieldset>
          <ErrorText className="mt-0">{errors.category}</ErrorText>
        </div>

        {/* 상품 타입 */}
        <div>
          <p className="mb-2 text-[15px] font-semibold text-app-text">상품 타입</p>
          <div className="flex rounded-lg bg-app-surface p-[3px]" role="radiogroup" aria-label="상품 타입">
            {PRODUCT_TYPES.map((type) => {
              const active = productType === type.id;
              return (
                <button
                  key={type.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  disabled={busy}
                  onClick={() => {
                    setProductType(type.id);
                    clearError("productType");
                  }}
                  className={cn(
                    "h-[42px] flex-1 rounded-md text-[15px] transition-colors",
                    active
                      ? "bg-app-elevated font-semibold text-app-text shadow-card"
                      : "font-normal text-app-muted"
                  )}
                >
                  {type.name}
                </button>
              );
            })}
          </div>
          <ErrorText>{errors.productType}</ErrorText>
        </div>

        {/* 가격 */}
        <div className="-mt-1.5">
          <div className="mb-0.5 flex h-11 items-center justify-between">
            <span className="text-[15px] font-semibold text-app-text">가격</span>
            <FilterChip label="무료나눔" selected={isFree} onClick={toggleFree} />
          </div>
          <PriceInput
            value={price}
            onChange={(value) => {
              setPrice(value);
              clearError("price");
            }}
            max={PRODUCT_PRICE_MAX}
            prefix="₩"
            disabled={busy || isFree}
            placeholder="가격을 입력해주세요"
            aria-label="가격"
            className={errors.price ? "border-app-danger" : undefined}
          />
          {errors.price ? (
            <ErrorText>{errors.price}</ErrorText>
          ) : (
            <p className="mt-1.5 text-[13px] text-app-muted">0원은 무료나눔으로 등록돼요</p>
          )}
        </div>

        {/* 상품 설명 */}
        <div>
          <FieldLabel label="상품 설명" count={`${description.length}/3000`} />
          <MarkdownEditor
            id="description"
            value={description}
            onChange={(value) => {
              setDescription(value);
              clearError("description");
            }}
            placeholder="사육 정보, 상태, 거래 방식 등 구매자가 궁금할 내용을 구체적으로 작성해주세요."
            rows={9}
          />
          <ErrorText>{errors.description}</ErrorText>
        </div>

        {/* 하단 고정 CTA */}
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-app-line bg-app-bg pb-[env(safe-area-inset-bottom)]">
          <div className="mx-auto max-w-xl px-5 py-2">
            <button
              type="submit"
              aria-label={ctaLabel}
              disabled={busy}
              className={cn(
                "flex h-[52px] w-full items-center justify-center rounded-md text-[16px] font-semibold",
                busy ? "bg-app-surface text-app-caption" : "bg-app-brand text-white"
              )}
            >
              {busy ? (
                <span className="h-5 w-5 animate-spin rounded-full border-2 border-app-border border-t-app-caption" />
              ) : (
                ctaLabel
              )}
            </button>
          </div>
        </div>
      </form>

      {busy ? (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center" role="status">
          <div className="absolute inset-0 bg-app-bg opacity-[0.72]" aria-hidden="true" />
          <span className="relative h-9 w-9 animate-spin rounded-full border-[3px] border-app-border border-t-app-brand" />
          <p className="relative mt-3 text-[15px] font-semibold text-app-text">
            {submitStep === "images"
              ? `이미지를 업로드하고 있어요${photos.length ? ` (${uploadedCount}/${photos.length})` : ""}`
              : isEdit
                ? "상품을 수정하고 있어요"
                : "상품을 등록하고 있어요"}
          </p>
          <p className="relative mt-1.5 text-[14px] text-app-muted">화면을 닫지 말고 잠시만 기다려주세요.</p>
        </div>
      ) : null}
      {dialog}
    </>
  );
}

export default ProductForm;
