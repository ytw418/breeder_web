"use client";
/**
 * 가입 직후 '시작하기'(앱 src/app/welcome.tsx, 앱 design/mockups/profile/A-karrot.html '#welcome',
 * 앱 docs/prd/profile.md §12, 2026-10-21 감사 19번). 무작위 이름 확인·사진 고르기·내 동네 →
 * 같은 생물 키우는 브리더 3명 팔로우 → 첫 인사 글. '건너뛰기'는 늘 보이고, 이름을 고치면 '완료'가 돼 저장한 뒤 next 로 간다.
 */
import { ChangeEvent, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import useSWR, { useSWRConfig } from "swr";
import useUser from "hooks/useUser";
import useScopeTerms from "@/hooks/useScopeTerms";
import SuggestedBreederRow from "@components/features/profile/SuggestedBreederRow";
import { ProfileAvatar } from "@components/features/profile/ProfileRows";
import { regionSettingsHref } from "@components/features/region/regionHref";
import { authFetch } from "@libs/client/authFetch";
import { getSafeNextPath } from "@libs/client/postLogin";
import { PROFILE_DEPENDENT_KEY_PREFIXES, revalidateByPrefix } from "@libs/client/swrRevalidate";
import { toast } from "@libs/client/toast";
import { uploadImageFile } from "@libs/client/uploadImage";
import { cn } from "@libs/client/utils";
import { NICKNAME_MAX_LENGTH } from "@libs/shared/nickname";
import { REGION_POST_CATEGORY } from "@libs/shared/postCategory";
import { withBreederWord } from "@libs/shared/scopeTerms";
import type { SuggestedUsersResponse } from "pages/api/users/suggested";

const SUGGESTED_KEY = "/api/users/suggested?limit=3";
const FREE_POST_CATEGORY = "자유";
const AVATAR = 80;

interface EditProfileResult {
  success?: boolean;
  error?: string;
  message?: string;
}

const saveProfile = async (body: Record<string, unknown>) => {
  const res = await authFetch("/api/users/me", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return ((await res.json().catch(() => null)) ?? {}) as EditProfileResult;
};

export default function WelcomeClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = getSafeNextPath(searchParams?.get("next") ?? null);
  const { user, mutate } = useUser();
  const { mutate: globalMutate, cache } = useSWRConfig();
  const { breeder } = useScopeTerms();
  const { data: suggestedData, isLoading: suggestedLoading } = useSWR<SuggestedUsersResponse>(SUGGESTED_KEY);
  const suggested = suggestedData?.users ?? [];
  // 처음 그린 이름(무작위 이름)에서 고친 값. null 이면 아직 손대지 않았다.
  const [nameDraft, setNameDraft] = useState<string | null>(null);
  const [nameError, setNameError] = useState("");
  const [saving, setSaving] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  if (!user) return null;

  const name = nameDraft ?? user.name;
  const trimmedName = name.trim();
  const nameChanged = trimmedName !== user.name;
  const region = user.regionSido && user.regionSigungu ? `${user.regionSido} ${user.regionSigungu}` : null;
  const busy = saving || avatarUploading;
  const welcomePath = nextPath === "/" ? "/welcome" : `/welcome?next=${encodeURIComponent(nextPath)}`;

  const refreshProfile = () => {
    void mutate();
    revalidateByPrefix({ cache, mutate: globalMutate }, PROFILE_DEPENDENT_KEY_PREFIXES);
  };

  /** 고친 이름이 있으면 저장한다. 실패하면 입력칸 아래에 사유를 남기고 false. */
  const saveName = async () => {
    if (!nameChanged) return true;
    if (!trimmedName) {
      setNameError("닉네임을 입력해 주세요.");
      return false;
    }
    setSaving(true);
    try {
      const result = await saveProfile({ name: trimmedName });
      if (!result.success) {
        setNameError(result.error || result.message || "닉네임을 저장하지 못했어요.");
        return false;
      }
      refreshProfile();
      return true;
    } catch {
      setNameError("닉네임을 저장하지 못했어요.");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const finish = async () => {
    if (busy) return;
    if (!(await saveName())) return;
    router.replace(nextPath);
  };

  const writeFirstPost = async () => {
    if (busy) return;
    if (!(await saveName())) return;
    const category = region ? REGION_POST_CATEGORY : FREE_POST_CATEGORY;
    router.push(`/posts/upload?category=${encodeURIComponent(category)}`);
  };

  /** 사진을 직접 고른다(소셜 사진은 넣지 않는다 — 앱 profile.md v7). 고르면 바로 올리고 저장한다. */
  const onAvatarChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || avatarUploading) return;
    const preview = URL.createObjectURL(file);
    setAvatarPreview(preview);
    setAvatarUploading(true);
    try {
      const avatarId = await uploadImageFile(file, String(user.id));
      const result = await saveProfile({ avatarId });
      if (!result.success) throw new Error(result.error || "사진을 저장하지 못했어요.");
      refreshProfile();
    } catch (error) {
      setAvatarPreview(null);
      toast.error(error instanceof Error ? error.message : "사진을 저장하지 못했어요.");
    } finally {
      setAvatarUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-app-bg">
      <header className="sticky top-0 z-30 flex h-14 items-center justify-center border-b border-app-border bg-app-bg">
        <h1 className="text-[16px] font-semibold text-app-text">시작하기</h1>
        <button
          type="button"
          onClick={() => void finish()}
          disabled={busy}
          className={cn(
            "absolute right-0 h-11 px-4 text-[13px]",
            nameChanged ? "font-semibold text-app-text" : "text-app-muted"
          )}
        >
          {nameChanged ? "완료" : "건너뛰기"}
        </button>
      </header>

      <main className="pb-10">
        {/* 1. 내 이름 */}
        <section className="px-4 pt-6">
          <h2 className="mb-3 text-[15px] font-bold text-app-text">내 이름</h2>
          <div className="flex items-center gap-4">
            <button
              type="button"
              aria-label="프로필 사진 고르기"
              onClick={() => fileRef.current?.click()}
              className="relative shrink-0 rounded-full"
              style={{ width: AVATAR, height: AVATAR }}
            >
              {avatarPreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={avatarPreview}
                  alt="고른 프로필 사진"
                  className="rounded-full object-cover"
                  style={{ width: AVATAR, height: AVATAR }}
                />
              ) : (
                <ProfileAvatar avatar={user.avatar} name={trimmedName || user.name} size={AVATAR} />
              )}
              {avatarUploading ? (
                <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/20">
                  <span className="h-5 w-5 animate-spin rounded-full border-2 border-white/60 border-t-white" />
                </span>
              ) : null}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => void onAvatarChange(event)}
            />
            <div className="min-w-0 flex-1">
              <input
                value={name}
                onChange={(event) => {
                  setNameDraft(event.target.value);
                  setNameError("");
                }}
                disabled={saving}
                maxLength={NICKNAME_MAX_LENGTH}
                placeholder="닉네임"
                aria-label="닉네임"
                className={cn(
                  "h-12 w-full rounded-lg border bg-app-bg px-4 text-[15px] text-app-text outline-none placeholder:text-app-caption focus:border-app-text",
                  nameError ? "border-app-danger" : "border-app-border"
                )}
              />
              <p className={cn("mt-1.5 text-[11px] leading-[15px]", nameError ? "text-app-danger" : "text-app-muted")}>
                {nameError || "지금 안 바꿔도 돼요"}
              </p>
            </div>
          </div>
          <Link
            href={regionSettingsHref(welcomePath)}
            className="mt-4 flex h-12 items-center justify-between border-y border-app-line"
          >
            <span className="text-[15px] text-app-text">내 동네 설정</span>
            <span className="flex items-center gap-1 text-[13px] text-app-muted">
              {region}
              <span aria-hidden>›</span>
            </span>
          </Link>
        </section>

        {/* 2. 같은 생물 키우는 브리더 팔로우(추천이 없으면 숨긴다) */}
        {suggested.length ? (
          <section className="pt-7">
            <h2 className="mb-3 px-4 text-[15px] font-bold text-app-text">
              {withBreederWord("같은 생물 키우는 브리더 팔로우", breeder)}
            </h2>
            {suggested.map((row) => (
              <SuggestedBreederRow key={row.id} user={row} returnPath={welcomePath} />
            ))}
          </section>
        ) : suggestedLoading ? (
          <div className="flex justify-center py-7">
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-app-border border-t-app-muted" />
          </div>
        ) : null}

        {/* 3. 첫 인사 글 */}
        <section className="px-4 pt-7">
          <button
            type="button"
            onClick={() => void writeFirstPost()}
            disabled={busy}
            className="flex h-12 w-full items-center justify-center rounded-lg bg-app-inverse text-[15px] font-semibold text-app-inverse-text disabled:opacity-60"
          >
            첫 인사 글 쓰기
          </button>
        </section>
      </main>
    </div>
  );
}
