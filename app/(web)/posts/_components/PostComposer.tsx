"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import useSWR, { useSWRConfig } from "swr";

import Layout from "@components/features/MainLayout";
import ConfirmDialog from "@components/atoms/ConfirmDialog";
import { authFetch } from "@libs/client/authFetch";
import { toast } from "@libs/client/toast";
import { cn, makeImageUrl } from "@libs/client/utils";
import { POST_CATEGORIES } from "@libs/constants";
import { toPostPath } from "@libs/post-route";
import { toLoginHref } from "@components/features/MainLayout";
import useConfirmLeave from "hooks/useConfirmLeave";
import useUser from "hooks/useUser";
import type { CategoriesResponse } from "@libs/shared/categories";
import { REGION_POST_CATEGORY } from "@libs/shared/postCategory";
import { regionOf } from "@libs/shared/regions";
import { MY_ACTIVITY_KEY_PREFIXES, POST_KEY_PREFIXES, revalidateByPrefix } from "@libs/client/swrRevalidate";
import {
  POST_COMPOSER_IMAGE_MAX,
  canSubmitPost,
  filterPickedPhotos,
  hasComposerChanges,
  hasPostBodyMarks,
  validatePostForm,
  type ComposerPhoto,
  type PostComposerInitial,
  type PostFormErrors,
} from "../_lib/postComposer";
import { PostPickerSheet } from "./PostPickerSheet";
import { SpeciesPickerSheet, defaultSpeciesFromPins } from "./SpeciesPickerSheet";
import { removePostBodyImage } from "@libs/shared/post-body";

/**
 * 게시글 작성·수정 공용 폼(앱 PostComposer). 시안: bredy_app design/mockups/post-upload/A-karrot.html
 * 헤더 X / "글쓰기"(수정: "게시글 수정") / "완료"(수정: "수정하기") · 선택 row 2개 · 8px 갭 ·
 * 80px 사진 가로 스크롤 · 제목 18/600 · 1px 구분선 · 본문 16/1.6 · 하단 바 52(카메라 + n/10).
 */

type SubmitStep = "idle" | "image" | "submit";
type PickerTarget = "category" | "species" | null;

type PostComposerProps =
  | { mode: "create"; defaultCategory?: string }
  | { mode: "edit"; initial: PostComposerInitial };

interface FileUploadUrlResponse {
  uploadURL?: string;
  id?: string;
}

interface PostMutationResponse {
  success: boolean;
  post?: { id: number; title: string };
  error?: string;
  message?: string;
  /** '동네' 글인데 작성자 동네가 없으면 400 REGION_REQUIRED. */
  errorCode?: string;
}

async function uploadPostImage(file: File, title: string): Promise<string> {
  const urlResponse = await authFetch("/api/files");
  const urlResult = (await urlResponse.json().catch(() => null)) as FileUploadUrlResponse | null;
  if (!urlResponse.ok || !urlResult?.uploadURL) {
    throw new Error("이미지 업로드에 실패했습니다.");
  }
  const form = new FormData();
  form.append("file", file, file.name || title);
  const uploaded = await fetch(urlResult.uploadURL, { method: "POST", body: form });
  const payload = (await uploaded.json().catch(() => null)) as { result?: { id?: string } } | null;
  const imageId = payload?.result?.id || urlResult.id || "";
  if (!uploaded.ok || !imageId) {
    throw new Error("이미지 업로드에 실패했습니다.");
  }
  return imageId;
}

function CloseIcon({ className = "h-6 w-6", strokeWidth = 1.5 }: { className?: string; strokeWidth?: number }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" strokeWidth={strokeWidth} strokeLinecap="round" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg
      width={18}
      height={18}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      className="text-app-caption"
      aria-hidden="true"
    >
      <path d="M9 5l7 7-7 7" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CameraIcon() {
  return (
    <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
      <path
        d="M3 8.5A2.5 2.5 0 015.5 6h1.7a1 1 0 00.83-.45l.94-1.4A1 1 0 019.8 3.7h4.4a1 1 0 01.83.45l.94 1.4a1 1 0 00.83.45h1.7A2.5 2.5 0 0121 8.5v8A2.5 2.5 0 0118.5 19h-13A2.5 2.5 0 013 16.5v-8z"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={12} cy={12.5} r={3.5} strokeWidth={1.5} />
    </svg>
  );
}

function ErrorText({ children }: { children?: string }) {
  if (!children) return null;
  return <p className="mt-1.5 text-[13px] text-app-danger">{children}</p>;
}

/** 56px 헤더: X(24) + 제목 18/700 + (오른쪽 슬롯). 폼 전 상태(로딩·권한 없음)에서도 쓴다. */
export function PostComposerHeader({
  title,
  onClose,
  closeDisabled,
  right,
}: {
  title: string;
  onClose: () => void;
  closeDisabled?: boolean;
  right?: ReactNode;
}) {
  return (
    <header className="sticky top-0 z-30 h-14 bg-app-bg">
      <div className="mx-auto flex h-full max-w-xl items-center gap-3 px-4">
        <button
          type="button"
          aria-label="닫기"
          disabled={closeDisabled}
          onClick={onClose}
          className="-m-2.5 grid h-11 w-11 place-items-center rounded-full text-app-text"
        >
          <CloseIcon />
        </button>
        <h1 className="text-[18px] font-bold text-app-text">{title}</h1>
        <div className="flex-1" />
        {right}
      </div>
    </header>
  );
}

/** 폼을 그리기 전 상태(인증 확인·글 불러오기·권한 없음) 화면 셸. */
export function PostComposerGate({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <Layout headerVariant="none" seoTitle={title}>
      <PostComposerHeader title={title} onClose={onClose} />
      <div className="flex min-h-[calc(100vh-56px)] flex-col">{children}</div>
    </Layout>
  );
}

function SelectRow({
  label,
  value,
  placeholder,
  disabled,
  onClick,
}: {
  label: string;
  value: string;
  placeholder: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  const picked = Boolean(value);
  return (
    <button
      type="button"
      aria-label={`${label} 선택`}
      aria-haspopup="dialog"
      disabled={disabled}
      onClick={onClick}
      className="flex h-14 w-full items-center gap-2 bg-app-bg px-4 text-left transition-colors hover:bg-app-surface"
    >
      <span className="text-[16px] text-app-text">{label}</span>
      <span
        className={cn(
          "ml-auto max-w-[50%] truncate text-[16px]",
          picked ? "font-medium text-app-text" : "font-normal text-app-muted"
        )}
      >
        {picked ? value : placeholder}
      </span>
      <span className="ml-1 flex">
        <ChevronRightIcon />
      </span>
    </button>
  );
}

let photoSeq = 0;
const nextPhotoKey = () => {
  photoSeq += 1;
  return `photo-${photoSeq}`;
};

export function PostComposer(props: PostComposerProps) {
  const router = useRouter();
  const { mutate: globalMutate, cache: swrCache } = useSWRConfig();
  const revalidateMyPostActivity = () =>
    revalidateByPrefix({ cache: swrCache, mutate: globalMutate }, [...POST_KEY_PREFIXES, ...MY_ACTIVITY_KEY_PREFIXES]);
  const initial = props.mode === "edit" ? props.initial : null;
  const isEdit = initial !== null;

  const { user } = useUser();
  const myRegion = regionOf(user);
  // 반려생활 '동네' 빈 상태의 '인사 남기기'(?category=동네)가 주제를 미리 고른 채로 연다.
  // '동네' 를 미리 고르려면 동네가 있어야 한다(없으면 빈 값으로 두고 시트에서 안내).
  const defaultCategory = props.mode === "create" ? props.defaultCategory : undefined;
  const [category, setCategory] = useState(
    initial?.category ??
      (defaultCategory &&
      POST_CATEGORIES.some((o) => o.id === defaultCategory) &&
      (defaultCategory !== REGION_POST_CATEGORY || myRegion)
        ? defaultCategory
        : "")
  );
  const [species, setSpecies] = useState(initial?.species ?? "");
  // 새 글은 관심 카테고리를 하나만 고정했으면 그 값을 미리 채운다(바꾸거나 비울 수 있다).
  // 계정·카테고리 목록이 늦게 오므로 받은 뒤 한 번만 채우고, 그 전에 직접 고르면 채우지 않는다.
  const pinnedCategoryIds = user?.pinnedCategoryIds;
  const { data: categoriesData } = useSWR<CategoriesResponse>(isEdit ? null : "/api/categories");
  const speciesTouchedRef = useRef(isEdit);
  useEffect(() => {
    if (speciesTouchedRef.current || !user || !categoriesData) return;
    speciesTouchedRef.current = true;
    const preset = defaultSpeciesFromPins(categoriesData.categories, pinnedCategoryIds);
    if (preset) setSpecies(preset);
  }, [user, categoriesData, pinnedCategoryIds]);
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [photos, setPhotos] = useState<ComposerPhoto[]>(() =>
    (initial?.imageIds ?? []).map((id) => ({ kind: "remote", key: `remote-${id}`, id }))
  );
  const [errors, setErrors] = useState<PostFormErrors>({});
  const [submitStep, setSubmitStep] = useState<SubmitStep>("idle");
  const [picker, setPicker] = useState<PickerTarget>(null);
  // 동네 미설정 안내(앱 PostComposer promptRegionRequired). '설정하기' 는 내 동네 설정으로 보낸다.
  const [regionPromptOpen, setRegionPromptOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const photosRef = useRef(photos);
  photosRef.current = photos;

  const values = { title, description, category, species };
  const isSubmitting = submitStep !== "idle";
  const changed = hasComposerChanges(values, photos, initial);
  const canSubmit = canSubmitPost({ values, submitting: isSubmitting, isEdit, changed });
  const { leave, dialog } = useConfirmLeave(changed);

  // 언마운트 시 미리보기 URL 정리
  useEffect(
    () => () => {
      photosRef.current.forEach((photo) => {
        if (photo.kind === "local") URL.revokeObjectURL(photo.previewUrl);
      });
    },
    []
  );

  // 본문은 내용에 맞춰 늘어난다(최소 260).
  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.max(260, el.scrollHeight)}px`;
  }, [description]);

  const clearFieldError = (field: keyof PostFormErrors) =>
    setErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });

  const closeScreen = () => {
    if (window.history.length > 1) router.back();
    else router.replace(initial ? toPostPath(initial.postId, initial.title) : "/posts");
  };

  const openFilePicker = () => {
    if (isSubmitting) return;
    if (photos.length >= POST_COMPOSER_IMAGE_MAX) {
      toast.error(`사진은 최대 ${POST_COMPOSER_IMAGE_MAX}장까지 첨부할 수 있습니다.`);
      return;
    }
    fileInputRef.current?.click();
  };

  const handleFiles = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!files.length) return;
    const result = filterPickedPhotos(files, photos.length);
    if (result.invalidType) toast.error("이미지 파일만 업로드할 수 있습니다.");
    if (result.oversized) toast.error("이미지는 최대 10MB까지 업로드할 수 있습니다.");
    if (result.overflow) {
      toast.error(`사진은 최대 ${POST_COMPOSER_IMAGE_MAX}장까지 첨부할 수 있습니다.`);
    }
    if (!result.accepted.length) return;
    setPhotos((prev) => [
      ...prev,
      ...result.accepted.map(
        (file): ComposerPhoto => ({
          kind: "local",
          key: nextPhotoKey(),
          file,
          previewUrl: URL.createObjectURL(file),
        })
      ),
    ]);
  };

  const removePhoto = (key: string) => {
    const index = photos.findIndex((photo) => photo.key === key);
    if (index < 0) return;
    const target = photos[index];
    if (target.kind === "local") URL.revokeObjectURL(target.previewUrl);
    setPhotos((prev) => prev.filter((photo) => photo.key !== key));
    // 앱에서 쓴 글이면 본문의 사진 자리 표시도 지우고 뒤 번호를 당긴다.
    setDescription((prev) => removePostBodyImage(prev, index));
  };

  const submit = async () => {
    if (!canSubmit) return;
    const nextErrors = validatePostForm(values);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      toast.error("입력값을 확인해주세요.");
      return;
    }

    // 저장에 성공해 이동하면 버튼을 잠근 채 둔다(다시 누르기·이탈 가드 재무장 방지).
    let leaving = false;
    try {
      // 순서를 지키도록 한 장씩 올린다. 기존 사진(remote)은 다시 올리지 않고 id 를 그대로 보낸다.
      const imageIds: string[] = [];
      if (photos.some((photo) => photo.kind === "local")) setSubmitStep("image");
      for (const photo of photos) {
        imageIds.push(
          photo.kind === "remote" ? photo.id : await uploadPostImage(photo.file, title.trim())
        );
      }

      setSubmitStep("submit");
      const body = {
        title: title.trim(),
        description: description.trim(),
        category,
        species,
        images: imageIds,
      };
      const response = await authFetch(initial ? `/api/posts/${initial.postId}` : "/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          initial ? { action: "update", ...body } : { ...body, image: imageIds[0] ?? "" }
        ),
      });
      const result = (await response.json().catch(() => null)) as PostMutationResponse | null;

      if (response.status === 401) {
        toast.error("로그인이 필요합니다.");
        leaving = true;
        leave(() => router.push(toLoginHref(initial ? `/posts/${initial.postId}/edit` : "/posts/upload")));
        return;
      }

      if (initial) {
        if (!response.ok || !result?.success) {
          toast.error(result?.error || result?.message || "게시글 수정에 실패했습니다.");
          return;
        }
        revalidateMyPostActivity();
        toast.success("게시글이 수정되었습니다.");
        const postPath = toPostPath(initial.postId, title.trim());
        leaving = true;
        leave(() => router.replace(postPath));
        return;
      }

      if (!response.ok || !result?.success || !result.post?.id) {
        if (result?.errorCode === "REGION_REQUIRED") {
          setRegionPromptOpen(true);
          return;
        }
        toast.error(result?.error || result?.message || "게시글 등록에 실패했습니다.");
        return;
      }
      revalidateMyPostActivity();
      toast.success("게시글이 등록되었습니다.");
      const postPath = toPostPath(result.post.id, result.post.title);
      leaving = true;
      leave(() => router.replace(postPath));
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : isEdit
            ? "게시글 수정에 실패했습니다."
            : "게시글 등록 중 오류가 발생했습니다."
      );
    } finally {
      if (!leaving) setSubmitStep("idle");
    }
  };

  const submitLabel = isEdit ? "수정하기" : "완료";
  const screenTitle = isEdit ? "게시글 수정" : "글쓰기";

  return (
    <Layout headerVariant="none" seoTitle={screenTitle}>
      <PostComposerHeader
        title={screenTitle}
        onClose={closeScreen}
        closeDisabled={isSubmitting}
        right={
          isSubmitting ? (
            <span
              role="status"
              aria-label={
                submitStep === "image"
                  ? "이미지를 업로드하고 있어요"
                  : isEdit
                    ? "게시글을 수정하고 있어요"
                    : "게시글을 등록하고 있어요"
              }
              className="h-5 w-5 animate-spin rounded-full border-2 border-app-brand border-t-transparent"
            />
          ) : (
            <button
              type="button"
              aria-disabled={!canSubmit}
              disabled={!canSubmit}
              onClick={() => void submit()}
              className={cn(
                "-m-2 p-2 text-[16px] font-semibold",
                canSubmit ? "text-app-brand" : "cursor-default text-app-caption"
              )}
            >
              {submitLabel}
            </button>
          )
        }
      />

      <div className="pb-[calc(52px+16px+env(safe-area-inset-bottom))]">
        {/* 주제 / 생물군 선택 */}
        <SelectRow
          label="게시글의 주제를 선택해주세요"
          value={
            category === REGION_POST_CATEGORY && myRegion
              ? `${REGION_POST_CATEGORY} · ${myRegion.sigungu}`
              : (POST_CATEGORIES.find((o) => o.id === category)?.name ?? category)
          }
          placeholder="선택"
          disabled={isSubmitting}
          onClick={() => setPicker("category")}
        />
        {errors.category ? (
          <div className="px-4 pb-2">
            <ErrorText>{errors.category}</ErrorText>
          </div>
        ) : null}
        <div className="mx-4 h-px bg-app-line" />
        <SelectRow
          label="관심 생물군"
          value={species}
          placeholder="선택"
          disabled={isSubmitting}
          onClick={() => setPicker("species")}
        />

        <div className="h-2 bg-app-gap" />

        {/* 첨부 사진 — 80px 썸네일 가로 스크롤 */}
        {photos.length ? (
          <div className="flex gap-2 overflow-x-auto px-4 pb-1 pt-4 scrollbar-hide">
            {photos.map((photo, index) => (
              <div
                key={photo.key}
                className="relative h-20 w-20 shrink-0 rounded-md bg-app-placeholder"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo.kind === "remote" ? makeImageUrl(photo.id, "public") : photo.previewUrl}
                  alt={`첨부 사진 ${index + 1}`}
                  className="h-20 w-20 rounded-md object-cover"
                />
                <button
                  type="button"
                  aria-label={`첨부 사진 ${index + 1} 삭제`}
                  disabled={isSubmitting}
                  onClick={() => removePhoto(photo.key)}
                  className="absolute -right-1.5 -top-1.5 grid h-[22px] w-[22px] place-items-center rounded-full bg-app-inverse text-app-inverse-text"
                >
                  <CloseIcon className="h-3 w-3" strokeWidth={2.5} />
                </button>
              </div>
            ))}
            {/* 스크롤 끝에서 마지막 썸네일의 X 가 잘리지 않게 오른쪽 여백을 둔다. */}
            <span className="w-px shrink-0" aria-hidden="true" />
          </div>
        ) : null}

        {/* 제목 */}
        <div className="px-4 pt-4">
          <input
            value={title}
            disabled={isSubmitting}
            onChange={(event) => {
              setTitle(event.target.value);
              clearFieldError("title");
            }}
            placeholder="제목을 입력하세요"
            aria-label="제목"
            className="w-full border-0 bg-transparent p-0 text-[18px] font-semibold tracking-[-0.2px] text-app-text outline-none placeholder:font-semibold placeholder:text-app-caption focus:ring-0"
          />
          <ErrorText>{errors.title}</ErrorText>
        </div>

        <div className="mx-4 mt-3.5 h-px bg-app-line" />

        {/* 내용 */}
        <div className="px-4 pt-3.5">
          <textarea
            ref={bodyRef}
            value={description}
            disabled={isSubmitting}
            onChange={(event) => {
              setDescription(event.target.value);
              clearFieldError("description");
            }}
            placeholder="곤충에 대한 이야기를 자유롭게 나눠보세요"
            aria-label="내용"
            className="block min-h-[260px] w-full resize-none overflow-hidden border-0 bg-transparent p-0 text-[16px] leading-[1.6] text-app-text outline-none placeholder:text-app-caption focus:ring-0"
          />
          <ErrorText>{errors.description}</ErrorText>
          {hasPostBodyMarks(description) ? (
            <p className="mt-1.5 text-[13px] text-app-muted">
              [[photo:N]] 줄은 사진 자리, ## 는 크게, ** 는 굵게 표시예요. 지우지 않으면 상세에서 그대로 보여요.
            </p>
          ) : null}
        </div>
      </div>

      {/* 하단 바: 카메라 + n/10 */}
      <div className="fixed inset-x-0 bottom-0 mx-auto max-w-xl z-30 border-t border-app-line bg-app-bg pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto flex h-[52px] max-w-xl items-center gap-1.5 px-4">
          <button
            type="button"
            aria-label="사진 첨부"
            disabled={isSubmitting}
            onClick={openFilePicker}
            className="-m-2 grid place-items-center p-2 text-app-text"
          >
            <CameraIcon />
          </button>
          <span className="text-[14px] text-app-muted">
            {photos.length}/{POST_COMPOSER_IMAGE_MAX}
          </span>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleFiles}
        />
      </div>

      <PostPickerSheet
        open={picker === "category"}
        title="게시글 주제"
        options={POST_CATEGORIES}
        selectedId={category}
        onSelect={(id) => {
          setPicker(null);
          // '동네' 글은 동네가 있어야 쓸 수 있다. 주제는 이전 값 그대로 둔다.
          if (id === REGION_POST_CATEGORY && !myRegion) {
            setRegionPromptOpen(true);
            return;
          }
          setCategory(id);
          clearFieldError("category");
        }}
        onClose={() => setPicker(null)}
      />
      <SpeciesPickerSheet
        open={picker === "species"}
        title="관심 생물군"
        value={species}
        suggestedIds={pinnedCategoryIds}
        onSelect={(name) => {
          speciesTouchedRef.current = true;
          setSpecies(name);
          setPicker(null);
        }}
        onClose={() => setPicker(null)}
      />

      {/* 제출 중 화면 전체 터치 차단 */}
      {isSubmitting ? (
        <div className="fixed inset-0 z-[60] bg-app-bg opacity-40" aria-hidden="true" />
      ) : null}

      <ConfirmDialog
        open={regionPromptOpen}
        title="동네를 먼저 설정해 주세요"
        // 웹은 화면을 쌓아 둘 수 없어 설정으로 가면 작성 중인 내용이 사라진다. 그때만 알린다.
        description={changed ? "지금 이동하면 작성 중인 내용은 사라져요." : undefined}
        confirmText="설정하기"
        onCancel={() => setRegionPromptOpen(false)}
        onConfirm={() => {
          setRegionPromptOpen(false);
          leave(() => router.push("/settings/region"));
        }}
      />
      {dialog}
    </Layout>
  );
}

export default PostComposer;
