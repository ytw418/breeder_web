"use client";

import { HorizontalRail } from "@components/ui/HorizontalRail";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useSWRConfig } from "swr";

import { FilterChip } from "@components/app/FilterChip";
import { AgreeRow } from "../../auctions/AuctionFormParts";
import { ComposeDraftSheet } from "@components/app/ComposeDraftSheet";
import {
  deleteComposeDraft,
  readComposeDraft,
  useComposeDraftAutosave,
  type ProductDraft,
} from "@libs/client/composeDraft";
import { PhotoGridEditor } from "@components/app/PhotoGridEditor";
import { PriceInput } from "@components/app/PriceInput";
import MarkdownEditor from "@components/features/product/MarkdownEditor";
import {
  BloodlineAttachSheet,
  formatBloodlineAttachValue,
  type BloodlineAttachResult,
} from "@components/features/bloodline/BloodlineAttachSheet";
import { ChevronRightIcon } from "@components/features/bloodline/BloodlineScreenParts";
import { PetPostFields } from "@components/features/pet/PetPostFields";
import { useConfirmLeave } from "hooks/useConfirmLeave";
import useUser from "hooks/useUser";
import { useCelebrateSheet } from "@components/features/celebrate/CelebrateSheet";
import type { Celebrate } from "@libs/shared/communityVibe";
import { authFetch } from "@libs/client/authFetch";
import { ANALYTICS_EVENTS, trackEvent } from "@libs/client/analytics";
import { cn } from "@libs/client/utils";
import { toast } from "@libs/client/toast";
import { promptPushAfterProductUpload } from "@libs/client/pushPrompt";
import { DEAL_TYPE_OPTIONS, PRODUCT_TYPES } from "@libs/constants";
import { findCategoryBranch, getSubcategories, TOP_LEVEL_CATEGORIES } from "@libs/categoryTaxonomy";
import { getProductPath } from "@libs/product-route";
import {
  PRODUCT_DESCRIPTION_MAX_LENGTH,
  PRODUCT_PHOTOS_MAX,
  PRODUCT_PRICE_MAX,
  validateProductForm,
  type ProductFormErrors,
} from "@libs/productRules";
import { parsePedigreeNote, type PedigreeNote } from "@libs/shared/pedigree-note";
import {
  isNoPriceCategory,
  isPetPostKind,
  parsePetInfo,
  petDescriptionPlaceholder,
  petRegionText,
  productWriteLabels,
  showsPetRegion,
  type PetInfo,
  type PetPostKind,
} from "@libs/shared/petSpace";
import { regionOf } from "@libs/shared/regions";
import type { BloodlineLinkSummary } from "@libs/shared/bloodline-card";
import {
  markProductPhotoUploaded,
  resolveProductPhotoIds,
  toLocalProductPhotos,
  toRemoteProductPhotos,
  type ProductPhoto,
} from "./productPhotos";

type SubmitStep = "idle" | "images" | "submit";

/** 화면 위에서부터 오류 칸 순서. 검증에 걸리면 토스트 없이 첫 오류 칸으로 스크롤한다(앱 use-scroll-to-first-error). */
const ERROR_FIELD_ORDER = ["name", "category", "productType", "price", "description", "agreement"] as const;
type ErrorField = (typeof ERROR_FIELD_ORDER)[number];

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
  /** 강아지·고양이 글 정보(성별·나이·건강·이유·임보 기간, docs/prd/pet-space.md §5.5). */
  petInfo?: unknown;
  /** 가족 찾아요·임보 구해요 글에 남긴 동네(§5.9). 둘 다 있으면 '내 동네 보이기'를 켠 채로 연다. */
  regionSido?: string | null;
  regionSigungu?: string | null;
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

/** 강아지·고양이 글은 개체(생물)만 받는다 — 종류 세그먼트를 숨기고 이 값으로 보낸다. */
const PET_PRODUCT_TYPE = "생물";

/** 정보 칸 비교용 키(빈 값은 버린 뒤 비교). */
const petInfoKey = (info: PetInfo | null | undefined) => JSON.stringify(parsePetInfo(info) ?? {});

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
  return <HorizontalRail className="h-11 items-center gap-1.5">{children}</HorizontalRail>;
}

/**
 * 상품 등록·수정 당근 단일 폼(앱 src/app/products/upload.tsx · [id]/edit.tsx).
 * 사진(대표·순서·10장·10MB) → 상품명 0/60 → 카테고리(대분류·하위분류 칩) → 상품 타입 세그먼트
 * → 혈통 행(생물만, 붙이기 시트) → 가격(₩, 무료 분양 칩) → 설명 0/3,000. 하단 고정 CTA 52, 업로드 진행 오버레이, 이탈 확인.
 * 강아지·고양이를 고르면 종류·거래 유형·혈통·가격 칸 대신 '어떤 글인가요?'와 정보 칸(PetPostFields)을 둔다
 * (docs/prd/pet-space.md §5.5 — 가격은 받지도 보내지도 않는다).
 */
export function ProductForm({
  product,
  initialFree = false,
  initialCategory,
  initialKind,
  onTitleChange,
}: {
  /** 있으면 수정 모드 */
  product?: ProductFormInitial;
  /** 등록 화면 ?free=1 → 무료 분양 미리 선택 */
  initialFree?: boolean;
  /** 등록 화면 ?category=<종> → 카테고리 미리 선택(끝난 토론 '{종} 첫 분양글 올리기', 앱 docs/prd/live-talk.md §3.6) */
  initialCategory?: string;
  /** 등록 화면 ?kind=rehoming|foster(입양 쪽 글쓰기) → 글 종류를 미리 고르고 포유류를 펼쳐 둔다. */
  initialKind?: string;
  /** 등록 화면 헤더 제목. 임보·가족 찾기 글이면 '글쓰기'(productWriteLabels). */
  onTitleChange?: (title: string) => void;
}) {
  const router = useRouter();
  const { mutate: globalMutate } = useSWRConfig();
  const isEdit = Boolean(product);
  const { user } = useUser();
  const celebrateSheet = useCelebrateSheet("product");

  const initial = useMemo(() => {
    const kindFromLink = !product && isPetPostKind(initialKind) ? initialKind : null;
    // 입양 쪽에서 왔으면(카테고리 링크가 없을 때) 포유류를 펼쳐 강아지·고양이를 바로 고르게 한다.
    const branch = findCategoryBranch(
      product ? product.category : initialCategory ?? (kindFromLink ? "포유류" : undefined)
    );
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
      // 가격 미정(null)은 빈칸, 0원(무료 분양)은 0 그대로 둔다.
      price: product ? product.price : initialFree ? 0 : null,
      description: product?.description ?? "",
      photos: product?.photos ?? [],
      bloodlineRootId: attached?.bloodlineRootId ?? null,
      bloodlineName: attached?.bloodlineName ?? null,
      pedigreeNote: attached ? normalizePedigreeNote(attached.pedigreeNote) : null,
      petKind: (isPetPostKind(product?.dealType) ? product?.dealType : kindFromLink ?? "adoption") as PetPostKind,
      fromAdoption: Boolean(kindFromLink),
      petInfo: parsePetInfo(product?.petInfo) ?? ({} as PetInfo),
      // '내 동네 보이기': 새 글은 켬, 가족 찾아요·임보 구해요 글을 고칠 땐 남긴 동네가 있을 때만 켬(§5.9).
      showRegion:
        !product || !showsPetRegion(product.dealType) || Boolean(product.regionSido && product.regionSigungu),
    };
  }, [product, initialFree, initialCategory, initialKind]);

  const [photos, setPhotos] = useState<ProductPhoto[]>(() => toRemoteProductPhotos(initial.photos));
  const [name, setName] = useState(initial.name);
  const [category, setCategory] = useState(initial.category);
  const [subcategory, setSubcategory] = useState(initial.subcategory);
  const [productType, setProductType] = useState(initial.productType);
  const [dealType, setDealType] = useState(initial.dealType);
  const [petKind, setPetKind] = useState<PetPostKind>(initial.petKind);
  const [petInfo, setPetInfo] = useState<PetInfo>(initial.petInfo);
  const [showRegion, setShowRegion] = useState(initial.showRegion);
  // 글에 남길 동네는 글 주인 프로필 동네다("서울 마포구"). 없으면 스위치 대신 설정 안내.
  const myRegionText = petRegionText(regionOf(user));
  // 강아지·고양이(하위분류)를 고르면 가격 없는 글이 된다.
  const isPet = isNoPriceCategory(subcategory);
  // 입양 쪽 글쓰기로 왔는데 아직 종을 안 골랐다(강아지·고양이 둘 다 고정). 고르기 전엔 종류·거래 유형·가격 칸을 숨긴다.
  const awaitingPetSpecies = initial.fromAdoption && category === "포유류" && !subcategory;
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
  // 거래 금지 종·신고 의무 동의(새 글만, 수정엔 없다 — 앱 products/upload.tsx 와 같다). 동의 시각은 저장하지 않는다.
  const [agreedTradeRules, setAgreedTradeRules] = useState(false);
  const [agreementError, setAgreementError] = useState("");
  const needsAgreement = !isEdit && !agreedTradeRules;
  const formRef = useRef<HTMLFormElement>(null);
  // 검증에 걸리면 스크린 리더에 첫 오류 문구를 읽어 준다(앱 AccessibilityInfo.announceForAccessibility).
  // 같은 문구로 다시 눌러도 읽히게 비웠다가 다음 틱에 넣는다.
  const [errorAnnouncement, setErrorAnnouncement] = useState("");
  const announceTimerRef = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (announceTimerRef.current != null) window.clearTimeout(announceTimerRef.current);
    },
    []
  );
  const announceError = (message: string) => {
    if (announceTimerRef.current != null) window.clearTimeout(announceTimerRef.current);
    setErrorAnnouncement("");
    if (!message) return;
    announceTimerRef.current = window.setTimeout(() => setErrorAnnouncement(message), 100);
  };
  const [submitStep, setSubmitStep] = useState<SubmitStep>("idle");
  const busy = submitStep !== "idle";

  // 임시저장(새 글만, 앱 products/upload.tsx·libs/client/composeDraft.ts 와 같다): 쓰던 분양글이 있으면 시트로 묻고,
  // 답한 뒤 1초마다 저장한다. 사진은 파일이라 저장하지 않는다.
  const draftUserId = isEdit ? null : (user?.id ?? null);
  const [draftPrompt, setDraftPrompt] = useState<ProductDraft | null>(null);
  const [draftReady, setDraftReady] = useState(isEdit);
  const draftCheckedRef = useRef(false);
  useEffect(() => {
    if (draftUserId == null || draftCheckedRef.current) return;
    draftCheckedRef.current = true;
    const draft = readComposeDraft("product", draftUserId);
    if (draft && (draft.name.trim() || draft.description.trim() || draft.productType)) setDraftPrompt(draft);
    else setDraftReady(true);
  }, [draftUserId]);
  const draftValue =
    !isEdit && (name.trim() || description.trim() || productType || bloodline.rootId != null)
      ? {
          name,
          price,
          category: subcategory || category,
          productType,
          // 강아지·고양이는 글 종류(분양해요·가족 찾아요·임보 구해요)를 dealType 자리에 둔다.
          dealType: isPet ? petKind : dealType,
          petInfo: isPet ? parsePetInfo(petInfo) : null,
          description,
          bloodlineRootId: bloodline.rootId,
          pedigreeNote: bloodline.rootId != null ? bloodline.note : null,
          // 웹 붙이기 행은 혈통 이름을 상태로 들고 있어 함께 둔다(앱은 목록에서 다시 찾는다).
          bloodlineName: bloodline.rootId != null ? bloodline.name : null,
        }
      : null;
  const draftAutosave = useComposeDraftAutosave("product", draftUserId, draftValue, draftReady && !busy);
  const resumeDraft = () => {
    if (draftPrompt) {
      const branch = findCategoryBranch(draftPrompt.category);
      setName(draftPrompt.name);
      setPrice(draftPrompt.price);
      setIsFree(draftPrompt.price === 0);
      setCategory(branch.parent);
      setSubcategory(branch.child);
      setProductType(draftPrompt.productType);
      if (isNoPriceCategory(branch.child)) {
        setPetKind(isPetPostKind(draftPrompt.dealType) ? draftPrompt.dealType : "adoption");
        setPetInfo(parsePetInfo(draftPrompt.petInfo) ?? {});
      } else {
        setDealType(draftPrompt.dealType);
      }
      setDescription(draftPrompt.description);
      if (draftPrompt.bloodlineRootId != null) {
        setBloodline({
          rootId: draftPrompt.bloodlineRootId,
          name: draftPrompt.bloodlineName ?? null,
          note: draftPrompt.pedigreeNote ?? {},
        });
      }
    }
    setDraftPrompt(null);
    setDraftReady(true);
  };
  const discardDraft = () => {
    if (draftUserId != null) deleteComposeDraft("product", draftUserId);
    setDraftPrompt(null);
    setDraftReady(true);
  };

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
    petKind !== initial.petKind ||
    petInfoKey(petInfo) !== petInfoKey(initial.petInfo) ||
    showRegion !== initial.showRegion ||
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
    const nextErrors = validateProductForm({
      name,
      price,
      description,
      // 하위분류(강아지·고양이 등)까지 넘겨야 가격 없는 글을 알아본다.
      category: subcategory || category,
      productType: isPet ? PET_PRODUCT_TYPE : productType,
    });
    if (awaitingPetSpecies) {
      delete nextErrors.productType;
      delete nextErrors.price;
      nextErrors.category = "강아지·고양이 중에 골라 주세요";
    }
    setErrors(nextErrors);
    const nextAgreementError = needsAgreement ? "동의해야 등록할 수 있어요" : "";
    setAgreementError(nextAgreementError);
    // 오류는 칸 아래 인라인 한 곳에만 둔다(2026-10-21 토스 디자인 리뷰 #5 — 토스트가 헤더를 덮던 문제도 함께 없앤다).
    const firstField = ERROR_FIELD_ORDER.find((field: ErrorField) =>
      field === "agreement" ? Boolean(nextAgreementError) : Boolean(nextErrors[field])
    );
    const firstMessage =
      firstField === "agreement" ? nextAgreementError : firstField ? nextErrors[firstField] : "";
    announceError(firstMessage ?? "");
    if (firstField) {
      formRef.current
        ?.querySelector(`[data-field="${firstField}"]`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
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
      const fields = isPet
        ? {
            // 강아지·고양이: 가격 없이 글 종류·정보를 보낸다(서버도 가격을 버린다, docs/prd/pet-space.md §5.6).
            name: name.trim(),
            price: null,
            description: description.trim(),
            photos: photoIds,
            category: subcategory || category,
            productType: PET_PRODUCT_TYPE,
            dealType: petKind,
            petInfo: parsePetInfo(petInfo),
            // 가족 찾아요·임보 구해요에서 켰고 프로필 동네가 있을 때만 true. 서버가 그때 프로필 동네를 복사한다(§5.9).
            showPetRegion: showsPetRegion(petKind) && myRegionText != null && showRegion,
            ...(isEdit ? { bloodlineRootId: null } : {}),
          }
        : {
            name: name.trim(),
            price,
            description: description.trim(),
            photos: photoIds,
            category: subcategory || category,
            productType,
            // 등록은 항상, 수정은 바꿨을 때만 보낸다(고를 수 없는 옛 값을 유료 분양으로 덮지 않게).
            // 강아지·고양이 글을 다른 종으로 바꿀 때도 보낸다(안 보내면 서버가 무료 분양으로 정한다).
            ...(!isEdit || dealType !== initial.dealType || isNoPriceCategory(initial.subcategory)
              ? { dealType }
              : {}),
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
        celebrate?: Celebrate | null;
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
        if (isPet) trackEvent(ANALYTICS_EVENTS.petPostCreate, { deal_type: petKind, category: subcategory });
        // 등록했으면 임시저장을 지운다(기다리던 저장도 버린다).
        draftAutosave.stop();
        if (draftUserId != null) deleteComposeDraft("product", draftUserId);
        if (!result.celebrate) toast.success("분양글이 등록되었습니다.");
        celebrateSheet.show(result.celebrate, () =>
          leave(() => router.replace(id ? getProductPath(id, fields.name) : "/"))
        );
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
  const writeLabels = productWriteLabels(isPet || awaitingPetSpecies ? petKind : null);
  const ctaLabel = isEdit ? "수정하기" : writeLabels.submit;
  useEffect(() => {
    if (!isEdit) onTitleChange?.(writeLabels.title);
  }, [isEdit, onTitleChange, writeLabels.title]);
  const showBloodlineRow = !isPet && productType === BLOODLINE_PRODUCT_TYPE;
  const bloodlineValue =
    bloodline.rootId != null ? formatBloodlineAttachValue(bloodline.name ?? "", bloodline.note) : "";

  return (
    <>
      <form
        ref={formRef}
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
        <div data-field="name">
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
        <div data-field="category">
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
                    onClick={() => {
                      setSubcategory(subcategory === sub ? "" : sub);
                      clearError("category");
                    }}
                  />
                ))}
              </ChipRow>
            ) : null}
          </fieldset>
          <ErrorText className="mt-0">{errors.category}</ErrorText>
        </div>

        {isPet ? (
          // 강아지·고양이: 글 종류 + 정보 칸(시안 pet-space ⑤). 종류·거래 유형·혈통·가격 칸은 없다.
          <PetPostFields
            kind={petKind}
            onKindChange={setPetKind}
            info={petInfo}
            onInfoChange={setPetInfo}
            region={myRegionText}
            showRegion={showRegion}
            onShowRegionChange={setShowRegion}
            disabled={busy}
          />
        ) : awaitingPetSpecies ? (
          // 오류('강아지·고양이 중에 골라 주세요')가 떠 있으면 같은 말이라 안내는 숨긴다.
          errors.category ? null : (
            <p className="-mt-3 break-keep text-[13px] leading-[18px] text-app-muted">
              강아지·고양이를 고르면 글 종류와 아이 정보를 적는 칸이 나와요.
            </p>
          )
        ) : (
          <>
            {/* 상품 타입 */}
            <div data-field="productType">
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
            </div>

            {/* 거래 유형(유료 분양/무료 분양) — 앱 ProductDealTypeSegment. 파양은 1단계 비노출. */}
            <SegmentField
              label="거래 유형"
              options={DEAL_TYPE_OPTIONS}
              value={dealType}
              disabled={busy}
              onChange={setDealType}
            />
          </>
        )}

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

        {/* 가격(강아지·고양이는 없다) */}
        {isPet || awaitingPetSpecies ? null : (
        <div className="-mt-1.5" data-field="price">
          <div className="mb-0.5 flex h-11 items-center justify-between">
            <span className="text-[15px] font-semibold text-app-text">가격</span>
            <FilterChip label="무료 분양" selected={isFree} onClick={toggleFree} />
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
            <p className="mt-1.5 text-[13px] text-app-muted">0원은 무료 분양으로 등록돼요</p>
          )}
        </div>
        )}

        {/* 상품 설명 */}
        <div data-field="description">
          <FieldLabel
            label="설명"
            count={`${description.length.toLocaleString("ko-KR")}/${PRODUCT_DESCRIPTION_MAX_LENGTH.toLocaleString("ko-KR")}`}
          />
          <MarkdownEditor
            id="description"
            value={description}
            onChange={(value) => {
              setDescription(value);
              clearError("description");
            }}
            placeholder={
              isPet || awaitingPetSpecies
                ? petDescriptionPlaceholder(petKind, subcategory)
                : "사육 정보, 상태, 거래 방식 등 입양자가 궁금할 내용을 구체적으로 작성해주세요."
            }
            rows={9}
            hasError={Boolean(errors.description)}
          />
          <ErrorText>{errors.description}</ErrorText>
        </div>

        {/* 거래 금지 종·신고 의무 동의(새 글만, 등록 버튼 바로 위). 경매 '운영 룰 동의' 체크와 같은 모양 */}
        {isEdit ? null : (
          <div data-field="agreement">
            <div className="flex items-start gap-3">
              {/* 단어 중간에서 줄이 끊기지 않게(word-break 는 상속된다) */}
              <div className="min-w-0 flex-1 break-keep">
                <AgreeRow
                  checked={agreedTradeRules}
                  onToggle={() => {
                    setAgreedTradeRules((prev) => !prev);
                    setAgreementError("");
                  }}
                  label="분양할 수 없는 종이 아니에요. 필요한 신고도 할게요"
                />
              </div>
              {/* 웹은 화면을 쌓아 둘 수 없어 쓰던 폼을 두고 새 탭으로 연다(경매 툴 '룰 전체 보기'와 같다). */}
              <Link
                href="/content/community-rules"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="이용 규칙 자세히 보기"
                className="shrink-0 text-[14px] font-semibold leading-[22px] text-app-brand"
              >
                자세히
              </Link>
            </div>
            <ErrorText>{agreementError}</ErrorText>
          </div>
        )}

        {/* 스크린 리더 전용 오류 안내(화면에는 칸 아래 문구만 보인다) */}
        <p className="sr-only" role="alert" aria-atomic="true">
          {errorAnnouncement}
        </p>

        {/* 하단 고정 CTA */}
        <div className="fixed inset-x-0 bottom-0 mx-auto max-w-xl z-30 border-t border-app-line bg-app-bg pb-[env(safe-area-inset-bottom)]">
          <div className="mx-auto max-w-xl px-5 py-2">
            <button
              type="submit"
              aria-label={ctaLabel}
              aria-disabled={busy}
              disabled={busy}
              className={cn(
                "flex h-[52px] w-full items-center justify-center rounded-md text-[16px] font-semibold",
                // 동의 전·빈 칸이 있어도 꺼진 색으로 두지 않는다. 누르면 첫 오류 칸으로 데려간다(요청은 보내지 않는다).
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
      <ComposeDraftSheet
        open={draftPrompt !== null}
        title={draftPrompt?.name ?? ""}
        savedAt={draftPrompt?.savedAt ?? ""}
        onResume={resumeDraft}
        onDiscard={discardDraft}
      />
      {dialog}
      {celebrateSheet.sheet}
    </>
  );
}

export default ProductForm;
