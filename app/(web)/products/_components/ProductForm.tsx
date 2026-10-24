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
import {
  PetKindField,
  PetPostFields,
  PetRegionRow,
  PetSpeciesField,
  petInputClassName,
} from "@components/features/pet/PetPostFields";
import { PetKindCards, PetWriteHeading, PetWriteProgress } from "@components/features/pet/PetWriteSteps";
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
  PET_WRITE_STEP_TITLES,
  isNoPriceCategory,
  isPetPostKind,
  kstToday,
  newPetWriteAttemptId,
  parsePetInfo,
  petDescriptionPlaceholder,
  petInfoError,
  petPostKindLabel,
  petRegionText,
  petTitlePlaceholder,
  petWritePrevStep,
  petWriteStartStep,
  productWriteLabels,
  showsPetRegion,
  tradeRulesAgreementLabel,
  type PetInfo,
  type PetPostKind,
  type PetWriteStep,
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
const ERROR_FIELD_ORDER = ["name", "category", "petInfo", "productType", "price", "description", "agreement"] as const;
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
 * (docs/prd/pet-space.md §5.5 — 가격은 받지도 보내지도 않는다). 강아지·고양이 글 수정은 '어떤 글인가요?'를 사진 위
 * 맨 위에 두고 카테고리를 한 줄로 접는다(시안 ⑤).
 * 강아지·고양이 글로 연 새 글쓰기(입양 쪽·강아지·고양이만 고정·종 링크)는 세 단계로 나눈다(§5.11, 시안 pet-space/B-toss.html ④ —
 * 토스 리뷰 결정 A): ① 어떤 글인가요 카드 → ② 사진·종·아이 정보 → ③ 제목·설명·동네·동의. 헤더는 뒤로만 두고 아래에 단계 막대,
 * 뒤로(헤더·브라우저)는 한 단계 앞으로 간다. 상태·저장은 한 화면과 같다(단계는 보이는 칸만 나눈다).
 */
export function ProductForm({
  product,
  initialFree = false,
  initialCategory,
  initialKind,
  kindPicked = false,
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
  /** 링크가 글 종류를 정해 왔다(?kind=). 단계 글쓰기를 ②부터 연다 — 고정 범위 기본값(petWriteDefaults)은 ①에서 고른다. */
  kindPicked?: boolean;
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
      // 글 종류를 정하고 들어왔다(입양 쪽 글쓰기, 강아지·고양이만 고정한 사람의 글쓰기 — UploadClient).
      fromAdoption: Boolean(kindFromLink),
      // 강아지·고양이 글로 열었다: '어떤 글인가요?'를 맨 위에 둔다(2026-10-23 코덱스 디자인 리뷰 결정 A, 시안 ⑤).
      // 처음 연 때만 정한다 — 분양 글쓰기에서 카테고리를 강아지로 바꿨다고 사진 위에 칸이 생기면 보던 자리가 밀린다.
      petFirst: Boolean(kindFromLink) || isNoPriceCategory(branch.child),
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
  const kindOnTop = initial.petFirst && (isPet || awaitingPetSpecies);
  // 맨 위에 글 종류를 둔 강아지·고양이 글은 카테고리를 '카테고리 강아지 ›' 한 줄로 접고, 누르면 칩을 펼친다.
  // 처음부터 종을 알 때만 접는다 — 여기서 종을 고르는 사람에겐 펼친 채로 둔다(누르던 칩이 사라지지 않게).
  const [categoryOpen, setCategoryOpen] = useState(() => !isNoPriceCategory(initial.subcategory));
  const categoryCollapsed = kindOnTop && isPet && !categoryOpen;
  // 임보·가족 찾기 글이면 헤더 '글쓰기'·버튼 '글 올리기', 완료·실패 문구는 '분양글' 대신 '글'(productWriteLabels).
  const writeLabels = productWriteLabels(isPet || awaitingPetSpecies ? petKind : null);
  // 강아지·고양이 글로 연 새 글쓰기는 세 단계(§5.11). 임시저장에서 다른 종 글을 이어 쓰면 한 화면으로 돌아간다.
  const [stepMode, setStepMode] = useState(() => !product && initial.petFirst);
  const [step, setStep] = useState<PetWriteStep>(() => petWriteStartStep(kindPicked));
  const goStep = (next: PetWriteStep) => {
    setStep(next);
    window.scrollTo({ top: 0 });
  };
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
      if (stepMode) {
        // 단계는 강아지·고양이 글만 — 다른 종 글을 이어 쓰면 한 화면으로, 강아지·고양이 글이면 고른 글 종류로 ②부터.
        if (!isNoPriceCategory(branch.child)) setStepMode(false);
        else if (step === 1) goStep(2);
      }
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
  // 단계 글쓰기 ②·③에선 아무것도 안 적어도 뒤로가기를 받아 한 단계 앞으로 보낸다(①에서 뒤로 가면 닫힌다).
  const stepBackActive = stepMode && step > 1;
  const { leave, dialog } = useConfirmLeave((dirty || stepBackActive) && submitStep !== "submit", {
    onBack: () => {
      const prev = stepMode && !busy ? petWritePrevStep(step) : null;
      if (!prev) return false;
      goStep(prev);
      return true;
    },
  });

  // 단계마다 몇 번의 글쓰기가 남는지 본다(docs/prd/pet-space.md §10). 글 종류는 ①에서 고른 뒤(②·③)만 싣는다.
  // ②·③엔 글 종류 칸이 없어 글 종류는 ①에서 카드를 누를 때(단계와 함께)만 바뀐다.
  // attempt_id 는 이 폼을 연 한 번의 글쓰기(pet_post_create 에도 같이 싣는다).
  const [attemptId] = useState(() => newPetWriteAttemptId());
  useEffect(() => {
    if (!stepMode) return;
    trackEvent(
      ANALYTICS_EVENTS.petWriteStep,
      step > 1 ? { step, kind: petKind, attempt_id: attemptId } : { step, attempt_id: attemptId }
    );
  }, [stepMode, step, petKind, attemptId]);

  const clearError = (field: keyof ProductFormErrors) =>
    setErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });

  // 글 종류마다 동의 문구가 달라서(임보 구해요는 맡기는 사람의 약속) 사람이 종류를 바꾸면 동의를 다시 받는다.
  const changePetKind = (kind: PetPostKind) => {
    if (kind === petKind) return;
    setPetKind(kind);
    setAgreedTradeRules(false);
    clearError("petInfo");
  };
  const changePetInfo = (next: PetInfo) => {
    setPetInfo(next);
    clearError("petInfo");
  };
  /** 임보 구해요의 기간·날짜 검사(서버와 같은 petInfoError). 고치는 글은 저장된 날짜를 그대로 두면 지났어도 받는다. */
  const currentPetInfoError = () =>
    isPet || awaitingPetSpecies
      ? petInfoError(petKind, parsePetInfo(petInfo), {
          today: kstToday(),
          keptUntil: parsePetInfo(initial.petInfo)?.fosterUntil ?? null,
        })
      : null;

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
      toast.info(`사진은 ${PRODUCT_PHOTOS_MAX}장까지 올릴 수 있어요`);
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
    const petError = currentPetInfoError();
    if (petError) nextErrors.petInfo = petError;
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
    if (firstField && stepMode && (firstField === "category" || firstField === "petInfo") && step !== 2) {
      // 단계 글쓰기: 종·임보 기간(②의 칸)이 비었으면 ②로 돌아가 칸 아래 문구로 알린다.
      goStep(2);
      return;
    }
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
          result?.error ||
            result?.message ||
            (isEdit
              ? `${writeLabels.noun}을 수정하지 못했어요. 다시 시도해 주세요`
              : `${writeLabels.noun}을 올리지 못했어요. 다시 시도해 주세요`)
        );
      }

      // 홈·상품 목록·프로필 내역·상세를 다시 받는다.
      void globalMutate(
        (key) => typeof key === "string" && /^(\$inf\$)?\/api\/(products|users\/)/.test(key)
      );
      succeeded = true;
      if (isEdit) {
        toast.success(`${writeLabels.noun}을 수정했어요`);
        const path = getProductPath(product!.id, fields.name);
        leave(() => {
          router.replace(path);
          router.refresh();
        });
      } else {
        const id = result.product?.id;
        if (isPet) {
          trackEvent(ANALYTICS_EVENTS.petPostCreate, {
            deal_type: petKind,
            category: subcategory,
            attempt_id: attemptId,
          });
        }
        // 등록했으면 임시저장을 지운다(기다리던 저장도 버린다).
        draftAutosave.stop();
        if (draftUserId != null) deleteComposeDraft("product", draftUserId);
        if (!result.celebrate) toast.success(`${writeLabels.noun}을 올렸어요`);
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
            ? `${writeLabels.noun}을 수정하지 못했어요. 다시 시도해 주세요`
            : `${writeLabels.noun}을 올리지 못했어요. 다시 시도해 주세요`
      );
    } finally {
      if (!succeeded) setSubmitStep("idle");
    }
  };

  const subcategories = category ? getSubcategories(category) : [];
  const selectedCategoryLabel =
    subcategory || TOP_LEVEL_CATEGORIES.find((cat) => cat.id === category)?.name || "";
  const uploadedCount = photos.filter((photo) => photo.remoteId).length;
  // 단계 글쓰기 ②는 '다음', ③은 글 종류에 맞는 등록 버튼. 헤더 제목은 비운다(단계 제목이 화면에 있다, 시안 ④).
  const ctaLabel = isEdit ? "수정하기" : stepMode && step === 2 ? "다음" : writeLabels.submit;
  useEffect(() => {
    if (!isEdit) onTitleChange?.(stepMode ? "" : writeLabels.title);
  }, [isEdit, onTitleChange, writeLabels.title, stepMode]);

  /** 단계 글쓰기 ② '다음': 종과 임보 구해요의 기간만 꼭 고른다(나머지 정보 칸은 선택). */
  const nextFromInfo = () => {
    const missing = awaitingPetSpecies
      ? { field: "category" as const, message: "강아지·고양이 중에 골라 주세요" }
      : (() => {
          const message = currentPetInfoError();
          return message ? { field: "petInfo" as const, message } : null;
        })();
    if (missing) {
      setErrors((prev) => ({ ...prev, [missing.field]: missing.message }));
      announceError(missing.message);
      formRef.current
        ?.querySelector(`[data-field="${missing.field}"]`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    goStep(3);
  };
  const showBloodlineRow = !isPet && productType === BLOODLINE_PRODUCT_TYPE;
  const bloodlineValue =
    bloodline.rootId != null ? formatBloodlineAttachValue(bloodline.name ?? "", bloodline.note) : "";

  // 사진·제목·설명·동의 칸은 한 화면과 단계 글쓰기가 같이 쓴다(단계에선 채움 입력칸, 시안 pet-space/B-toss.html ④).
  const photosField = (
    <PhotoGridEditor
      photos={photos}
      onChange={(next) => setPhotos(next as ProductPhoto[])}
      max={PRODUCT_PHOTOS_MAX}
      onAdd={addFiles}
      disabled={busy}
      filled={stepMode}
    />
  );

  const titleField = (
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
        // 강아지·고양이 글은 글 종류에 맞는 예시(라벨과 같은 '제목'은 안내가 안 된다, 2026-10-23 토스 디자인 리뷰).
        placeholder={isPet || awaitingPetSpecies ? petTitlePlaceholder(petKind, subcategory) : "제목"}
        aria-label="제목"
        aria-invalid={Boolean(errors.name)}
        className={petInputClassName({ filled: stepMode, error: Boolean(errors.name) })}
      />
      <ErrorText>{errors.name}</ErrorText>
    </div>
  );

  // 강아지·고양이 글을 종을 알고 열었으면 카테고리를 '카테고리 강아지 ›' 한 줄로 접는다(누르면 펼친다).
  const collapsedCategoryRow = (
    <div data-field="category">
      <button
        type="button"
        disabled={busy}
        aria-expanded={false}
        aria-label={`카테고리 ${selectedCategoryLabel}, 바꾸기`}
        onClick={() => setCategoryOpen(true)}
        className="-my-2 flex h-14 w-full min-w-0 items-center gap-1 text-left disabled:opacity-50"
      >
        <span className="shrink-0 text-[15px] font-semibold text-app-text">카테고리</span>
        <span className="ml-auto min-w-0 truncate pl-3 text-[15px] text-app-text">{selectedCategoryLabel}</span>
        <ChevronRightIcon className="h-[18px] w-[18px] shrink-0 text-app-caption" />
      </button>
    </div>
  );

  // 강아지·고양이: 글 종류 + 정보 칸(시안 pet-space ⑤). 종류·거래 유형·혈통·가격 칸은 없다. 단계 글쓰기는 동네를 ③에 둔다.
  const petFields = (
    <PetPostFields
      kind={petKind}
      onKindChange={changePetKind}
      showKind={!kindOnTop}
      showRegionRow={!stepMode}
      filled={stepMode}
      info={petInfo}
      onInfoChange={changePetInfo}
      fosterError={errors.petInfo}
      region={myRegionText}
      showRegion={showRegion}
      onShowRegionChange={setShowRegion}
      disabled={busy}
    />
  );

  const descriptionField = (
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
        rows={stepMode ? 10 : 9}
        hasError={Boolean(errors.description)}
        simple={isPet || awaitingPetSpecies}
        filled={stepMode}
      />
      <ErrorText>{errors.description}</ErrorText>
    </div>
  );

  // 동의(새 글만, 등록 버튼 바로 위). 경매 '운영 룰 동의' 체크와 같은 모양. 강아지·고양이 글은 2개월·영리 분양 문구(결정 D),
  // 임보 구해요는 맡기는 사람의 약속(tradeRulesAgreementLabel).
  const agreementField = isEdit ? null : (
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
            label={tradeRulesAgreementLabel(isPet || awaitingPetSpecies ? petKind : null)}
          />
        </div>
        {/* 웹은 화면을 쌓아 둘 수 없어 쓰던 폼을 두고 새 탭으로 연다(경매 툴 '룰 전체 보기'와 같다). */}
        <Link
          href="/content/community-rules"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="이용 규칙 자세히 보기"
          // 주황은 주 버튼·선택 상태만(REFERENCE.md) — 보조 링크는 회색 밑줄 글자(2026-10-23 토스 디자인 리뷰).
          className="shrink-0 text-[13px] leading-[22px] text-app-muted underline underline-offset-[3px]"
        >
          자세히
        </Link>
      </div>
      <ErrorText>{agreementError}</ErrorText>
    </div>
  );

  /** 단계 글쓰기 화면(① 글 종류 · ② 사진·종·정보 · ③ 제목·설명·동네·동의). */
  const renderStep = () => {
    if (step === 1) {
      return (
        <>
          <PetWriteHeading title={PET_WRITE_STEP_TITLES[1]} />
          <PetKindCards
            disabled={busy}
            onPick={(kind) => {
              changePetKind(kind);
              goStep(2);
            }}
          />
        </>
      );
    }
    const caption = petPostKindLabel(petKind);
    if (step === 2) {
      return (
        <>
          <PetWriteHeading caption={caption} title={PET_WRITE_STEP_TITLES[2]} />
          <div>
            <p className="mb-0.5 text-[15px] font-semibold leading-[22px] text-app-text">
              사진<span className="font-normal text-app-muted"> · {PRODUCT_PHOTOS_MAX}장까지</span>
            </p>
            {photosField}
          </div>
          {categoryCollapsed ? (
            collapsedCategoryRow
          ) : (
            <div data-field="category">
              <PetSpeciesField
                value={subcategory}
                disabled={busy}
                error={errors.category}
                onChange={(species) => {
                  setCategory("포유류");
                  setSubcategory(species);
                  clearError("category");
                }}
              />
            </div>
          )}
          {petFields}
        </>
      );
    }
    return (
      <>
        <PetWriteHeading caption={caption} title={PET_WRITE_STEP_TITLES[3]} />
        {titleField}
        {descriptionField}
        {showsPetRegion(petKind) ? (
          <PetRegionRow region={myRegionText} on={showRegion} onChange={setShowRegion} disabled={busy} />
        ) : null}
      </>
    );
  };

  return (
    <>
      {stepMode ? <PetWriteProgress step={step} /> : null}
      <form
        ref={formRef}
        onSubmit={(event) => {
          event.preventDefault();
          // 단계 글쓰기 ①은 카드로만 넘어가고, ②에서 Enter 는 '다음'과 같다.
          if (stepMode && step === 1) return;
          if (stepMode && step === 2) {
            nextFromInfo();
            return;
          }
          void submit();
        }}
        className={cn(
          "flex flex-col gap-5",
          !stepMode
            ? "px-5 pb-[calc(52px+40px+56px+env(safe-area-inset-bottom))] pt-5"
            : step === 1
              ? "px-4 pb-10 pt-7"
              : "px-4 pb-[calc(52px+40px+56px+env(safe-area-inset-bottom))] pt-6"
        )}
        noValidate
      >
        {stepMode ? (
          renderStep()
        ) : (
          <>
            {/* 강아지·고양이 글 수정: 글 종류 먼저(시안 ⑤) */}
            {kindOnTop ? <PetKindField kind={petKind} onKindChange={changePetKind} disabled={busy} /> : null}

            {/* 사진 */}
            {photosField}

            {/* 상품명 */}
            {titleField}

            {/* 카테고리 — 강아지·고양이 글 수정은 한 줄로 접는다(누르면 칩을 펼친다) */}
            {categoryCollapsed ? (
              collapsedCategoryRow
            ) : (
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
            )}

            {isPet ? (
              petFields
            ) : awaitingPetSpecies ? (
              // 오류('강아지·고양이 중에 골라 주세요')가 떠 있으면 같은 말이라 안내는 숨긴다.
              errors.category ? null : (
                <p className="-mt-3 break-keep text-[13px] leading-[18px] text-app-muted">
                  강아지·고양이를 고르면 아이 정보를 적는 칸이 나와요.
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

            {descriptionField}

          </>
        )}

        {/* 스크린 리더 전용 오류 안내(화면에는 칸 아래 문구만 보인다) */}
        <p className="sr-only" role="alert" aria-atomic="true">
          {errorAnnouncement}
        </p>

        {/* 하단 고정 CTA(단계 글쓰기 ①은 카드가 곧 버튼이라 없다) */}
        {stepMode && step === 1 ? null : (
          <div className="fixed inset-x-0 bottom-0 mx-auto max-w-xl z-30 border-t border-app-line bg-app-bg pb-[env(safe-area-inset-bottom)]">
            <div className={cn("mx-auto max-w-xl py-2", stepMode ? "px-4" : "px-5")}>
              {/* 동의는 버튼 바로 위에 붙여 둔다(2026-10-24 사용자 — 본문 끝에 두면 고정 버튼 아래로 밀려 보였다). ②의 '다음'엔 없다. */}
              {stepMode && step === 2 ? null : agreementField ? <div className="pb-2">{agreementField}</div> : null}
              <button
                type="submit"
                aria-label={ctaLabel}
                aria-disabled={busy}
                disabled={busy}
                className={cn(
                  "flex h-[52px] w-full items-center justify-center text-[16px] font-semibold",
                  stepMode ? "rounded-lg" : "rounded-md",
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
        )}
      </form>

      {busy ? (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center" role="status">
          <div className="absolute inset-0 bg-app-bg opacity-[0.72]" aria-hidden="true" />
          <span className="relative h-9 w-9 animate-spin rounded-full border-[3px] border-app-border border-t-app-brand" />
          <p className="relative mt-3 text-[15px] font-semibold text-app-text">
            {submitStep === "images"
              ? `사진을 올리고 있어요${photos.length ? ` (${uploadedCount}/${photos.length})` : ""}`
              : isEdit
                ? `${writeLabels.noun}을 수정하고 있어요`
                : `${writeLabels.noun}을 올리고 있어요`}
          </p>
          <p className="relative mt-1.5 text-[13px] text-app-muted">화면을 닫지 말고 잠시만 기다려 주세요</p>
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
