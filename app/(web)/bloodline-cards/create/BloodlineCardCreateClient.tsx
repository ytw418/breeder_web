"use client";

/**
 * 혈통 만들기·수정 — 기존 웹 톤(A안) 유지, 혈통 v2 입력 규칙만 맞춘다(설계 §4.4 WB-3, PRD S-9·S-3e).
 * 원본: bredy_app src/components/features/bloodline/BloodlineFormScreen.tsx
 * 라우트: 만들기 /bloodline-cards/create, 수정 /bloodline-management/card/{id}/edit(editCardId).
 *
 * 헤더(뒤로 + 제목 18/700) → 단일 폼: 혈통 이름(공유 규칙, 띄어쓰기 허용) → 종(필수, 분류 → 종 2단 select,
 * `/api/categories`) → 사진(필수 1장) → 산지(선택, 시·도 → 시·군·구 select) → 혈통 소개(선택)
 * → 하단 고정 52 주황 CTA "혈통 만들기"/"저장". 카드 스타일·생성 확인창은 없다(만들기는 되돌릴 수 있다).
 * - 사진은 고르면 정사각형 자르기 창(SquareImageCropper)을 거쳐 올린다(상세 사진이 1:1, 2026-10-09 사용자 결정).
 * - 수정: 이름은 바꿀 수 없어 잠근다. 사진은 바꿀 수만 있다(삭제 X 없음). 바뀐 칸만 PATCH 한다
 *   (libs/shared/bloodline-edit.ts, 앱과 같은 규칙). 고칠 수 있는 사람은 만든 사람 = 지금 보유자.
 * 서버 오류는 errorCode 로 칸에 붙인다(중복 이름 → 이름 칸).
 */
import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import useSWR, { useSWRConfig } from "swr";
import { authFetch } from "@libs/client/authFetch";
import { BLOODLINE_LIST_KEY_PREFIXES, revalidateByPrefix } from "@libs/client/swrRevalidate";
import { toast } from "@libs/client/toast";
import Layout from "@components/features/MainLayout";
import SquareImageCropper from "@components/features/bloodline/SquareImageCropper";
import { Input } from "@components/ui/input";
import { Textarea } from "@components/ui/textarea";
import {
  BloodlineBottomBar,
  BloodlineBottomBarSpacer,
  BloodlineHeader,
  BloodlinePrimaryButton,
  BloodlineSpinner,
  bloodlineErrorText,
  bloodlineInputClass,
  bloodlineSelectClass,
  bloodlineTextareaClass,
  useBloodlineLoginRedirect,
} from "@components/features/bloodline/BloodlineScreenParts";
import useUser from "hooks/useUser";
import type {
  BloodlineCardDetailResponse,
  BloodlineCardItem,
  BloodlineCardPatchResponse,
  BloodlineCardsResponse,
  CreateBloodlineCardBody,
} from "@libs/shared/bloodline-card";
import {
  bloodlineEditPatch,
  canEditBloodline,
  type BloodlineFormInitial,
} from "@libs/shared/bloodline-edit";
import { normalizeDeletedUserNames } from "@libs/shared/deletedUser";
import type { CategoriesResponse, CategoryItem } from "@libs/shared/categories";
import { BLOODLINE_ERRORS, type BloodlineErrorCode } from "@libs/shared/bloodline-errors";
import {
  BLOODLINE_NAME_HELP,
  BLOODLINE_NAME_MAX_LENGTH,
  BLOODLINE_NAME_RULE_MESSAGE,
  validateBloodlineName,
} from "@libs/shared/bloodline-names";
import { REGIONS } from "@libs/shared/regions";
import { cn, makeImageUrl } from "@libs/client/utils";

const DESCRIPTION_MAX_LENGTH = 300;
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
const ALLOWED_IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif"] as const;

const SPECIES_REQUIRED_MESSAGE = BLOODLINE_ERRORS.BLOODLINE_SPECIES_REQUIRED.message;
const NAME_LOCKED_MESSAGE = "혈통 이름은 바꿀 수 없어요";
const IMAGE_REQUIRED_MESSAGE = BLOODLINE_ERRORS.BLOODLINE_IMAGE_REQUIRED.message;

/** 서버 오류 코드 → 오류를 붙일 칸. 목록 밖은 폼 위 오류. */
const FIELD_BY_ERROR: Partial<Record<BloodlineErrorCode, "name" | "species" | "image" | "origin">> = {
  BLOODLINE_INVALID_NAME: "name",
  BLOODLINE_DUPLICATE_NAME: "name",
  BLOODLINE_SPECIES_REQUIRED: "species",
  BLOODLINE_INVALID_SPECIES: "species",
  BLOODLINE_IMAGE_REQUIRED: "image",
  BLOODLINE_INVALID_ORIGIN: "origin",
};

const bySortOrder = (a: CategoryItem, b: CategoryItem) => a.sortOrder - b.sortOrder || a.id - b.id;

const getFileExtension = (name: string) => {
  const pointIndex = name.lastIndexOf(".");
  return pointIndex === -1 ? "" : name.slice(pointIndex).toLowerCase();
};

function FieldLabel({ label, count, htmlFor }: { label: string; count?: string; htmlFor?: string }) {
  const labelClass = "text-[15px] font-semibold tracking-[-0.2px] text-app-text";
  return (
    <div className="mb-2 flex items-center justify-between">
      {htmlFor ? (
        <label htmlFor={htmlFor} className={labelClass}>
          {label}
        </label>
      ) : (
        <span className={labelClass}>{label}</span>
      )}
      {count ? <span className="text-[13px] text-app-muted">{count}</span> : null}
    </div>
  );
}

function FieldError({ id, message }: { id?: string; message: string }) {
  return (
    <p id={id} role="alert" className="mt-1.5 text-[13px] tracking-[-0.2px] text-app-danger">
      {message}
    </p>
  );
}

function FieldHelp({ children }: { children: string }) {
  return <p className="mt-1.5 text-[13px] tracking-[-0.2px] text-app-muted">{children}</p>;
}

function CameraIcon() {
  return (
    <svg width={22} height={22} viewBox="0 0 24 24" fill="none" aria-hidden="true" className="text-app-muted">
      <path
        d="M4 8.5A1.5 1.5 0 015.5 7h1.8l1.1-1.8h5.2L14.7 7h3.8A1.5 1.5 0 0120 8.5v9A1.5 1.5 0 0118.5 19h-13A1.5 1.5 0 014 17.5v-9z"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12 15.5a2.8 2.8 0 100-5.6 2.8 2.8 0 000 5.6z"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** 수정할 혈통 상세(상세 화면과 같은 키·모양). 오류면 던진다. */
async function fetchBloodlineDetail(url: string): Promise<BloodlineCardDetailResponse> {
  const response = await authFetch(url);
  const payload = (await response.json().catch(() => null)) as BloodlineCardDetailResponse | null;
  if (!response.ok || !payload?.success) {
    throw new Error(bloodlineErrorText(payload, "혈통을 불러오지 못했어요"));
  }
  return normalizeDeletedUserNames(payload);
}

/** 수정 초기값(뿌리 혈통). */
function toFormInitial(card: BloodlineCardItem): BloodlineFormInitial {
  return {
    name: card.name,
    speciesType: card.speciesType?.trim() || null,
    imageId: card.image?.trim() || null,
    description: card.description,
    origin: card.originSido
      ? { sido: card.originSido, ...(card.originSigungu ? { sigungu: card.originSigungu } : {}) }
      : null,
  };
}

async function uploadCardImage(file: File) {
  const fileApiResponse = await authFetch("/api/files");
  if (!fileApiResponse.ok) throw new Error("이미지 업로드 URL을 가져오지 못했습니다.");
  const fileApiResult = (await fileApiResponse.json().catch(() => null)) as {
    uploadURL?: string;
    id?: string;
  } | null;
  if (!fileApiResult?.uploadURL) throw new Error("이미지 업로드 URL을 확인하지 못했습니다.");

  const formData = new FormData();
  formData.append("file", file, file.name || "bloodline-card-image");
  const uploadResponse = await fetch(fileApiResult.uploadURL, { method: "POST", body: formData });
  const uploadResult = (await uploadResponse.json().catch(() => null)) as {
    success?: boolean;
    result?: { id?: string };
  } | null;
  const uploadedImage = uploadResult?.result?.id || fileApiResult.id;
  if (!uploadResponse.ok || !uploadedImage || uploadResult?.success === false) {
    throw new Error("이미지 업로드에 실패했습니다.");
  }
  return uploadedImage;
}

export default function BloodlineCardCreateClient({ editCardId }: { editCardId?: number } = {}) {
  const { user, isLoading: userLoading } = useUser();
  const router = useRouter();
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const { mutate: globalMutate, cache: swrCache } = useSWRConfig();
  const isEdit = typeof editCardId === "number";
  const title = isEdit ? "혈통 수정" : "혈통 만들기";
  const detailKey = isEdit ? `/api/bloodline-cards/${editCardId}` : null;

  const [cardName, setCardName] = useState("");
  const [speciesGroup, setSpeciesGroup] = useState("");
  const [speciesName, setSpeciesName] = useState("");
  const [originSido, setOriginSido] = useState("");
  const [originSigungu, setOriginSigungu] = useState("");
  const [cardDescription, setCardDescription] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState("");
  // 고르는 즉시 업로드한다(앱 pickImage). 업로드 중에는 CTA 를 막는다.
  const [imageId, setImageId] = useState("");
  const [imageUploading, setImageUploading] = useState(false);
  const uploadSeqRef = useRef(0);
  const [nameError, setNameError] = useState("");
  const [speciesError, setSpeciesError] = useState("");
  const [imageError, setImageError] = useState("");
  const [originError, setOriginError] = useState("");
  const [formError, setFormError] = useState("");
  const [creating, setCreating] = useState(false);
  /** 자르기 창에 띄운 원본(고른 직후). 완료하면 잘린 파일을 올린다. */
  const [cropFile, setCropFile] = useState<File | null>(null);

  const loggedOut = !user && !userLoading;
  useBloodlineLoginRedirect(
    loggedOut,
    isEdit ? `/bloodline-management/card/${editCardId}/edit` : "/bloodline-cards/create"
  );

  // ── 수정: 뿌리 혈통을 받아 칸을 한 번 채운다 ──
  const detailQuery = useSWR<BloodlineCardDetailResponse>(user ? detailKey : null, fetchBloodlineDetail, {
    shouldRetryOnError: false,
    revalidateOnFocus: false,
  });
  const openedCard = detailQuery.data?.card ?? null;
  const editRoot = openedCard?.cardType === "LINE" ? detailQuery.data?.bloodlineSourceCard ?? null : openedCard;
  const canEdit = canEditBloodline(editRoot, user?.id);
  const [editInitial, setEditInitial] = useState<BloodlineFormInitial | null>(null);

  // 종 선택지: 노출 카테고리 트리(강아지·고양이 포함). 상위 → 하위 2단이고, 하위가 없는 상위(기타)는 그 자체가 종이다.
  const categoriesQuery = useSWR<CategoriesResponse>("/api/categories");
  const categoryList = categoriesQuery.data?.categories;
  const speciesGroups = useMemo(
    () => (categoryList ?? []).filter((item) => item.parentId === null).sort(bySortOrder),
    [categoryList]
  );
  const selectedGroup = speciesGroups.find((item) => item.name === speciesGroup) ?? null;
  const speciesOptions = useMemo(
    () =>
      selectedGroup
        ? (categoryList ?? []).filter((item) => item.parentId === selectedGroup.id).sort(bySortOrder)
        : [],
    [categoryList, selectedGroup]
  );
  const speciesType = selectedGroup
    ? speciesOptions.length > 0
      ? speciesName
      : selectedGroup.name
    : "";
  const categoriesFailed = Boolean(categoriesQuery.error) && !categoriesQuery.data;
  const sigunguOptions = REGIONS.find((region) => region.sido === originSido)?.sigungu ?? [];

  // 종 2단 select 는 카테고리 트리가 있어야 채울 수 있어 둘 다 온 뒤 한 번만 채운다.
  useEffect(() => {
    if (!isEdit || editInitial || !editRoot || !canEdit || !categoryList) return;
    const initial = toFormInitial(editRoot);
    const category = categoryList.find((item) => item.name === initial.speciesType);
    const parent = category?.parentId != null ? categoryList.find((item) => item.id === category.parentId) : null;
    setEditInitial(initial);
    setCardName(initial.name);
    setSpeciesGroup(parent ? parent.name : category?.name ?? "");
    setSpeciesName(parent && category ? category.name : "");
    setOriginSido(initial.origin?.sido ?? "");
    setOriginSigungu(initial.origin?.sigungu ?? "");
    setCardDescription(initial.description ?? "");
    setImageId(initial.imageId ?? "");
  }, [isEdit, editInitial, editRoot, canEdit, categoryList]);

  const editPatch = editInitial
    ? bloodlineEditPatch(editInitial, {
        speciesType: speciesType || null,
        imageId,
        description: cardDescription,
        origin: originSido ? { sido: originSido, ...(originSigungu ? { sigungu: originSigungu } : {}) } : null,
      })
    : null;
  const hasEditChanges = Boolean(editPatch && Object.keys(editPatch).length > 0);

  useEffect(() => {
    if (!imageFile) {
      setImagePreview("");
      return;
    }
    const url = URL.createObjectURL(imageFile);
    setImagePreview(url);
    return () => URL.revokeObjectURL(url);
  }, [imageFile]);

  /** 파일을 고르면 형식·크기를 보고 자르기 창을 연다. */
  const handleImageChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || imageUploading || creating) return;
    const type = file.type?.toLowerCase() || "";
    const ext = getFileExtension(file.name || "");
    const isImage =
      type.startsWith("image/") ||
      ALLOWED_IMAGE_EXTENSIONS.includes(ext as (typeof ALLOWED_IMAGE_EXTENSIONS)[number]);
    if (!isImage) {
      setImageError("이미지 파일만 업로드할 수 있습니다.");
      return;
    }
    if (file.size > MAX_IMAGE_SIZE) {
      setImageError("이미지는 최대 10MB까지 등록할 수 있습니다.");
      return;
    }
    setImageError("");
    setCropFile(file);
  };

  /** 자른 사진을 바로 올린다(앱 pickImage). 수정은 실패하면 원래 사진으로 돌아간다. */
  const uploadPickedImage = async (file: File) => {
    const previousId = imageId;
    setImageFile(file);
    setImageId("");

    const seq = ++uploadSeqRef.current;
    setImageUploading(true);
    try {
      const id = await uploadCardImage(file);
      if (seq === uploadSeqRef.current) setImageId(id);
    } catch (error) {
      if (seq !== uploadSeqRef.current) return;
      setImageError(error instanceof Error ? error.message : "이미지 업로드에 실패했습니다.");
      setImageFile(null);
      if (isEdit) setImageId(previousId);
    } finally {
      if (seq === uploadSeqRef.current) setImageUploading(false);
    }
  };

  const removeImage = () => {
    uploadSeqRef.current += 1;
    setImageFile(null);
    setImageId("");
    setImageUploading(false);
    setImageError("");
  };

  /** 서버 오류를 칸(이름·종·사진·산지) 또는 폼 위에 붙인다. */
  const showServerError = (payload: { error?: string; errorCode?: string } | null, fallback: string) => {
    const message = bloodlineErrorText(payload, fallback);
    const field = payload?.errorCode ? FIELD_BY_ERROR[payload.errorCode as BloodlineErrorCode] : undefined;
    if (field === "name") setNameError(message);
    else if (field === "species") setSpeciesError(message);
    else if (field === "image") setImageError(message);
    else if (field === "origin") setOriginError(message);
    else setFormError(message);
  };

  const handleSave = async () => {
    if (!isEdit || !editPatch || !hasEditChanges || creating || imageUploading) return;
    setFormError("");
    setSpeciesError("");
    setImageError("");
    setOriginError("");
    setCreating(true);
    try {
      const response = await authFetch(`/api/bloodline-cards/${editRoot?.id ?? editCardId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editPatch),
      });
      const payload = (await response.json().catch(() => null)) as BloodlineCardPatchResponse | null;
      if (!response.ok || !payload?.success) {
        showServerError(payload, "저장하지 못했어요");
        return;
      }
      // 상세(연 id·뿌리 id)와 혈통 목록을 다시 받는다.
      void globalMutate(detailKey);
      if (editRoot && editRoot.id !== editCardId) void globalMutate(`/api/bloodline-cards/${editRoot.id}`);
      revalidateByPrefix({ cache: swrCache, mutate: globalMutate }, BLOODLINE_LIST_KEY_PREFIXES);
      toast.success("저장했어요");
      if (window.history.length > 1) router.back();
      else router.replace(`/bloodline-management/card/${editRoot?.id ?? editCardId}`);
    } catch {
      setFormError("저장하지 못했어요");
    } finally {
      setCreating(false);
    }
  };

  const handleSubmit = async (event?: FormEvent) => {
    event?.preventDefault();
    if (isEdit) {
      await handleSave();
      return;
    }
    if (creating || imageUploading) return;
    setFormError("");

    // 서버와 같은 순서로 본다: 이름 → 종 → 사진 → 산지. 한 번에 모든 칸의 오류를 보인다.
    const name = validateBloodlineName(cardName);
    const nextNameError = name.ok ? "" : BLOODLINE_NAME_RULE_MESSAGE;
    const nextSpeciesError = speciesType ? "" : SPECIES_REQUIRED_MESSAGE;
    const nextImageError = imageId ? "" : IMAGE_REQUIRED_MESSAGE;
    setNameError(nextNameError);
    setSpeciesError(nextSpeciesError);
    setImageError(nextImageError);
    setOriginError("");
    if (!name.ok || nextSpeciesError || nextImageError) return;

    const description = cardDescription.trim();
    const body: CreateBloodlineCardBody = {
      name: name.name,
      speciesType,
      image: imageId,
      ...(originSido ? { originSido } : {}),
      ...(originSido && originSigungu ? { originSigungu } : {}),
      ...(description ? { description } : {}),
    };

    setCreating(true);
    try {
      const response = await authFetch("/api/bloodline-cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = (await response.json().catch(() => null)) as BloodlineCardsResponse | null;
      if (!response.ok || !payload?.success) {
        showServerError(payload, "혈통을 만들지 못했어요");
        return;
      }
      const createdId =
        payload.myBloodlines?.[0]?.id || payload.myCreatedCards?.[0]?.id || payload.ownedCards?.[0]?.id;
      if (!createdId) {
        setFormError("만든 혈통을 확인하지 못했어요");
        return;
      }

      setCardName("");
      setCardDescription("");
      setImageFile(null);
      setImageId("");
      router.replace(
        `/bloodline-management/card/${createdId}?celebration=card-created&name=${encodeURIComponent(name.name)}`
      );
    } catch {
      setFormError("혈통을 만들지 못했어요");
    } finally {
      setCreating(false);
    }
  };

  const editLoading = isEdit && !editInitial && (detailQuery.isLoading || (canEdit && !categoryList));
  if (userLoading || loggedOut || editLoading) {
    return (
      <Layout headerVariant="none" seoTitle={title}>
        <BloodlineHeader title={title} />
        <div className="flex min-h-[60vh] items-center justify-center">
          <BloodlineSpinner />
        </div>
      </Layout>
    );
  }

  if (isEdit && !editInitial) {
    return (
      <Layout headerVariant="none" seoTitle={title}>
        <BloodlineHeader title={title} />
        <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
          <p className="text-[16px] font-semibold tracking-[-0.3px] text-app-text">
            {detailQuery.error ? "혈통을 불러오지 못했어요" : "혈통을 만든 보유자만 고칠 수 있어요"}
          </p>
          {detailQuery.error ? (
            <button
              type="button"
              onClick={() => void detailQuery.mutate()}
              className="mt-3 text-[14px] font-semibold text-app-text underline"
            >
              다시 시도
            </button>
          ) : null}
        </div>
      </Layout>
    );
  }

  const photoPreview = imagePreview || (imageId ? makeImageUrl(imageId, "public") : "");

  return (
    <Layout headerVariant="none" seoTitle={title}>
      <BloodlineHeader title={title} />

      <form id="bloodline-card-create" onSubmit={handleSubmit} className="px-4 pb-8 pt-4" noValidate>
        {formError ? (
          <div className="mb-4">
            <FieldError message={formError} />
          </div>
        ) : null}

        <FieldLabel
          label="혈통 이름"
          htmlFor="bloodline-card-name"
          count={`${cardName.length}/${BLOODLINE_NAME_MAX_LENGTH}`}
        />
        <Input
          id="bloodline-card-name"
          value={cardName}
          maxLength={BLOODLINE_NAME_MAX_LENGTH}
          onChange={(event) => {
            setCardName(event.target.value);
            if (nameError) setNameError("");
          }}
          placeholder="혈통 이름"
          disabled={creating || isEdit}
          readOnly={isEdit}
          aria-invalid={Boolean(nameError)}
          aria-describedby={nameError ? "bloodline-card-name-error" : "bloodline-card-name-help"}
          className={bloodlineInputClass}
        />
        {nameError ? (
          <FieldError id="bloodline-card-name-error" message={nameError} />
        ) : (
          <p id="bloodline-card-name-help" className="mt-1.5 text-[13px] tracking-[-0.2px] text-app-muted">
            {isEdit ? NAME_LOCKED_MESSAGE : BLOODLINE_NAME_HELP}
          </p>
        )}

        <div className="mt-5">
          <FieldLabel label="종" />
          <div className="grid grid-cols-2 gap-2">
            <select
              aria-label="분류"
              value={speciesGroup}
              onChange={(event) => {
                setSpeciesGroup(event.target.value);
                setSpeciesName("");
                if (speciesError) setSpeciesError("");
              }}
              disabled={creating || !categoryList}
              aria-invalid={Boolean(speciesError)}
              className={cn(bloodlineSelectClass, speciesError && !speciesGroup && "border-app-danger")}
            >
              <option value="">{categoryList ? "분류 선택" : "불러오는 중..."}</option>
              {speciesGroups.map((item) => (
                <option key={item.id} value={item.name}>
                  {item.name}
                </option>
              ))}
            </select>
            {speciesOptions.length > 0 ? (
              <select
                aria-label="종"
                value={speciesName}
                onChange={(event) => {
                  setSpeciesName(event.target.value);
                  if (speciesError) setSpeciesError("");
                }}
                disabled={creating}
                aria-invalid={Boolean(speciesError)}
                className={cn(bloodlineSelectClass, speciesError && !speciesName && "border-app-danger")}
              >
                <option value="">종 선택</option>
                {speciesOptions.map((item) => (
                  <option key={item.id} value={item.name}>
                    {item.name}
                  </option>
                ))}
              </select>
            ) : null}
          </div>
          {categoriesFailed ? (
            <p role="alert" className="mt-1.5 text-[13px] tracking-[-0.2px] text-app-danger">
              종 목록을 불러오지 못했어요.{" "}
              <button
                type="button"
                onClick={() => void categoriesQuery.mutate()}
                className="font-semibold text-app-text underline"
              >
                다시 시도
              </button>
            </p>
          ) : null}
          {speciesError ? <FieldError message={speciesError} /> : null}
        </div>

        <div className="mt-5">
          <FieldLabel label="사진" />
          <div className="flex gap-2">
            <label
              htmlFor="bloodline-card-image"
              aria-label="사진 추가"
              className={cn(
                "flex h-20 w-20 cursor-pointer flex-col items-center justify-center rounded-lg border bg-app-bg",
                imageError ? "border-app-danger" : "border-app-border",
                (creating || imageUploading) && "pointer-events-none opacity-60"
              )}
            >
              {imageUploading ? (
                <BloodlineSpinner className="h-5 w-5" />
              ) : (
                <>
                  <CameraIcon />
                  <span className="mt-1 text-[12px] text-app-muted">{photoPreview ? "1/1" : "0/1"}</span>
                </>
              )}
            </label>
            <input
              id="bloodline-card-image"
              ref={imageInputRef}
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={handleImageChange}
              disabled={creating || imageUploading}
            />
            {photoPreview ? (
              <div className="relative h-20 w-20">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photoPreview}
                  alt="선택한 사진"
                  className="h-20 w-20 rounded-lg object-cover"
                />
                {/* 수정은 사진을 바꿀 수만 있다(서버가 빈 사진을 받지 않는다). */}
                {isEdit ? null : (
                <button
                  type="button"
                  aria-label="사진 삭제"
                  onClick={removeImage}
                  disabled={creating}
                  className="absolute -right-1.5 -top-1.5 grid h-[22px] w-[22px] place-items-center rounded-full text-white"
                  style={{ backgroundColor: "rgba(0, 0, 0, 0.6)" }}
                >
                  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth={2} strokeLinecap="round" />
                  </svg>
                </button>
                )}
              </div>
            ) : null}
          </div>
          {imageError ? <FieldError message={imageError} /> : null}
          <FieldHelp>
            {isEdit
              ? "왼쪽 칸을 눌러 대표 사진을 바꿔요. 정사각형으로 잘라 올려요."
              : "대표 개체 사진 1장이 필요해요. 정사각형으로 잘라 올려요. JPG · PNG · WEBP, 최대 10MB."}
          </FieldHelp>
        </div>

        <div className="mt-5">
          <FieldLabel label="산지 (선택)" />
          <div className="grid grid-cols-2 gap-2">
            <select
              aria-label="시·도"
              value={originSido}
              onChange={(event) => {
                setOriginSido(event.target.value);
                setOriginSigungu("");
                if (originError) setOriginError("");
              }}
              disabled={creating}
              className={bloodlineSelectClass}
            >
              <option value="">시·도</option>
              {REGIONS.map((region) => (
                <option key={region.sido} value={region.sido}>
                  {region.sido}
                </option>
              ))}
            </select>
            <select
              aria-label="시·군·구"
              value={originSigungu}
              onChange={(event) => {
                setOriginSigungu(event.target.value);
                if (originError) setOriginError("");
              }}
              disabled={creating || !originSido}
              className={bloodlineSelectClass}
            >
              <option value="">시·군·구</option>
              {sigunguOptions.map((sigungu) => (
                <option key={sigungu} value={sigungu}>
                  {sigungu}
                </option>
              ))}
            </select>
          </div>
          {originError ? <FieldError message={originError} /> : null}
        </div>

        <div className="mt-5">
          <FieldLabel
            label="혈통 소개 (선택)"
            htmlFor="bloodline-card-description"
            count={`${cardDescription.length}/${DESCRIPTION_MAX_LENGTH}`}
          />
          <Textarea
            id="bloodline-card-description"
            value={cardDescription}
            maxLength={DESCRIPTION_MAX_LENGTH}
            onChange={(event) => setCardDescription(event.target.value)}
            placeholder="시작한 페어, 누대, 평균 크기처럼 분양받을 분이 궁금해할 내용을 적어 주세요."
            disabled={creating}
            className={bloodlineTextareaClass}
          />
        </div>
      </form>

      <BloodlineBottomBarSpacer />
      <BloodlineBottomBar>
        <BloodlinePrimaryButton
          disabled={creating || imageUploading || (isEdit && !hasEditChanges)}
          onClick={() => void handleSubmit()}
        >
          {isEdit ? (creating ? "저장하는 중..." : "저장") : creating ? "만드는 중..." : "혈통 만들기"}
        </BloodlinePrimaryButton>
      </BloodlineBottomBar>

      {cropFile ? (
        <SquareImageCropper
          file={cropFile}
          onCancel={() => setCropFile(null)}
          onDone={(cropped) => {
            setCropFile(null);
            void uploadPickedImage(cropped);
          }}
        />
      ) : null}
    </Layout>
  );
}
