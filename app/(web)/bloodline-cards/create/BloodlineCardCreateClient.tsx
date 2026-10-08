"use client";

/**
 * 혈통 만들기 — 기존 웹 톤(A안) 유지, 혈통 v2 입력 규칙만 맞춘다(설계 §4.4 WB-3, PRD S-9).
 * 원본: bredy_app src/app/bloodline-cards/create.tsx
 *
 * 헤더(뒤로 + 제목 18/700) → 단일 폼: 혈통 이름(공유 규칙, 띄어쓰기 허용) → 종(필수, 분류 → 종 2단 select,
 * `/api/categories`) → 사진(필수 1장) → 산지(선택, 시·도 → 시·군·구 select) → 혈통 소개(선택)
 * → 하단 고정 52 주황 CTA "혈통 만들기". 카드 스타일·생성 확인창은 없다(만들기는 되돌릴 수 있다).
 * 서버 오류는 errorCode 로 칸에 붙인다(중복 이름 → 이름 칸).
 */
import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { authFetch } from "@libs/client/authFetch";
import Layout from "@components/features/MainLayout";
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
import type { BloodlineCardsResponse, CreateBloodlineCardBody } from "@libs/shared/bloodline-card";
import type { CategoriesResponse, CategoryItem } from "@libs/shared/categories";
import { BLOODLINE_ERRORS, type BloodlineErrorCode } from "@libs/shared/bloodline-errors";
import {
  BLOODLINE_NAME_HELP,
  BLOODLINE_NAME_MAX_LENGTH,
  BLOODLINE_NAME_RULE_MESSAGE,
  validateBloodlineName,
} from "@libs/shared/bloodline-names";
import { REGIONS } from "@libs/shared/regions";
import { cn } from "@libs/client/utils";

const DESCRIPTION_MAX_LENGTH = 300;
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
const ALLOWED_IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif"] as const;

const SPECIES_REQUIRED_MESSAGE = BLOODLINE_ERRORS.BLOODLINE_SPECIES_REQUIRED.message;
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

export default function BloodlineCardCreateClient() {
  const { user, isLoading: userLoading } = useUser();
  const router = useRouter();
  const imageInputRef = useRef<HTMLInputElement | null>(null);

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

  const loggedOut = !user && !userLoading;
  useBloodlineLoginRedirect(loggedOut, "/bloodline-cards/create");

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

  useEffect(() => {
    if (!imageFile) {
      setImagePreview("");
      return;
    }
    const url = URL.createObjectURL(imageFile);
    setImagePreview(url);
    return () => URL.revokeObjectURL(url);
  }, [imageFile]);

  const handleImageChange = async (event: ChangeEvent<HTMLInputElement>) => {
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

  const handleSubmit = async (event?: FormEvent) => {
    event?.preventDefault();
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
        const message = bloodlineErrorText(payload, "혈통을 만들지 못했어요");
        const field = payload?.errorCode
          ? FIELD_BY_ERROR[payload.errorCode as BloodlineErrorCode]
          : undefined;
        if (field === "name") setNameError(message);
        else if (field === "species") setSpeciesError(message);
        else if (field === "image") setImageError(message);
        else if (field === "origin") setOriginError(message);
        else setFormError(message);
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

  if (userLoading || loggedOut) {
    return (
      <Layout headerVariant="none" seoTitle="혈통 만들기">
        <BloodlineHeader title="혈통 만들기" />
        <div className="flex min-h-[60vh] items-center justify-center">
          <BloodlineSpinner />
        </div>
      </Layout>
    );
  }

  return (
    <Layout headerVariant="none" seoTitle="혈통 만들기">
      <BloodlineHeader title="혈통 만들기" />

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
          disabled={creating}
          aria-invalid={Boolean(nameError)}
          aria-describedby={nameError ? "bloodline-card-name-error" : "bloodline-card-name-help"}
          className={bloodlineInputClass}
        />
        {nameError ? (
          <FieldError id="bloodline-card-name-error" message={nameError} />
        ) : (
          <p id="bloodline-card-name-help" className="mt-1.5 text-[13px] tracking-[-0.2px] text-app-muted">
            {BLOODLINE_NAME_HELP}
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
                  <span className="mt-1 text-[12px] text-app-muted">{imageFile ? "1/1" : "0/1"}</span>
                </>
              )}
            </label>
            <input
              id="bloodline-card-image"
              ref={imageInputRef}
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(event) => void handleImageChange(event)}
              disabled={creating || imageUploading}
            />
            {imagePreview ? (
              <div className="relative h-20 w-20">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imagePreview}
                  alt="선택한 사진"
                  className="h-20 w-20 rounded-lg object-cover"
                />
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
              </div>
            ) : null}
          </div>
          {imageError ? <FieldError message={imageError} /> : null}
          <FieldHelp>대표 개체 사진 1장이 필요해요. JPG · PNG · WEBP, 최대 10MB.</FieldHelp>
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
          disabled={creating || imageUploading}
          onClick={() => void handleSubmit()}
        >
          {creating ? "만드는 중..." : "혈통 만들기"}
        </BloodlinePrimaryButton>
      </BloodlineBottomBar>
    </Layout>
  );
}
