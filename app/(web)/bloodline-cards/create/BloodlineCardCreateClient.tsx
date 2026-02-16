"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Layout from "@components/features/MainLayout";
import { Spinner } from "@components/atoms/Spinner";
import { Button } from "@components/ui/button";
import { Input } from "@components/ui/input";
import { Textarea } from "@components/ui/textarea";
import useUser from "hooks/useUser";
import type { BloodlineCardsResponse } from "@libs/shared/bloodline-card";
import {
  BloodlineVisualCard,
  bloodlineVisualCardVariants,
  type BloodlineVisualCardVariant,
} from "@components/features/bloodline/BloodlineVisualCard";

const CARD_VARIANT_LABELS: { value: BloodlineVisualCardVariant; label: string }[] = [
  { value: "noir", label: "모던" },
  { value: "clean", label: "클린" },
  { value: "editorial", label: "에디토리얼" },
];

const allowedNamePattern = /^[A-Za-z0-9가-힣]+$/;

const CARD_VARIANT_STORAGE_KEY = "bloodline.visual.card.variant";
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;
const ALLOWED_IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif"] as const;

const getFileExtension = (name: string) => {
  const pointIndex = name.lastIndexOf(".");
  if (pointIndex === -1) return "";
  return name.slice(pointIndex).toLowerCase();
};

export default function BloodlineCardCreateClient() {
  const { user, isLoading: isUserLoading } = useUser();
  const router = useRouter();
  const imageInputRef = useRef<HTMLInputElement | null>(null);

  const [cardName, setCardName] = useState("");
  const [cardDescription, setCardDescription] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [creatingCard, setCreatingCard] = useState(false);
  const [cardVisualVariant, setCardVisualVariant] =
    useState<BloodlineVisualCardVariant>("noir");
  const [cardImageFile, setCardImageFile] = useState<File | null>(null);
  const [cardImagePreview, setCardImagePreview] = useState("");

  const previewName = useMemo(
    () => (cardName.trim() || "새 혈통").slice(0, 40),
    [cardName]
  );

  const previewImageUrl = useMemo(() => cardImagePreview || "", [cardImagePreview]);

  useEffect(() => {
    if (!cardImageFile) {
      setCardImagePreview("");
      return;
    }
    const nextImage = URL.createObjectURL(cardImageFile);
    setCardImagePreview(nextImage);
    return () => URL.revokeObjectURL(nextImage);
  }, [cardImageFile]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(CARD_VARIANT_STORAGE_KEY);
      if (
        saved &&
        bloodlineVisualCardVariants.includes(saved as BloodlineVisualCardVariant)
      ) {
        setCardVisualVariant(saved as BloodlineVisualCardVariant);
      }
    } catch {
      // localStorage unavailable
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(CARD_VARIANT_STORAGE_KEY, cardVisualVariant);
    } catch {
      // localStorage unavailable
    }
  }, [cardVisualVariant]);

  const parseCreateResponse = async (response: Response) => {
    const payload = (await response.json().catch(() => null)) as
      | (BloodlineCardsResponse & { error?: string })
      | null;
    if (response.ok && payload?.success) {
      return { payload, errorMessage: "" };
    }
    const reason =
      payload?.error ||
      (response.status === 401
        ? "로그인이 필요합니다."
        : response.status === 400
        ? "입력 값을 확인해주세요."
        : "혈통카드 생성에 실패했습니다.");
    return { payload, errorMessage: reason };
  };

  const uploadCardImage = async (file: File) => {
    const fileApiResponse = await fetch("/api/files");
    if (!fileApiResponse.ok) {
      throw new Error("이미지 업로드 URL을 가져오지 못했습니다.");
    }

    const fileApiResult = (await fileApiResponse.json().catch(() => null)) as {
      uploadURL?: string;
      id?: string;
    } | null;
    const uploadURL = fileApiResult?.uploadURL;
    if (!uploadURL) {
      throw new Error("이미지 업로드 URL을 확인하지 못했습니다.");
    }

    const formData = new FormData();
    formData.append("file", file, file.name || "bloodline-card-image");
    const uploadResponse = await fetch(uploadURL, {
      method: "POST",
      body: formData,
    });

    const uploadResult = (await uploadResponse.json().catch(() => null)) as {
      success?: boolean;
      result?: { id?: string };
    } | null;
    const uploadedImage = uploadResult?.result?.id || fileApiResult?.id;

    if (!uploadResponse.ok || !uploadedImage) {
      throw new Error("이미지 업로드에 실패했습니다.");
    }

    if (uploadResult?.success === false) {
      throw new Error("이미지 업로드에 실패했습니다.");
    }

    return uploadedImage;
  };

  const handleImageChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextFile = event.target.files?.[0];
    if (!nextFile) return;

    const nextType = nextFile.type?.toLowerCase() || "";
    const nextExt = getFileExtension(nextFile.name || "").toLowerCase();
    const isImageTypeAllowed =
      nextType.startsWith("image/") ||
      ALLOWED_IMAGE_EXTENSIONS.includes(nextExt as (typeof ALLOWED_IMAGE_EXTENSIONS)[number]);

    if (!isImageTypeAllowed) {
      setError("이미지 파일만 업로드할 수 있습니다.");
      event.target.value = "";
      return;
    }
    if (nextFile.size > MAX_IMAGE_SIZE) {
      setError("이미지는 최대 10MB까지 등록할 수 있습니다.");
      event.target.value = "";
      return;
    }

    setError("");
    setMessage("");
    setCardImageFile(nextFile);
    // 이미 선택된 파일을 다시 동일 파일로 다시 선택할 수 있게 input 값 초기화
    if (event.target.value) {
      event.target.value = "";
    }
  };

  const handleRemoveImage = () => {
    setCardImageFile(null);
    setCardImagePreview("");
    if (imageInputRef.current) {
      imageInputRef.current.value = "";
    }
  };

  const handleCreateBloodlineCard = async (event: FormEvent) => {
    event.preventDefault();
    setMessage("");
    setError("");

    const nextName = cardName.trim().slice(0, 40);
    const nextDescription = cardDescription.trim().slice(0, 300);

    if (!nextName) {
      setError("이름은 필수 항목입니다.");
      return;
    }
    if (nextName.length < 2) {
      setError("이름은 2자 이상 입력해주세요.");
      return;
    }
    if (!allowedNamePattern.test(nextName)) {
      setError("이름은 영문, 숫자, 한글만 입력 가능하며 공백/특수문자는 허용되지 않습니다.");
      return;
    }
    if (!nextDescription) {
      setError("설명은 필수 항목입니다.");
      return;
    }

    const isConfirmed = window.confirm(`"${nextName}" 혈통카드를 정말로 만드시겠어요?`);
    if (!isConfirmed) {
      return;
    }

    try {
      setCreatingCard(true);
      if (cardImageFile) {
        setMessage("카드 이미지 업로드 중...");
      }
      const image = cardImageFile ? await uploadCardImage(cardImageFile) : "";
      setMessage(cardImageFile ? "이미지 업로드 완료. 카드 생성 중..." : "카드 생성 중...");

      const res = await fetch("/api/bloodline-cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: nextName,
          description: nextDescription,
          visualStyle: cardVisualVariant,
          ...(image ? { image } : {}),
        }),
      });

      const { payload, errorMessage } = await parseCreateResponse(res);
      if (!payload) {
        throw new Error(errorMessage);
      }
      if (!payload.success) {
        throw new Error(errorMessage || payload.error || "혈통카드 생성에 실패했습니다.");
      }

      const createdCardId =
        payload.myBloodlines?.[0]?.id ||
        payload.myCreatedCards?.[0]?.id ||
        payload.ownedCards?.[0]?.id;
      if (!createdCardId) {
        throw new Error("생성된 카드 정보를 확인할 수 없습니다.");
      }

      setCardName("");
      setCardDescription("");
      setCardImageFile(null);
      setCardImagePreview("");
      if (imageInputRef.current) {
        imageInputRef.current.value = "";
      }
      setMessage("");
      router.push(`/bloodline-management/card/${createdCardId}`);
    } catch (createError) {
      setError(
        createError instanceof Error
          ? createError.message
          : "요청 처리 중 오류가 발생했습니다."
      );
    } finally {
      setCreatingCard(false);
    }
  };

  return (
    <Layout canGoBack showHome title="혈통카드 만들기" seoTitle="혈통카드 만들기">
      <div className={`relative space-y-4 px-4 py-4 pb-12 ${creatingCard ? "pointer-events-none" : ""}`}>
        {creatingCard ? (
          <div className="fixed inset-0 z-40 grid place-items-center bg-white/80">
            <div className="rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-md">
              <div className="flex items-center gap-3">
                <Spinner />
                <p className="text-sm font-semibold text-slate-800">혈통카드를 생성하고 있습니다.</p>
              </div>
            </div>
          </div>
        ) : null}
        <section className="app-reveal app-reveal-1 relative overflow-hidden rounded-2xl border border-slate-200/80 bg-gradient-to-br from-white/90 via-slate-50 to-slate-50 p-4 shadow-[0_15px_40px_rgba(15, 23, 42,0.18)] transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_18px_40px_rgba(15, 23, 42,0.24)]">
          <div className="pointer-events-none absolute -left-20 -bottom-16 h-36 w-36 rounded-full bg-slate-200/45 blur-2xl" />
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">대표 카드 미리보기</p>
              <p className="mt-1 text-[13px] font-semibold text-slate-900">내가 상상한 혈통의 정수</p>
            </div>
            <span className="shrink-0 rounded-full border border-slate-200 bg-white/80 px-2.5 py-1 text-[11px] font-semibold text-slate-700">
              LIVE
            </span>
          </div>
          <div className="mb-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-xs font-semibold text-slate-700">카드 스타일</p>
              <span className="text-[11px] text-slate-500">원클릭 적용</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {CARD_VARIANT_LABELS.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setCardVisualVariant(item.value)}
                  className={`h-9 rounded-full border px-3 text-[11px] font-semibold transition ${
                    cardVisualVariant === item.value
                      ? "bg-slate-900 text-white"
                      : "bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                  }`}
                  aria-pressed={cardVisualVariant === item.value}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-3">
            <BloodlineVisualCard
              cardId={null}
              name={previewName}
              ownerName={user?.name || "브리더"}
              subtitle="새 혈통카드 미리보기"
              variant={cardVisualVariant}
              image={null}
              imageUrl={previewImageUrl || ""}
              compact
            />
          </div>
        </section>

        {isUserLoading ? (
          <div className="flex h-28 items-center justify-center">
            <Spinner />
          </div>
        ) : null}

        {!isUserLoading && !user ? (
          <section className="rounded-xl border border-slate-200 bg-white p-5 text-center">
            <p className="text-sm text-slate-700">혈통카드는 로그인 후 생성할 수 있습니다.</p>
            <Link
              href="/auth/login?next=%2Fbloodline-cards%2Fcreate"
              className="mt-3 inline-flex h-10 items-center justify-center rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white"
            >
              로그인하고 시작하기
            </Link>
          </section>
        ) : null}

        {user ? (
          <>
            {message ? (
              <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700">
                {message}
              </p>
            ) : null}
            {error ? (
              <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700">
                {error}
              </p>
            ) : null}

            <form
              onSubmit={handleCreateBloodlineCard}
              className="app-reveal app-reveal-2 space-y-3 rounded-2xl border border-slate-200/80 bg-white/90 p-4 shadow-[0_12px_34px_rgba(15, 23, 42,0.14)] transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_16px_40px_rgba(15, 23, 42,0.22)]"
            >
              <h2 className="text-base font-black tracking-tight text-slate-900">혈통카드 생성</h2>
              <Input
                value={cardName}
                onChange={(event) => setCardName(event.target.value)}
                placeholder="혈통 이름을 입력해주세요 (필수)"
                className="h-11 border-slate-200/70"
                disabled={creatingCard}
              />
              <Textarea
                rows={4}
                value={cardDescription}
                onChange={(event) => setCardDescription(event.target.value)}
                placeholder="이 혈통카드의 소개를 적어주세요 (필수)"
                className="leading-relaxed"
                disabled={creatingCard}
              />
              <div className="space-y-2">
                <p className="text-xs font-bold text-slate-700">카드 이미지</p>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <label
                  htmlFor="bloodline-card-image"
                  className={`inline-flex h-11 w-full cursor-pointer items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white text-sm font-semibold text-slate-700 transition hover:bg-slate-50 ${
                    creatingCard ? "pointer-events-none opacity-60" : ""
                  }`}
                >
                  {cardImageFile ? "다른 이미지로 바꾸기" : "이미지 선택"}
                </label>
                <input
                  id="bloodline-card-image"
                  ref={imageInputRef}
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={handleImageChange}
                  disabled={creatingCard}
                />
                  {previewImageUrl ? (
                    <div className="mt-3 flex items-center gap-2">
                      <div className="h-16 w-16 overflow-hidden rounded-lg border border-slate-200 bg-white">
                        <img
                          src={previewImageUrl}
                          alt="카드 이미지 미리보기"
                          className="h-full w-full object-cover"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={handleRemoveImage}
                        className="inline-flex h-8 items-center rounded-full bg-white px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                        disabled={creatingCard}
                      >
                        삭제
                      </button>
                    </div>
                  ) : null}
                </div>
                <p className="text-[11px] text-slate-500">
                  JPG / PNG / WEBP, 최대 10MB. 이미지 첨부는 선택 항목입니다.
                </p>
              </div>
              <Button type="submit" disabled={creatingCard} className="h-11">
                {creatingCard ? "생성 중..." : "혈통카드 생성"}
              </Button>
            </form>
          </>
        ) : null}
      </div>
    </Layout>
  );
}
