"use client";

/**
 * 혈통카드 만들기 — 당근 톤(A안)
 * 원본: bredy_app src/app/bloodline-cards/create.tsx
 *
 * 헤더(뒤로 + 제목 18/700) → 단일 폼(라벨 15/600 + 글자 수, 입력 h48 r8, 소개 textarea,
 * 사진 행 80px) → 하단 고정 52 주황 CTA "혈통카드 만들기".
 * 사진 행 아래 카드 스타일 32px 칩 1줄(앱과 같음, 기본 noir) → visualStyle 로 보낸다. 미리보기 카드는 두지 않는다.
 */
import { ChangeEvent, FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
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
  bloodlineInputClass,
  bloodlineTextareaClass,
  useBloodlineLoginRedirect,
} from "@components/features/bloodline/BloodlineScreenParts";
import useConfirmDialog from "hooks/useConfirmDialog";
import useUser from "hooks/useUser";
import type { BloodlineCardsResponse } from "@libs/shared/bloodline-card";
import { cn } from "@libs/client/utils";
import { FilterChip } from "@components/app/FilterChip";
import type { BloodlineCardVisualStyle } from "@libs/shared/bloodline-card";

/** 앱 create.tsx CARD_VARIANT_LABELS 와 같은 라벨·순서. 기본값 noir. */
const CARD_VARIANT_LABELS: { value: BloodlineCardVisualStyle; label: string }[] = [
  { value: "noir", label: "모던" },
  { value: "clean", label: "클린" },
  { value: "editorial", label: "에디토리얼" },
];

const allowedNamePattern = /^[A-Za-z0-9가-힣]+$/;
const NAME_MAX_LENGTH = 40;
const DESCRIPTION_MAX_LENGTH = 300;
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
const ALLOWED_IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif"] as const;
const DUPLICATED_NAME_MESSAGE = "이미 사용 중인 혈통 카드 이름입니다.";

const getFileExtension = (name: string) => {
  const pointIndex = name.lastIndexOf(".");
  return pointIndex === -1 ? "" : name.slice(pointIndex).toLowerCase();
};

function FieldLabel({ label, count, htmlFor }: { label: string; count?: string; htmlFor?: string }) {
  return (
    <div className="mb-2 flex items-center justify-between">
      <label htmlFor={htmlFor} className="text-[15px] font-semibold tracking-[-0.2px] text-app-text">
        {label}
      </label>
      {count ? <span className="text-[13px] text-app-muted">{count}</span> : null}
    </div>
  );
}

function FieldError({ id, message }: { id?: string; message: string }) {
  return (
    <p id={id} role="alert" className="mt-1.5 text-[13px] tracking-[-0.2px] text-app-brand">
      {message}
    </p>
  );
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
  const { confirm, confirmDialog } = useConfirmDialog();
  const imageInputRef = useRef<HTMLInputElement | null>(null);

  const [cardName, setCardName] = useState("");
  const [cardDescription, setCardDescription] = useState("");
  const [variant, setVariant] = useState<BloodlineCardVisualStyle>("noir");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState("");
  // 고르는 즉시 업로드한다(앱 pickImage). 업로드 중에는 CTA 를 막는다.
  const [imageId, setImageId] = useState("");
  const [imageUploading, setImageUploading] = useState(false);
  const uploadSeqRef = useRef(0);
  const [nameError, setNameError] = useState("");
  const [descriptionError, setDescriptionError] = useState("");
  const [imageError, setImageError] = useState("");
  const [formError, setFormError] = useState("");
  const [creating, setCreating] = useState(false);

  const loggedOut = !user && !userLoading;
  useBloodlineLoginRedirect(loggedOut, "/bloodline-cards/create");

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
    setNameError("");
    setDescriptionError("");

    const nextName = cardName.trim();
    const nextDescription = cardDescription.trim();
    if (!nextName) return setNameError("이름은 필수 항목입니다.");
    if (nextName.length < 2) return setNameError("이름은 2자 이상 입력해주세요.");
    if (!allowedNamePattern.test(nextName)) {
      return setNameError(
        "이름은 영문, 숫자, 한글만 입력 가능하며 공백/특수문자는 허용되지 않습니다."
      );
    }
    if (!nextDescription) return setDescriptionError("설명은 필수 항목입니다.");

    const ok = await confirm({
      title: "혈통카드 생성",
      description: `"${nextName}" 혈통카드를 정말로 만드시겠어요?`,
      confirmText: "생성",
    });
    if (!ok) return;

    setCreating(true);
    try {
      const image = imageId;
      const response = await authFetch("/api/bloodline-cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: nextName,
          description: nextDescription,
          visualStyle: variant,
          ...(image ? { image } : {}),
        }),
      });
      const payload = (await response.json().catch(() => null)) as BloodlineCardsResponse | null;
      if (!response.ok || !payload?.success) {
        throw new Error(
          payload?.error ||
            (response.status === 401
              ? "로그인이 필요합니다."
              : response.status === 400
                ? "입력 값을 확인해주세요."
                : "혈통카드 생성에 실패했습니다.")
        );
      }
      const createdId =
        payload.myBloodlines?.[0]?.id || payload.myCreatedCards?.[0]?.id || payload.ownedCards?.[0]?.id;
      if (!createdId) throw new Error("생성된 카드 정보를 확인할 수 없습니다.");

      setCardName("");
      setCardDescription("");
      setImageFile(null);
      setImageId("");
      router.replace(
        `/bloodline-management/card/${createdId}?celebration=card-created&name=${encodeURIComponent(nextName)}`
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "요청 처리 중 오류가 발생했습니다.";
      if (message.includes(DUPLICATED_NAME_MESSAGE)) setNameError(message);
      else setFormError(message);
    } finally {
      setCreating(false);
    }
  };

  if (userLoading || loggedOut) {
    return (
      <Layout headerVariant="none" seoTitle="혈통카드 만들기">
        <BloodlineHeader title="혈통카드 만들기" />
        <div className="flex min-h-[60vh] items-center justify-center">
          <BloodlineSpinner />
        </div>
      </Layout>
    );
  }

  return (
    <Layout headerVariant="none" seoTitle="혈통카드 만들기">
      <BloodlineHeader title="혈통카드 만들기" />

      <form id="bloodline-card-create" onSubmit={handleSubmit} className="px-4 pb-8 pt-4" noValidate>
        {formError ? (
          <div className="mb-4">
            <FieldError message={formError} />
          </div>
        ) : null}

        <FieldLabel
          label="혈통 이름"
          htmlFor="bloodline-card-name"
          count={`${cardName.length}/${NAME_MAX_LENGTH}`}
        />
        <Input
          id="bloodline-card-name"
          value={cardName}
          maxLength={NAME_MAX_LENGTH}
          onChange={(event) => {
            setCardName(event.target.value);
            if (nameError) setNameError("");
          }}
          placeholder="혈통 이름을 입력해주세요"
          disabled={creating}
          aria-invalid={Boolean(nameError)}
          aria-describedby={nameError ? "bloodline-card-name-error" : undefined}
          className={bloodlineInputClass}
        />
        {nameError ? <FieldError id="bloodline-card-name-error" message={nameError} /> : null}

        <div className="mt-5">
          <FieldLabel
            label="소개"
            htmlFor="bloodline-card-description"
            count={`${cardDescription.length}/${DESCRIPTION_MAX_LENGTH}`}
          />
          <Textarea
            id="bloodline-card-description"
            value={cardDescription}
            maxLength={DESCRIPTION_MAX_LENGTH}
            onChange={(event) => {
              setCardDescription(event.target.value);
              if (descriptionError) setDescriptionError("");
            }}
            placeholder="이 혈통카드의 소개를 적어주세요"
            disabled={creating}
            aria-invalid={Boolean(descriptionError)}
            aria-describedby={descriptionError ? "bloodline-card-description-error" : undefined}
            className={bloodlineTextareaClass}
          />
          {descriptionError ? (
            <FieldError id="bloodline-card-description-error" message={descriptionError} />
          ) : null}
        </div>

        <div className="mt-5">
          <FieldLabel label="사진" />
          <div className="flex gap-2">
            <label
              htmlFor="bloodline-card-image"
              aria-label="사진 추가"
              className={cn(
                "flex h-20 w-20 cursor-pointer flex-col items-center justify-center rounded-lg border bg-app-bg",
                imageError ? "border-app-brand" : "border-app-border",
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
          <p className="mt-2 text-[13px] text-app-muted">JPG · PNG · WEBP, 최대 10MB. 선택 항목이에요.</p>
        </div>

        <div className="mt-5">
          <FieldLabel label="카드 스타일" />
          <div className="flex gap-1.5">
            {CARD_VARIANT_LABELS.map((item) => (
              <FilterChip
                key={item.value}
                label={item.label}
                selected={item.value === variant}
                onClick={() => {
                  if (!creating) setVariant(item.value);
                }}
                className="px-3"
              />
            ))}
          </div>
        </div>
      </form>

      <BloodlineBottomBarSpacer />
      <BloodlineBottomBar>
        <BloodlinePrimaryButton
          disabled={creating || imageUploading}
          onClick={() => void handleSubmit()}
        >
          {creating ? "만드는 중..." : "혈통카드 만들기"}
        </BloodlinePrimaryButton>
      </BloodlineBottomBar>
      {confirmDialog}
    </Layout>
  );
}
