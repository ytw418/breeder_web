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
import { BIO_MAX, PROFILE_LINK_MAX, normalizeBio, normalizeProfileLink } from "@libs/shared/profile";
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
  errorCode?: string;
}

/** Cloudflare 직접 업로드 후 이미지 id 를 돌려준다(아바타·커버 공용). */
const uploadImage = async (file: File, name: string) => {
  const fileApiRes = await authFetch(`/api/files`);
  if (!fileApiRes.ok) throw new Error("이미지 업로드 URL을 가져오지 못했습니다.");
  const { uploadURL } = await fileApiRes.json();
  if (!uploadURL) throw new Error("이미지 업로드 URL이 유효하지 않습니다.");
  const form = new FormData();
  form.append("file", file, name);
  const uploadRes = await fetch(uploadURL, { method: "POST", body: form });
  if (!uploadRes.ok) throw new Error("이미지 업로드에 실패했습니다.");
  const uploadData = await uploadRes.json();
  const id = uploadData?.result?.id;
  if (!id) throw new Error("업로드 이미지 ID를 확인할 수 없습니다.");
  return id as string;
};

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

/**
 * 프로필 수정(앱 editProfile.tsx): 맨 위 3:1 커버(v5) + 40 겹친 96 아바타 + 카메라 버튼, 닉네임 입력(h48 r8) + 사전 확인,
 * 소개 300자, 대표 링크 1개(v5), 하단 고정 '저장'.
 */
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
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [localBannerUrl, setLocalBannerUrl] = useState("");
  const [bannerRemoved, setBannerRemoved] = useState(false);
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const [linkDraft, setLinkDraft] = useState("");
  const [hasEditedLink, setHasEditedLink] = useState(false);
  const [linkError, setLinkError] = useState("");

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
  useEffect(() => {
    return () => {
      if (localBannerUrl) URL.revokeObjectURL(localBannerUrl);
    };
  }, [localBannerUrl]);

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

  /** BIO_MAX 자를 넘는 입력(붙여넣기 포함)은 잘라 둔다. maxLength 는 이모지(서로게이트 쌍)를 2자로 센다. */
  const onBioChange = (next: string) => {
    setHasEditedBio(true);
    setBioDraft(countChars(next) > BIO_MAX ? Array.from(next).slice(0, BIO_MAX).join("") : next);
  };
  const currentBio = (user as { bio?: string | null } | undefined)?.bio ?? "";
  const bio = hasEditedBio ? bioDraft : currentBio;
  const hasBioChange = bioValue(bio) !== bioValue(currentBio);

  const profileExtra = user as { profileBanner?: string | null; profileLink?: string | null } | undefined;
  const currentLink = profileExtra?.profileLink ?? "";
  const link = hasEditedLink ? linkDraft : currentLink;
  const hasLinkChange = link.trim() !== currentLink;
  const onLinkChange = (next: string) => {
    setHasEditedLink(true);
    setLinkDraft(next);
    setLinkError("");
  };

  const currentBanner = profileExtra?.profileBanner ?? null;
  const hasBannerChange = Boolean(bannerFile) || (bannerRemoved && Boolean(currentBanner));
  const onBannerChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    event.target.value = "";
    if (!file) return;
    setLocalBannerUrl(URL.createObjectURL(file));
    setBannerFile(file);
    setBannerRemoved(false);
  };
  const onBannerRemove = () => {
    setLocalBannerUrl("");
    setBannerFile(null);
    setBannerRemoved(true);
  };

  const onAvatarChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setLocalAvatarUrl(file ? URL.createObjectURL(file) : "");
    setAvatarFile(file);
  };

  const hasNameChange = !!name.trim() && name.trim() !== user?.name;
  const canSubmit =
    (hasNameChange || !!avatarFile || hasBioChange || hasLinkChange || hasBannerChange) &&
    !isLoading &&
    !nameError &&
    !linkError &&
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
    const linkResult = normalizeProfileLink(link);
    if (!linkResult.ok) {
      setLinkError(linkResult.message);
      return;
    }
    const nextLink = linkResult.link;
    const nextHasLinkChange = (nextLink ?? "") !== currentLink;
    if (!nextHasNameChange && !avatarFile && !nextHasBioChange && !nextHasLinkChange && !hasBannerChange) {
      toast.info("변경된 내용이 없습니다.");
      return;
    }

    setIsLoading(true);
    const editProfileBody = {
      name: nextHasNameChange ? nextName : null,
      avatarId: null as string | null,
      ...(nextHasBioChange ? { bio: nextBio || null } : {}),
      ...(nextHasLinkChange ? { profileLink: nextLink } : {}),
    } as {
      name: string | null;
      avatarId: string | null;
      bio?: string | null;
      profileLink?: string | null;
      bannerId?: string | null;
    };

    try {
      if (avatarFile) {
        editProfileBody.avatarId = await uploadImage(avatarFile, user.id + "");
      }
      if (bannerFile) {
        try {
          editProfileBody.bannerId = await uploadImage(bannerFile, `${user.id}-banner`);
        } catch {
          throw new Error("커버 사진을 올리지 못했어요.");
        }
      } else if (bannerRemoved && currentBanner) {
        editProfileBody.bannerId = null;
      }

      const result = await editProfile({ data: editProfileBody });
      if (!result.success) {
        const message = result.error || result.message || "프로필 저장에 실패했습니다.";
        // 저장 직전에 다른 사람이 같은 닉네임을 가져간 경우 등: 입력칸 아래에도 남긴다.
        if (nextHasNameChange && message.includes("닉네임")) setNameError(message);
        if (result.errorCode?.startsWith("LINK_")) setLinkError(message);
        toast.error(message);
        return;
      }

      const nextProfile = {
        ...user,
        name: nextHasNameChange ? nextName : user.name,
        avatar: editProfileBody.avatarId ?? user.avatar,
        ...(nextHasBioChange ? { bio: nextBio || null } : {}),
        ...(nextHasLinkChange ? { profileLink: nextLink } : {}),
        ...("bannerId" in editProfileBody ? { profileBanner: editProfileBody.bannerId ?? null } : {}),
      };
      // 저장 직후 UI에서 바로 반영되도록 SWR 캐시를 먼저 갱신한다.
      await Promise.all([
        mutate((prev) => (prev ? { ...prev, profile: { ...prev.profile, ...nextProfile } } : prev), false),
        globalMutate(
          `/api/users/${user.id}`,
          (prev: UserResponse | undefined) => (prev?.user ? { ...prev, user: { ...prev.user, ...nextProfile } } : prev),
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
  const bannerSrc = localBannerUrl || (!bannerRemoved && currentBanner ? makeImageUrl(currentBanner, "public") : "");

  return (
    <form onSubmit={onSubmit} className="bg-app-bg">
      {/* 커버(v5): 전체 폭 3:1, 오른쪽 아래 '커버 변경'·'커버 삭제' 칩 */}
      <div className="relative aspect-[3/1] w-full overflow-hidden bg-app-surface">
        {bannerSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={bannerSrc} alt="커버 사진" className="h-full w-full object-cover" />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-app-caption">
            <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
              <path
                d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z"
                strokeWidth={1.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
        )}
        <div className="absolute bottom-2.5 right-3 flex gap-1.5">
          {bannerSrc ? (
            <button
              type="button"
              disabled={isLoading}
              onClick={onBannerRemove}
              className="flex h-7 items-center rounded-full border border-app-border bg-app-bg px-2.5 text-[12px] font-semibold text-app-text"
            >
              커버 삭제
            </button>
          ) : null}
          <button
            type="button"
            disabled={isLoading}
            onClick={() => bannerInputRef.current?.click()}
            className="flex h-7 items-center gap-1 rounded-full border border-app-border bg-app-bg px-2.5 text-[12px] font-semibold text-app-text"
          >
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
              {CAMERA_PATHS.map((d) => (
                <path key={d} d={d} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
              ))}
            </svg>
            {bannerSrc ? "커버 변경" : "커버 추가"}
          </button>
        </div>
        <input
          ref={bannerInputRef}
          type="file"
          className="hidden"
          accept="image/*"
          disabled={isLoading}
          onChange={onBannerChange}
        />
      </div>

      <div className="px-5 pb-[calc(96px+env(safe-area-inset-bottom))]">
        {/* 아바타 — 커버 아래로 40 겹친다. 줄 전체가 커버 칩 위를 덮으니 빈 곳 터치는 커버로 넘긴다 */}
        <div className="pointer-events-none relative z-[1] -mt-10 flex justify-center">
          <div className="pointer-events-auto relative h-24 w-24 rounded-full bg-app-bg ring-[3px] ring-app-bg">
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

        {/* 대표 링크(v5) */}
        <div className="mt-6">
          <label htmlFor="profile-link" className="mb-2 block text-[15px] font-semibold text-app-text">
            대표 링크
          </label>
          <input
            id="profile-link"
            type="url"
            inputMode="url"
            autoCapitalize="none"
            autoCorrect="off"
            value={link}
            onChange={(event) => onLinkChange(event.target.value)}
            disabled={isLoading}
            placeholder="https://"
            maxLength={PROFILE_LINK_MAX}
            aria-invalid={Boolean(linkError)}
            aria-describedby="profile-link-help"
            className={cn(
              "h-12 w-full rounded-lg border bg-app-bg px-3.5 text-[15px] text-app-text outline-none placeholder:text-app-caption focus:ring-0",
              linkError ? "border-app-danger focus:border-app-danger" : "border-app-border focus:border-app-text"
            )}
          />
          <p
            id="profile-link-help"
            aria-live="polite"
            className={cn("mt-2 text-[13px]", linkError ? "text-app-danger" : "text-app-muted")}
          >
            {linkError || "블로그·유튜브·인스타그램 주소 하나를 적을 수 있어요"}
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
