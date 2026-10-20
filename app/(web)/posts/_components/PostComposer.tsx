"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import useSWR, { useSWRConfig } from "swr";

import Layout from "@components/features/MainLayout";
import ConfirmDialog from "@components/atoms/ConfirmDialog";
import { authFetch } from "@libs/client/authFetch";
import { toast } from "@libs/client/toast";
import { uploadInOrder } from "@libs/client/uploadQueue";
import { cn } from "@libs/client/utils";
import { POST_CATEGORIES } from "@libs/constants";
import { toPostPath } from "@libs/post-route";
import { toLoginHref } from "@components/features/MainLayout";
import useConfirmLeave from "hooks/useConfirmLeave";
import { useCelebrateSheet } from "@components/features/celebrate/CelebrateSheet";
import type { Celebrate } from "@libs/shared/communityVibe";
import useUser from "hooks/useUser";
import type { CategoriesResponse } from "@libs/shared/categories";
import { REGION_POST_CATEGORY } from "@libs/shared/postCategory";
import { POST_BODY_COUNTER_FROM, countPostBodyText, removePostBodyImage } from "@libs/shared/post-body";
import {
  deleteComposeDraft,
  readComposeDraft,
  useComposeDraftAutosave,
  type PostDraft,
} from "@libs/client/composeDraft";
import { ComposeDraftSheet } from "@components/app/ComposeDraftSheet";
import { DEBATE_CATEGORY, DEBATE_MIN_ACCOUNT_AGE_HOURS } from "@libs/shared/debateFormat";
import { regionOf } from "@libs/shared/regions";
import { MY_ACTIVITY_KEY_PREFIXES, POST_KEY_PREFIXES, revalidateByPrefix } from "@libs/client/swrRevalidate";
import {
  POST_COMPOSER_IMAGE_MAX,
  canSubmitPost,
  filterPickedPhotos,
  hasComposerChanges,
  validatePostForm,
  type ComposerPhoto,
  type PostComposerInitial,
  type PostFormErrors,
} from "../_lib/postComposer";
import { PostPickerSheet } from "./PostPickerSheet";
import { SpeciesPickerSheet, defaultSpeciesFromPins } from "./SpeciesPickerSheet";
import {
  PostBodyEditor,
  PostBodyTextCounter,
  PostBodyToolbarButtons,
  normalizedPostBody,
  usePostBodyEditor,
} from "./PostBodyEditor";

/**
 * 게시글 작성·수정 공용 폼(앱 PostComposer). 시안: bredy_app design/mockups/post-upload/A2-karrot.html
 * 헤더 X / "글쓰기"(수정: "게시글 수정") / "완료"(수정: "수정하기") · 선택 row 2개 · 8px 갭 ·
 * 제목 18/600 · 1px 구분선 · 본문 블록(줄 칸 + 사진 칸) · 하단 툴바 52(카메라 · 크기 · 굵게 + n/10).
 */

type SubmitStep = "idle" | "image" | "submit";
type LocalComposerPhoto = Extract<ComposerPhoto, { kind: "local" }>;
type PickerTarget = "category" | "species" | null;

/** 글쓰기 주제 시트: '토론'·'질문'엔 설명 한 줄(앱 PostComposer TOPIC_OPTIONS 와 같다). */
const TOPIC_DESCRIPTIONS: Record<string, string> = {
  토론: "찬반으로 의견을 모아요",
  질문: "답을 구해요",
};
const TOPIC_OPTIONS = POST_CATEGORIES.map((option) =>
  TOPIC_DESCRIPTIONS[option.id] ? { ...option, description: TOPIC_DESCRIPTIONS[option.id] } : option
);

type PostComposerProps =
  | { mode: "create"; defaultCategory?: string; defaultSpecies?: string }
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
  /** 등록 보상 시트(community-vibe §3.4). 구 서버엔 없다. */
  celebrate?: Celebrate | null;
}

/**
 * 임시저장할 본문: 새로 고른 파일 사진(local)은 다시 열 수 없어 자리 표시째 빼고, 올라간 사진 id 만 남긴다(앱과 같다).
 * 뒤 번호부터 빼야 앞 사진 번호가 그대로다.
 */
function toPostDraftBody(body: { description: string; images: ComposerPhoto[] }) {
  let description = body.description;
  for (let index = body.images.length - 1; index >= 0; index -= 1) {
    if (body.images[index].kind === "local") description = removePostBodyImage(description, index);
  }
  const remoteImageIds = body.images.flatMap((photo) => (photo.kind === "remote" ? [photo.id] : []));
  return { description, remoteImageIds };
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
      defaultCategory !== DEBATE_CATEGORY &&
      (defaultCategory !== REGION_POST_CATEGORY || myRegion)
        ? defaultCategory
        : "")
  );
  // 사육 가이드의 '물어보기'(?species=크레스티드 게코)는 종을 미리 고른 채로 연다(앱 docs/prd/species-guide.md F-4).
  const defaultSpecies = props.mode === "create" ? props.defaultSpecies?.trim() || undefined : undefined;
  const [species, setSpecies] = useState(initial?.species ?? defaultSpecies ?? "");
  // 새 글은 관심 카테고리를 하나만 고정했으면 그 값을 미리 채운다(바꾸거나 비울 수 있다).
  // 계정·카테고리 목록이 늦게 오므로 받은 뒤 한 번만 채우고, 그 전에 직접 고르면 채우지 않는다.
  const pinnedCategoryIds = user?.pinnedCategoryIds;
  const { data: categoriesData } = useSWR<CategoriesResponse>(isEdit ? null : "/api/categories");
  const speciesTouchedRef = useRef(isEdit || Boolean(defaultSpecies));
  useEffect(() => {
    if (speciesTouchedRef.current || !user || !categoriesData) return;
    speciesTouchedRef.current = true;
    const preset = defaultSpeciesFromPins(categoriesData.categories, pinnedCategoryIds);
    if (preset) setSpecies(preset);
  }, [user, categoriesData, pinnedCategoryIds]);
  const [title, setTitle] = useState(initial?.title ?? "");
  // 본문은 줄 칸·사진 칸 블록(libs/shared/post-body-editor.ts). 사진 순서 = 본문 순서, 대표 = 맨 위 사진.
  const editor = usePostBodyEditor(initial?.description ?? "", initial?.imageIds ?? []);
  // 수정 화면의 '바뀐 게 있나' 기준. 옛 글은 열기만 해도 사진 자리 표시가 붙으므로 그 결과와 비교한다.
  const [normalizedInitial] = useState(() => {
    if (!initial) return null;
    const normalized = normalizedPostBody(initial.description, initial.imageIds);
    return { ...initial, description: normalized.description, imageIds: normalized.images };
  });
  const [errors, setErrors] = useState<PostFormErrors>({});
  const [submitStep, setSubmitStep] = useState<SubmitStep>("idle");
  // 사진 올리는 중 진행(완료 장 수/올릴 장 수). 앱과 같은 오버레이 카드(시안 A2 ⑤).
  const [uploadProgress, setUploadProgress] = useState({ done: 0, total: 0 });
  const [picker, setPicker] = useState<PickerTarget>(null);
  // 동네 미설정 안내(앱 PostComposer promptRegionRequired). '설정하기' 는 내 동네 설정으로 보낸다.
  const [regionPromptOpen, setRegionPromptOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const body = editor.toBody();
  const values = { title, description: body.description, category, species };
  const isSubmitting = submitStep !== "idle";
  const changed = hasComposerChanges(values, body.images, normalizedInitial);
  const canSubmit = canSubmitPost({
    values,
    photoCount: body.images.length,
    submitting: isSubmitting,
    isEdit,
    changed,
  });
  const { leave, dialog } = useConfirmLeave(changed);
  const celebrateSheet = useCelebrateSheet("post");

  // 임시저장(새 글만, 앱 docs/prd/post-upload.md S-1.임시저장): 열 때 쓰던 글이 있으면 시트로 묻고,
  // 답하기 전엔 저장하지 않는다. 그 뒤로는 1초마다 계정별 localStorage 에 저장한다.
  const draftUserId = isEdit ? null : (user?.id ?? null);
  const [draftPrompt, setDraftPrompt] = useState<PostDraft | null>(null);
  const [draftReady, setDraftReady] = useState(isEdit);
  const draftCheckedRef = useRef(false);
  useEffect(() => {
    if (draftUserId == null || draftCheckedRef.current) return;
    draftCheckedRef.current = true;
    const draft = readComposeDraft("post", draftUserId);
    const hasContent =
      draft && (draft.title.trim() || countPostBodyText(draft.description) > 0 || draft.remoteImageIds.length > 0);
    if (hasContent) setDraftPrompt(draft);
    else setDraftReady(true);
  }, [draftUserId]);
  const draftBody = toPostDraftBody(body);
  const draftValue =
    !isEdit &&
    (title.trim() || countPostBodyText(draftBody.description) > 0 || draftBody.remoteImageIds.length > 0)
      ? { title, category, species, ...draftBody }
      : null;
  const draftAutosave = useComposeDraftAutosave("post", draftUserId, draftValue, draftReady && !isSubmitting);

  const resumeDraft = () => {
    if (draftPrompt) {
      setTitle(draftPrompt.title);
      // '동네' 글은 동네가 있어야 쓸 수 있다(그 사이 동네를 지웠으면 주제를 비운다).
      setCategory(draftPrompt.category === REGION_POST_CATEGORY && !myRegion ? "" : draftPrompt.category);
      speciesTouchedRef.current = true;
      setSpecies(draftPrompt.species);
      editor.reset(draftPrompt.description, draftPrompt.remoteImageIds);
    }
    setDraftPrompt(null);
    setDraftReady(true);
  };
  const discardDraft = () => {
    if (draftUserId != null) deleteComposeDraft("post", draftUserId);
    setDraftPrompt(null);
    setDraftReady(true);
  };

  const clearFieldError = (field: keyof PostFormErrors) =>
    setErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });

  const closeScreen = () => {
    if (window.history.length > 1) router.back();
    else router.replace(initial ? toPostPath(initial.postId, initial.title) : "/");
  };

  const openFilePicker = () => {
    if (isSubmitting) return;
    if (editor.photoCount >= POST_COMPOSER_IMAGE_MAX) {
      toast.error(`사진은 최대 ${POST_COMPOSER_IMAGE_MAX}장까지 첨부할 수 있습니다.`);
      return;
    }
    fileInputRef.current?.click();
  };

  const handleFiles = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!files.length) return;
    const result = filterPickedPhotos(files, editor.photoCount);
    if (result.invalidType) toast.error("이미지 파일만 업로드할 수 있습니다.");
    if (result.oversized) toast.error("이미지는 최대 10MB까지 업로드할 수 있습니다.");
    if (result.overflow) {
      toast.error(`사진은 최대 ${POST_COMPOSER_IMAGE_MAX}장까지 첨부할 수 있습니다.`);
    }
    if (!result.accepted.length) return;
    // 커서 자리에 고른 순서대로 넣는다(커서가 없으면 본문 끝).
    editor.insertFiles(result.accepted);
    clearFieldError("description");
  };

  const submit = async () => {
    if (!canSubmit) return;
    const nextErrors = validatePostForm(values, body.images.length);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      toast.error("입력값을 확인해주세요.");
      return;
    }

    // 저장에 성공해 이동하면 버튼을 잠근 채 둔다(다시 누르기·이탈 가드 재무장 방지).
    let leaving = false;
    try {
      // 새로 고른 사진(local)만 3장씩 동시에 올리고, 결과는 본문 순서대로 받는다(libs/client/uploadQueue.ts).
      // 올라간 사진은 바로 remote 로 바꿔 둔다. 한 장이 실패해 다시 누르면 남은 사진만 올린다.
      // 기존 사진(remote)은 다시 올리지 않고 id 를 그대로 보낸다.
      const pending = body.images.filter((photo): photo is LocalComposerPhoto => photo.kind === "local");
      if (pending.length) setSubmitStep("image");
      const uploadedIds = await uploadInOrder(
        pending,
        async (photo) => {
          const id = await uploadPostImage(photo.file, title.trim());
          editor.replacePhoto(photo.key, id);
          return id;
        },
        { concurrency: 3, onProgress: (done, total) => setUploadProgress({ done, total }) }
      );
      let uploadedIndex = 0;
      const imageIds = body.images.map((photo) =>
        photo.kind === "remote" ? photo.id : uploadedIds[uploadedIndex++]
      );

      setSubmitStep("submit");
      const payload = {
        title: title.trim(),
        description: body.description.trim(),
        category,
        species,
        images: imageIds,
      };
      const response = await authFetch(initial ? `/api/posts/${initial.postId}` : "/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          initial ? { action: "update", ...payload } : { ...payload, image: imageIds[0] ?? "" }
        ),
      });
      const result = (await response.json().catch(() => null)) as PostMutationResponse | null;

      if (response.status === 401) {
        // 새 글은 쓰던 내용을 임시저장한 뒤 로그인으로 보낸다. 돌아오면 '쓰던 글이 있어요' 시트로 이어 쓴다.
        if (!initial) draftAutosave.save();
        toast.error(initial ? "로그인이 필요합니다." : "로그인이 필요합니다. 쓰던 글은 저장해 두었어요.");
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
      // 등록했으면 임시저장을 지운다(기다리던 저장도 버린다).
      draftAutosave.stop();
      if (draftUserId != null) deleteComposeDraft("post", draftUserId);
      revalidateMyPostActivity();
      const postPath = toPostPath(result.post.id, result.post.title);
      leaving = true;
      // 보상 시트가 있으면 0.8초 보여 준 뒤 상세로 간다(없으면 바로).
      if (!result.celebrate) toast.success("게시글이 등록되었습니다.");
      celebrateSheet.show(result.celebrate, () => leave(() => router.replace(postPath)));
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

        {/* 제목 */}
        <div className="px-4 pt-4">
          <input
            value={title}
            disabled={isSubmitting}
            onFocus={editor.clearActive}
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

        {/* 내용 — 줄 칸·사진 칸 블록(시안 A2 ①②) */}
        <div className="px-4 pt-3.5" onInput={() => clearFieldError("description")}>
          <PostBodyEditor
            editor={editor}
            disabled={isSubmitting}
            placeholder="내용을 자유롭게 작성해보세요"
          />
          <ErrorText>{errors.description}</ErrorText>
        </div>
        {/* 본문 아래 빈 곳: 누르면 마지막 줄 끝에서 이어 쓴다(예전 본문 칸 최소 높이 자리). */}
        <button
          type="button"
          aria-label="본문 끝에 이어 쓰기"
          tabIndex={-1}
          disabled={isSubmitting}
          onClick={editor.focusEnd}
          className="block min-h-[200px] w-full cursor-text"
        />
      </div>

      {/* 하단 툴바: 카메라 · 크기 · 굵게 + n/10 */}
      <div className="fixed inset-x-0 bottom-0 mx-auto max-w-xl z-30 border-t border-app-line bg-app-bg pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto flex h-[52px] max-w-xl items-center px-2">
          <PostBodyToolbarButtons editor={editor} disabled={isSubmitting} onPickPhotos={openFilePicker} />
          <PostBodyTextCounter count={editor.textCount} />
          <span
            className={cn(
              "pr-2 text-[14px] text-app-muted",
              editor.textCount >= POST_BODY_COUNTER_FROM ? "" : "ml-auto"
            )}
          >
            {editor.photoCount}/{POST_COMPOSER_IMAGE_MAX}
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
        options={isEdit ? POST_CATEGORIES.filter((o) => o.id !== DEBATE_CATEGORY) : TOPIC_OPTIONS}
        selectedId={category}
        onSelect={(id) => {
          setPicker(null);
          // '토론'은 토론 열기 화면으로 바꿔 연다(앱 docs/prd/live-talk.md §3.3). 가입 하루 전이면 안내만.
          if (id === DEBATE_CATEGORY) {
            const joinedAt = user?.createdAt ? new Date(user.createdAt).getTime() : 0;
            if (joinedAt && Date.now() - joinedAt < DEBATE_MIN_ACCOUNT_AGE_HOURS * 3600_000) {
              toast("가입 하루가 지나면 토론을 열 수 있어요");
              return;
            }
            leave(() => router.replace("/posts/debate"));
            return;
          }
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

      {/* 제출 중 화면 전체 터치 차단 + 사진 올리는 중 n/N 진행 막대(시안 A2 ⑤) */}
      {isSubmitting ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          <div className="absolute inset-0 bg-app-bg opacity-40" aria-hidden="true" />
          {submitStep === "image" && uploadProgress.total > 0 ? (
            <div
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={uploadProgress.total}
              aria-valuenow={uploadProgress.done}
              aria-label={`사진 올리는 중 ${uploadProgress.done}/${uploadProgress.total}`}
              className="relative w-60 rounded-xl border border-app-border bg-app-elevated p-6 shadow-popover"
            >
              <p className="text-center text-[15px] font-semibold text-app-text">
                사진 올리는 중 {uploadProgress.done}/{uploadProgress.total}
              </p>
              <div className="mt-3 h-1 overflow-hidden rounded-full bg-app-surface">
                <div
                  className="h-1 bg-app-brand transition-[width]"
                  style={{ width: `${Math.round((uploadProgress.done / uploadProgress.total) * 100)}%` }}
                />
              </div>
            </div>
          ) : null}
        </div>
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
      <ComposeDraftSheet
        open={draftPrompt !== null}
        title={draftPrompt?.title ?? ""}
        savedAt={draftPrompt?.savedAt ?? ""}
        onResume={resumeDraft}
        onDiscard={discardDraft}
      />
      {dialog}
      {celebrateSheet.sheet}
    </Layout>
  );
}

export default PostComposer;
