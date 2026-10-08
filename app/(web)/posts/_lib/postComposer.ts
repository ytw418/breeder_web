/**
 * 게시글 작성·수정 폼(PostComposer)과 상세 ⋯ 메뉴의 순수 규칙.
 * 앱 bredy_app src/components/features/post/PostComposer.tsx · src/app/posts/[id].tsx 와 같은 규칙·문구.
 */

import { POST_IMAGES_MAX } from "@libs/postImages";
import { countPostBodyText } from "@libs/shared/post-body";

export const POST_TITLE_MIN = 2;
export const POST_TITLE_MAX = 80;
export const POST_DESCRIPTION_MIN = 10;
export const POST_DESCRIPTION_MAX = 2000;
export const POST_IMAGE_MAX_BYTES = 10 * 1024 * 1024;
export const POST_COMPOSER_IMAGE_MAX = POST_IMAGES_MAX;

export type PostFormErrors = {
  title?: string;
  description?: string;
  category?: string;
};

export type PostFormValues = {
  title: string;
  description: string;
  category: string;
  species: string;
};

/** 수정 화면 초기값. species 는 서버 post.type. */
export type PostComposerInitial = PostFormValues & {
  postId: number;
  imageIds: string[];
};

/** 사진: 서버에 이미 있는 사진(remote, 다시 올리지 않음) / 새로 고른 파일(local). */
export type ComposerPhoto =
  | { kind: "remote"; key: string; id: string }
  | { kind: "local"; key: string; file: File; previewUrl: string };

/** 제출 전 검사. 앱 validate() 와 같은 문구. */
export function validatePostForm(values: PostFormValues): PostFormErrors {
  const errors: PostFormErrors = {};
  const title = values.title.trim();
  const description = values.description.trim();

  if (!values.category) errors.category = "카테고리를 선택해주세요.";
  if (!title) errors.title = "제목을 입력해주세요.";
  else if (title.length < POST_TITLE_MIN) errors.title = "제목은 2자 이상 입력해주세요.";
  else if (title.length > POST_TITLE_MAX) errors.title = "제목은 80자 이하로 입력해주세요.";
  // 글자 수는 사진 자리·크게·굵게 표시를 뺀 글자로 센다(libs/shared/post-body.ts, 앱과 같음).
  const bodyLength = countPostBodyText(description);
  if (!description) errors.description = "내용을 입력해주세요.";
  else if (bodyLength < POST_DESCRIPTION_MIN)
    errors.description = "내용을 10자 이상 입력해주세요.";
  else if (bodyLength > POST_DESCRIPTION_MAX)
    errors.description = "내용은 2000자 이하로 입력해주세요.";
  return errors;
}

/** 앱에서 쓴 글처럼 본문에 사진 자리·크게·굵게 표시가 있는지(웹 글쓰기 안내 줄 노출). */
export function hasPostBodyMarks(description: string): boolean {
  return /^(\[\[photo:[1-9]\d*\]\]$|## |\*\*.+\*\*$)/m.test(description);
}

/** 작성은 입력한 내용이 있으면, 수정은 불러온 값에서 바뀐 게 있으면 true. */
export function hasComposerChanges(
  values: PostFormValues,
  photos: readonly ComposerPhoto[],
  initial: PostComposerInitial | null
): boolean {
  if (!initial) {
    return Boolean(values.title.trim() || values.description.trim() || photos.length);
  }
  return (
    values.title !== initial.title ||
    values.description !== initial.description ||
    values.category !== initial.category ||
    values.species !== initial.species ||
    photos.length !== initial.imageIds.length ||
    photos.some(
      (photo, index) => photo.kind !== "remote" || photo.id !== initial.imageIds[index]
    )
  );
}

/** 헤더 "완료"/"수정하기" 활성 조건: 주제·제목·내용이 모두 있고(수정은 바뀐 게 있고) 제출 중이 아님. */
export function canSubmitPost({
  values,
  submitting,
  isEdit,
  changed,
}: {
  values: PostFormValues;
  submitting: boolean;
  isEdit: boolean;
  changed: boolean;
}): boolean {
  return (
    !submitting &&
    (!isEdit || changed) &&
    Boolean(values.category) &&
    Boolean(values.title.trim()) &&
    Boolean(values.description.trim())
  );
}

export type PhotoPickResult = {
  accepted: File[];
  invalidType: boolean;
  oversized: boolean;
  overflow: boolean;
};

/** 고른 파일을 형식·용량·남은 장수로 거른다(앱 pickImage 와 같은 규칙). */
export function filterPickedPhotos(files: readonly File[], currentCount: number): PhotoPickResult {
  const remaining = Math.max(0, POST_COMPOSER_IMAGE_MAX - currentCount);
  let invalidType = false;
  let oversized = false;
  const valid = files.filter((file) => {
    if (!file.type.startsWith("image/")) {
      invalidType = true;
      return false;
    }
    if (file.size > POST_IMAGE_MAX_BYTES) {
      oversized = true;
      return false;
    }
    return true;
  });
  return {
    accepted: valid.slice(0, remaining),
    invalidType,
    oversized,
    overflow: valid.length > remaining,
  };
}

/** 공지 판별(서버 postNotice 와 같은 규칙): 카테고리 "공지" 또는 제목이 "[공지]" 로 시작. */
export function isNoticePost(post?: { category?: string | null; title?: string | null } | null) {
  return post?.category === "공지" || String(post?.title || "").startsWith("[공지]");
}

export type PostMenuActionKey =
  | "edit"
  | "delete"
  | "profile-pin"
  | "share"
  | "copy-link"
  | "report"
  | "block";

/**
 * 상세 ⋯ 시트 행 순서(앱 sheetActions):
 * - 본인 글(공지 제외): 수정하기 · 삭제하기 · (사진 글이면) 프로필에 고정/해제 · 공유하기 · 링크 복사
 * - 공지·작성자 없음: 공유하기 · 링크 복사
 * - 남의 글: 공유하기 · 링크 복사 · 신고하기 · 작성자 차단(이미 차단했으면 뺀다)
 */
export function getPostMenuActionKeys({
  isOwn,
  isNotice,
  hasAuthor,
  authorBlocked,
  canProfilePin = false,
}: {
  isOwn: boolean;
  isNotice: boolean;
  hasAuthor: boolean;
  authorBlocked: boolean;
  /** 내 사진 글이면 프로필 사진 그리드 맨 앞 고정/해제(사진형 프로필 PRD F-6). */
  canProfilePin?: boolean;
}): PostMenuActionKey[] {
  const base: PostMenuActionKey[] = ["share", "copy-link"];
  if (isOwn && !isNotice) {
    return ["edit", "delete", ...(canProfilePin ? (["profile-pin"] as const) : []), ...base];
  }
  if (isNotice || !hasAuthor) return base;
  return authorBlocked ? [...base, "report"] : [...base, "report", "block"];
}
