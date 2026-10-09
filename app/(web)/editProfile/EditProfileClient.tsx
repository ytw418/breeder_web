"use client";
import { authFetch } from "@libs/client/authFetch";
import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";

import useMutation from "hooks/useMutation";
import useUser from "hooks/useUser";
import Image from "@components/atoms/Image";
import { useRouter } from "next/navigation";

import { toast } from "@libs/client/toast";
import { cn, makeImageUrl } from "@libs/client/utils";
import { NICKNAME_MAX_LENGTH } from "@libs/shared/nickname";
import { BIO_MAX, normalizeBio } from "@libs/shared/profile";
import {
  createNicknameChecker,
  type CheckNameResult,
  type NameCheck,
} from "@components/features/profile/nicknameCheck";
import { LoadingBlock } from "@components/features/profile/ProfileRows";
import { useSWRConfig } from "swr";
import type { UserResponse } from "pages/api/users/[id]";
import { PROFILE_DEPENDENT_KEY_PREFIXES, revalidateByPrefix } from "@libs/client/swrRevalidate";

interface EditProfileResponse {
  success: boolean;
  error?: string;
  message?: string;
}

const NAME_HELP = `닉네임은 최대 ${NICKNAME_MAX_LENGTH}글자까지 입력할 수 있어요.`;
const CAMERA_PATHS = [
  "M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.414-.828A2 2 0 0110.93 3h2.14a2 2 0 011.664.89l.414.828A2 2 0 0016.07 7H17a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z",
  "M15 13a3 3 0 11-6 0 3 3 0 016 0z",
];

const countChars = (value: string) => Array.from(value).length;
/** 서버 normalizeBio 와 같은 기준(앞뒤 공백·줄 끝 공백·연속 개행)으로 비교·저장한다. */
const bioValue = (value: string) => {
  const result = normalizeBio(value);
  return result.ok ? result.bio ?? "" : value.trim();
};

const requestCheckName = async (name: string, signal: AbortSignal): Promise<CheckNameResult> => {
  const res = await authFetch(`/api/users/check-name?name=${encodeURIComponent(name)}`, { signal });
  if (!res.ok) return { success: false };
  return (await res.json()) as CheckNameResult;
};

/** 프로필 수정(앱 editProfile.tsx): 96 아바타 + 카메라 버튼, 닉네임 입력(h48 r8) + 사전 확인, 하단 고정 '저장'. */
const EditProfileClient = () => {
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { mutate: globalMutate, cache: swrCache } = useSWRConfig();
  const { user, isLoading: userLoading, mutate } = useUser();
  const [nameDraft, setNameDraft] = useState("");
  const [hasEditedName, setHasEditedName] = useState(false);
  const [nameError, setNameError] = useState("");
  const [nameCheck, setNameCheck] = useState<NameCheck>("idle");
  const [bioDraft, setBioDraft] = useState("");
  const [hasEditedBio, setHasEditedBio] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [localAvatarUrl, setLocalAvatarUrl] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const checker = useMemo(
    () =>
      createNicknameChecker({
        request: requestCheckName,
        onStatus: (status, reason) => {
          setNameCheck(status);
          if (status === "unavailable") setNameError(reason || "사용할 수 없는 닉네임입니다.");
          // 길이 오류가 있는 입력은 요청하지 않으므로 여기서 지워도 길이 안내를 덮지 않는다.
          if (status === "available") setNameError("");
        },
      }),
    []
  );
  useEffect(() => () => checker.cancel(), [checker]);

  useEffect(() => {
    return () => {
      if (localAvatarUrl) URL.revokeObjectURL(localAvatarUrl);
    };
  }, [localAvatarUrl]);

  const [editProfile] = useMutation<EditProfileResponse>(`/api/users/me`);

  const name = hasEditedName ? nameDraft : user?.name ?? "";

  const onNameChange = (nextName: string) => {
    setHasEditedName(true);
    setNameDraft(nextName);
    checker.schedule(nextName, user?.name);
    if (nextName.length > NICKNAME_MAX_LENGTH) {
      setNameError(`최대 ${NICKNAME_MAX_LENGTH}글자까지 입력가능합니다.`);
      return;
    }
    setNameError("");
  };

  /** 150자를 넘는 입력(붙여넣기 포함)은 잘라 둔다. maxLength 는 이모지(서로게이트 쌍)를 2자로 센다. */
  const onBioChange = (next: string) => {
    setHasEditedBio(true);
    setBioDraft(countChars(next) > BIO_MAX ? Array.from(next).slice(0, BIO_MAX).join("") : next);
  };
  const currentBio = (user as { bio?: string | null } | undefined)?.bio ?? "";
  const bio = hasEditedBio ? bioDraft : currentBio;
  const hasBioChange = bioValue(bio) !== bioValue(currentBio);

  const onAvatarChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setLocalAvatarUrl(file ? URL.createObjectURL(file) : "");
    setAvatarFile(file);
  };

  const hasNameChange = !!name.trim() && name.trim() !== user?.name;
  const canSubmit =
    (hasNameChange || !!avatarFile || hasBioChange) &&
    !isLoading &&
    !nameError &&
    !(hasNameChange && (nameCheck === "checking" || nameCheck === "unavailable"));

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isLoading || !user) return;
    if (name.length > NICKNAME_MAX_LENGTH) {
      toast.error(`닉네임은 최대 ${NICKNAME_MAX_LENGTH}글자까지 입력할 수 있습니다.`);
      return;
    }

    const nextName = name.trim();
    const nextHasNameChange = !!nextName && nextName !== user.name;
    const nextBio = bioValue(bio);
    const nextHasBioChange = nextBio !== bioValue(currentBio);
    if (!nextHasNameChange && !avatarFile && !nextHasBioChange) {
      toast.info("변경된 내용이 없습니다.");
      return;
    }

    setIsLoading(true);
    const editProfileBody = {
      name: nextHasNameChange ? nextName : null,
      avatarId: null as string | null,
      ...(nextHasBioChange ? { bio: nextBio || null } : {}),
    };

    try {
      if (avatarFile) {
        const fileApiRes = await authFetch(`/api/files`);
        if (!fileApiRes.ok) throw new Error("이미지 업로드 URL을 가져오지 못했습니다.");
        const { uploadURL } = await fileApiRes.json();
        if (!uploadURL) throw new Error("이미지 업로드 URL이 유효하지 않습니다.");

        const form = new FormData();
        form.append("file", avatarFile, user.id + "");
        const uploadRes = await fetch(uploadURL, { method: "POST", body: form });
        if (!uploadRes.ok) throw new Error("이미지 업로드에 실패했습니다.");
        const uploadData = await uploadRes.json();
        const id = uploadData?.result?.id;
        if (!id) throw new Error("업로드 이미지 ID를 확인할 수 없습니다.");
        editProfileBody.avatarId = id;
      }

      const result = await editProfile({ data: editProfileBody });
      if (!result.success) {
        const message = result.error || result.message || "프로필 저장에 실패했습니다.";
        // 저장 직전에 다른 사람이 같은 닉네임을 가져간 경우 등: 입력칸 아래에도 남긴다.
        if (nextHasNameChange && message.includes("닉네임")) setNameError(message);
        toast.error(message);
        return;
      }

      const nextProfile = {
        ...user,
        name: nextHasNameChange ? nextName : user.name,
        avatar: editProfileBody.avatarId ?? user.avatar,
        ...(nextHasBioChange ? { bio: nextBio || null } : {}),
      };
      // 저장 직후 UI에서 바로 반영되도록 SWR 캐시를 먼저 갱신한다.
      await Promise.all([
        mutate((prev) => (prev ? { ...prev, profile: { ...prev.profile, ...nextProfile } } : prev), false),
        globalMutate(
          `/api/users/${user.id}`,
          (prev: UserResponse | undefined) =>
            prev?.user ? { ...prev, user: { ...prev.user, ...nextProfile } } : prev,
          false
        ),
      ]);
      // 낙관적 반영 뒤 백그라운드 재검증으로 서버 상태와 동기화한다.
      void mutate();
      // 작성자 이름·사진을 그리는 목록·상세와 내 활동 목록을 모두 다시 받는다(앱 editProfile invalidate 묶음).
      revalidateByPrefix({ cache: swrCache, mutate: globalMutate }, PROFILE_DEPENDENT_KEY_PREFIXES);

      toast.success("프로필이 저장되었습니다.");
      router.replace("/myPage");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "프로필 저장 중 오류가 발생했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  if (userLoading || !user) {
    return <LoadingBlock height={320} />;
  }

  const previewSrc = localAvatarUrl || (user.avatar ? makeImageUrl(user.avatar, "avatar") : "");

  return (
    <form onSubmit={onSubmit} className="bg-app-bg">
      <div className="px-5 pb-[calc(96px+env(safe-area-inset-bottom))] pt-8">
        {/* 아바타 */}
        <div className="flex justify-center">
          <div className="relative h-24 w-24">
            <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-app-surface">
              {previewSrc ? (
                <Image
                  alt="프로필 이미지"
                  src={previewSrc}
                  height={96}
                  width={96}
                  unoptimized={Boolean(localAvatarUrl)}
                  className="h-24 w-24 object-cover"
                />
              ) : (
                <span className="text-[32px] font-bold text-app-muted">{user.name?.trim().charAt(0) || "브"}</span>
              )}
            </div>
            <button
              type="button"
              aria-label="프로필 이미지 변경"
              disabled={isLoading}
              onClick={() => fileInputRef.current?.click()}
              className="absolute bottom-0 right-0 flex h-7 w-7 items-center justify-center rounded-full border-2 border-app-bg bg-app-text text-app-bg"
            >
              <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
                {CAMERA_PATHS.map((d) => (
                  <path key={d} d={d} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
                ))}
              </svg>
            </button>
            <input
              ref={fileInputRef}
              id="picture"
              type="file"
              className="hidden"
              accept="image/*"
              disabled={isLoading}
              onChange={onAvatarChange}
            />
          </div>
        </div>

        {/* 닉네임 */}
        <div className="mt-8">
          <label htmlFor="nickname" className="mb-2 block text-[15px] font-semibold text-app-text">
            닉네임
          </label>
          <input
            id="nickname"
            type="text"
            value={name}
            onChange={(event) => onNameChange(event.target.value)}
            disabled={isLoading}
            placeholder="닉네임을 입력해주세요"
            maxLength={NICKNAME_MAX_LENGTH}
            aria-invalid={Boolean(nameError)}
            aria-describedby="nickname-help"
            className={cn(
              "h-12 w-full rounded-lg border bg-app-bg px-3.5 text-[15px] text-app-text outline-none placeholder:text-app-caption focus:ring-0",
              nameError ? "border-app-danger focus:border-app-danger" : "border-app-border focus:border-app-text"
            )}
          />
          <p
            id="nickname-help"
            aria-live="polite"
            className={cn("mt-2 text-[13px]", nameError ? "text-app-danger" : "text-app-muted")}
          >
            {nameError || NAME_HELP}
          </p>
        </div>

        {/* 소개(사진형 프로필 A안 S-5) */}
        <div className="mt-6">
          <label htmlFor="bio" className="mb-2 block text-[15px] font-semibold text-app-text">
            소개
          </label>
          <textarea
            id="bio"
            value={bio}
            onChange={(event) => onBioChange(event.target.value)}
            disabled={isLoading}
            placeholder="어떤 아이들을 키우는지 적어 보세요"
            className="h-[136px] w-full resize-none rounded-lg border border-app-border bg-app-bg px-3.5 py-3 text-[15px] leading-[22px] text-app-text outline-none placeholder:text-app-caption focus:border-app-text focus:ring-0"
          />
          <p className="mt-2 text-right text-[13px] text-app-muted">
            {countChars(bio)}/{BIO_MAX}
          </p>
        </div>
      </div>

      {/* 하단 고정 CTA */}
      <div className="fixed inset-x-0 bottom-0 mx-auto max-w-xl z-30 border-t border-app-line bg-app-bg">
        <div className="mx-auto max-w-xl px-5 pb-[max(12px,env(safe-area-inset-bottom))] pt-2">
          <button
            type="submit"
            disabled={!canSubmit}
            className={cn(
              "flex h-[52px] w-full items-center justify-center rounded-md text-[16px] font-semibold",
              canSubmit ? "bg-app-brand text-white" : "bg-app-surface text-app-muted"
            )}
          >
            {isLoading ? (
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              "저장"
            )}
          </button>
        </div>
      </div>
    </form>
  );
};

export default EditProfileClient;
