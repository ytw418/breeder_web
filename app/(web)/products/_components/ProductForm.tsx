"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useSWRConfig } from "swr";

import { FilterChip } from "@components/app/FilterChip";
import { PhotoGridEditor } from "@components/app/PhotoGridEditor";
import { PriceInput } from "@components/app/PriceInput";
import MarkdownEditor from "@components/features/product/MarkdownEditor";
import {
  BloodlineAttachSheet,
  formatBloodlineAttachValue,
  type BloodlineAttachResult,
} from "@components/features/bloodline/BloodlineAttachSheet";
import { ChevronRightIcon } from "@components/features/bloodline/BloodlineScreenParts";
import { useConfirmLeave } from "hooks/useConfirmLeave";
import useUser from "hooks/useUser";
import { authFetch } from "@libs/client/authFetch";
import { cn } from "@libs/client/utils";
import { toast } from "@libs/client/toast";
import { promptPushAfterProductUpload } from "@libs/client/pushPrompt";
import { DEAL_TYPE_OPTIONS, PRODUCT_TYPES } from "@libs/constants";
import { findCategoryBranch, getSubcategories, TOP_LEVEL_CATEGORIES } from "@libs/categoryTaxonomy";
import { getProductPath } from "@libs/product-route";
import {
  firstProductFormError,
  PRODUCT_PHOTOS_MAX,
  PRODUCT_PRICE_MAX,
  validateProductForm,
  type ProductFormErrors,
} from "@libs/productRules";
import { parsePedigreeNote, type PedigreeNote } from "@libs/shared/pedigree-note";
import type { BloodlineLinkSummary } from "@libs/shared/bloodline-card";
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
  /** 거래 유형(sale|adoption|rehoming). 고를 수 없는 값(파양·옛 응답)은 판매로 보여 주고 바꾸지 않으면 보내지 않는다. */
  dealType?: string | null;
  /**
   * 붙어 있는 뿌리 혈통 id. 상세 응답의 `bloodline` 요약이 있을 때만 넘긴다
   * (회수·숨김돼 요약이 없는 연결은 화면에 없는 것으로 두고, 저장 때도 건드리지 않는다).
   */
  bloodlineRootId?: number | null;
  /** 붙어 있는 혈통 이름(혈통 행 값 표시용). */
  bloodlineName?: string | null;
  /** 부·모 크기·누대. 혈통이 없으면 무시한다. */
  pedigreeNote?: PedigreeNote | null;
  /**
   * 붙어 있는 혈통의 서버 요약(상세 응답 `bloodline`). 그 뒤 혈통을 넘겼거나 출처 카드를 보내 붙이기 목록에 없어도
   * 시트에서 "지금 연결된 혈통"으로 남겨 부모·누대를 고칠 수 있게 한다.
   */
  bloodlineSummary?: BloodlineLinkSummary | null;
};

/** 혈통을 붙일 수 있는 상품 타입(PRD S-7: 생물일 때만 행을 보인다). */
const BLOODLINE_PRODUCT_TYPE = "생물";

/** 규칙에 맞는 부모 정보(비면 null). 시트가 정리해 준 값이라 규칙 밖이면 보내지 않는다. */
const normalizePedigreeNote = (note: PedigreeNote | null | undefined): PedigreeNote | null => {
  const parsed = parsePedigreeNote(note ?? null);
  return parsed.ok ? parsed.value : null;
};

const pedigreeNoteKey = (note: PedigreeNote | null | undefined) => {
  const value = normalizePedigreeNote(note);
  return value ? `${value.sireMm ?? ""}|${value.damMm ?? ""}|${value.generation ?? ""}` : "";
};

/**
 * 등록·수정 요청에 실을 혈통 필드(서버 §3.5 "보낸 때만 갱신").
 * - 등록: 생물이고 붙였을 때만 `bloodlineRootId`·`pedigreeNote`(없으면 null)를 싣는다.
 * - 수정: 용품이면 `bloodlineRootId: null`(해제). 생물이면 바뀐 때만 싣는다 — 붙인 혈통·3칸이 그대로면 키가 없어
 *   기존 연결이 남고, 해제했으면 `bloodlineRootId: null`(서버가 부모 정보도 지운다), 바꿨으면 id 와 부모 정보를 싣는다.
 */
export function buildProductBloodlineFields({
  isEdit,
  productType,
  rootId,
  note,
  initialRootId,
  initialNote,
}: {
  isEdit: boolean;
  productType: string;
  rootId: number | null;
  note: PedigreeNote | null;
  initialRootId: number | null;
  initialNote: PedigreeNote | null;
}): { bloodlineRootId?: number | null; pedigreeNote?: PedigreeNote | null } {
  if (productType !== BLOODLINE_PRODUCT_TYPE) return isEdit ? { bloodlineRootId: null } : {};
  if (rootId == null) return isEdit && initialRootId != null ? { bloodlineRootId: null } : {};
  if (isEdit && rootId === initialRootId && pedigreeNoteKey(note) === pedigreeNoteKey(initialNote)) {
    return {};
  }
  return { bloodlineRootId: rootId, pedigreeNote: normalizePedigreeNote(note) };
}

type BloodlineState = { rootId: number | null; name: string | null; note: PedigreeNote };

function FieldLabel({ label, count }: { label: string; count?: string }) {
  return (
    <div className="mb-2 flex items-center justify-between">
      <span className="text-[15px] font-semibold text-app-text">{label}</span>
      {count ? <span className="text-[13px] text-app-muted">{count}</span> : null}
    </div>
  );
}

/** 세그먼트(상품 타입·거래 유형 — 앱 SegmentField). */
function SegmentField({
  label,
  options,
  value,
  onChange,
  disabled,
  error,
}: {
  label: string;
  options: readonly { id: string; name: string }[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  error?: string;
}) {
  return (
    <div>
      <p className="mb-2 text-[15px] font-semibold text-app-text">{label}</p>
      <div className="flex rounded-lg bg-app-surface p-[3px]" role="radiogroup" aria-label={label}>
        {options.map((option) => {
          const active = value === option.id;
          return (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={disabled}
              onClick={() => onChange(option.id)}
              className={cn(
                "h-[42px] flex-1 rounded-md text-[15px] transition-colors",
                active
                  ? "bg-app-elevated font-semibold text-app-text shadow-card"
                  : "font-normal text-app-muted"
              )}
            >
              {option.name}
            </button>
          );
        })}
      </div>
      <ErrorText>{error}</ErrorText>
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
 * → 혈통 행(생물만, 붙이기 시트) → 가격(₩, 무료나눔 칩) → 설명 0/3000. 하단 고정 CTA 52, 업로드 진행 오버레이, 이탈 확인.
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
  const { user } = useUser();

  const initial = useMemo(() => {
    const branch = findCategoryBranch(product?.category);
    const productType = PRODUCT_TYPES.some((type) => type.id === product?.productType)
      ? (product?.productType as string)
      : "";
    // 이름을 모르는 연결(요약 없음)은 붙지 않은 것으로 둔다. 손대지 않으면 저장 때도 보내지 않는다.
    const attached = product?.bloodlineRootId != null && product.bloodlineName ? product : null;
    const dealType = DEAL_TYPE_OPTIONS.some((type) => type.id === product?.dealType)
      ? (product?.dealType as string)
      : "sale";
    return {
      name: product?.name ?? "",
      dealType,
      category: branch.parent,
      subcategory: branch.child,
      productType,
      // 가격 미정(null)은 빈칸, 0원(무료나눔)은 0 그대로 둔다.
      price: product ? product.price : initialFree ? 0 : null,
      description: product?.description ?? "",
      photos: product?.photos ?? [],
      bloodlineRootId: attached?.bloodlineRootId ?? null,
      bloodlineName: attached?.bloodlineName ?? null,
      pedigreeNote: attached ? normalizePedigreeNote(attached.pedigreeNote) : null,
    };
  }, [product, initialFree]);

  const [photos, setPhotos] = useState<ProductPhoto[]>(() => toRemoteProductPhotos(initial.photos));
  const [name, setName] = useState(initial.name);
  const [category, setCategory] = useState(initial.category);
  const [subcategory, setSubcategory] = useState(initial.subcategory);
  const [productType, setProductType] = useState(initial.productType);
  const [dealType, setDealType] = useState(initial.dealType);
  const [price, setPrice] = useState<number | null>(initial.price);
  const [isFree, setIsFree] = useState(initial.price === 0);
  const [description, setDescription] = useState(initial.description);
  const [bloodline, setBloodline] = useState<BloodlineState>(() => ({
    rootId: initial.bloodlineRootId,
    name: initial.bloodlineName,
    note: initial.pedigreeNote ?? {},
  }));
  const [attachOpen, setAttachOpen] = useState(false);
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
  const bloodlineChanged =
    bloodline.rootId !== initial.bloodlineRootId ||
    pedigreeNoteKey(bloodline.note) !== pedigreeNoteKey(initial.pedigreeNote);
  const dirty =
    name !== initial.name ||
    category !== initial.category ||
    subcategory !== initial.subcategory ||
    productType !== initial.productType ||
    dealType !== initial.dealType ||
    price !== initial.price ||
    description !== initial.description ||
    photosChanged ||
    bloodlineChanged;
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

  const applyBloodline = (result: BloodlineAttachResult) => {
    setBloodline({
      rootId: result.rootId,
      name: result.bloodline?.name ?? null,
      note: result.rootId == null ? {} : result.note,
    });
    setAttachOpen(false);
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

    // 저장에 성공하면 이동이 끝날 때까지 버튼을 잠근 채 둔다(다시 누르기·이탈 가드 재무장 방지).
    let succeeded = false;
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
        // 등록은 항상, 수정은 바꿨을 때만 보낸다(고를 수 없는 파양 값을 판매로 덮지 않게).
        ...(!isEdit || dealType !== initial.dealType ? { dealType } : {}),
        ...buildProductBloodlineFields({
          isEdit,
          productType,
          rootId: bloodline.rootId,
          note: bloodline.note,
          initialRootId: initial.bloodlineRootId,
          initialNote: initial.pedigreeNote,
        }),
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
          result?.error || result?.message || (isEdit ? "분양글 수정에 실패했습니다." : "분양글 등록에 실패했습니다.")
        );
      }

      // 홈·상품 목록·프로필 내역·상세를 다시 받는다.
      void globalMutate(
        (key) => typeof key === "string" && /^(\$inf\$)?\/api\/(products|users\/)/.test(key)
      );
      succeeded = true;
      if (isEdit) {
        toast.success("분양글이 수정되었습니다.");
        const path = getProductPath(product!.id, fields.name);
        leave(() => {
          router.replace(path);
          router.refresh();
        });
      } else {
        const id = result.product?.id;
        toast.success("분양글이 등록되었습니다.");
        leave(() => router.replace(id ? getProductPath(id, fields.name) : "/"));
        // 구매 문의를 받으려면 알림이 필요하다. 이 브라우저에서 꺼져 있으면 다시 권유한다(앱과 같다).
        if (user) void promptPushAfterProductUpload(user.id);
      }
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : isEdit
            ? "분양글 수정에 실패했습니다."
            : "분양글 등록에 실패했습니다. 다시 시도해주세요."
      );
    } finally {
      if (!succeeded) setSubmitStep("idle");
    }
  };

  const subcategories = category ? getSubcategories(category) : [];
  const selectedCategoryLabel =
    subcategory || TOP_LEVEL_CATEGORIES.find((cat) => cat.id === category)?.name || "";
  const uploadedCount = photos.filter((photo) => photo.remoteId).length;
  const ctaLabel = isEdit ? "수정하기" : "분양 등록하기";
  const showBloodlineRow = productType === BLOODLINE_PRODUCT_TYPE;
  const bloodlineValue =
    bloodline.rootId != null ? formatBloodlineAttachValue(bloodline.name ?? "", bloodline.note) : "";

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
          <FieldLabel label="제목" count={`${name.length}/60`} />
          <input
            value={name}
            disabled={busy}
            maxLength={60}
            onChange={(event) => {
              setName(event.target.value);
              clearError("name");
            }}
            placeholder="제목"
            aria-label="제목"
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
        <SegmentField
          label="종류"
          options={PRODUCT_TYPES}
          value={productType}
          disabled={busy}
          error={errors.productType}
          onChange={(value) => {
            setProductType(value);
            clearError("productType");
          }}
        />

        {/* 거래 유형(유료 분양/무료 분양) — 앱 ProductDealTypeSegment. 파양은 1단계 비노출. */}
        <SegmentField
          label="거래 유형"
          options={DEAL_TYPE_OPTIONS}
          value={dealType}
          disabled={busy}
          onChange={setDealType}
        />

        {/* 혈통(생물만, 시안 A2 #S5-attach .formrow) */}
        {showBloodlineRow ? (
          <button
            type="button"
            disabled={busy}
            aria-haspopup="dialog"
            onClick={() => setAttachOpen(true)}
            className="-my-2 flex h-14 w-full min-w-0 items-center gap-1 text-left disabled:opacity-50"
          >
            <span className="shrink-0 text-[15px] font-semibold text-app-text">혈통</span>
            <span
              className={cn(
                "ml-auto min-w-0 truncate pl-3 text-[15px]",
                bloodlineValue ? "text-app-text" : "text-app-muted"
              )}
            >
              {bloodlineValue || "붙이기"}
            </span>
            <ChevronRightIcon className="h-[18px] w-[18px] shrink-0 text-app-caption" />
          </button>
        ) : null}

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
          <FieldLabel label="설명" count={`${description.length}/3000`} />
          <MarkdownEditor
            id="description"
            value={description}
            onChange={(value) => {
              setDescription(value);
              clearError("description");
            }}
            placeholder="사육 정보, 상태, 거래 방식 등 입양자가 궁금할 내용을 구체적으로 작성해주세요."
            rows={9}
            hasError={Boolean(errors.description)}
          />
          <ErrorText>{errors.description}</ErrorText>
        </div>

        {/* 하단 고정 CTA */}
        <div className="fixed inset-x-0 bottom-0 mx-auto max-w-xl z-30 border-t border-app-line bg-app-bg pb-[env(safe-area-inset-bottom)]">
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
                ? "분양글을 수정하고 있어요"
                : "분양글을 등록하고 있어요"}
          </p>
          <p className="relative mt-1.5 text-[14px] text-app-muted">화면을 닫지 말고 잠시만 기다려주세요.</p>
        </div>
      ) : null}
      <BloodlineAttachSheet
        open={attachOpen}
        onClose={() => setAttachOpen(false)}
        value={{ rootId: bloodline.rootId, note: bloodline.note }}
        onApply={applyBloodline}
        current={
          initial.bloodlineRootId != null && product?.bloodlineSummary?.id === initial.bloodlineRootId
            ? product.bloodlineSummary
            : null
        }
      />
      {dialog}
    </>
  );
}

export default ProductForm;
