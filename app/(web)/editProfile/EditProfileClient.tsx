"use client";
import { ChangeEvent, FormEvent, useEffect, useState } from "react";

import useMutation from "hooks/useMutation";
import useUser from "hooks/useUser";
import Image from "@components/atoms/Image";
import { useRouter } from "next/navigation";

import { Input } from "@components/ui/input";
import { Button } from "@components/ui/button";
import { toast } from "react-toastify";
import { useSWRConfig } from "swr";
import { UserResponse } from "pages/api/users/[id]";

interface EditProfileResponse {
  success: boolean;
  error?: string;
  message?: string;
}

const resolveAvatarUrl = (avatar?: string | null) => {
  if (!avatar) return "";
  if (avatar.startsWith("http")) return avatar;
  return `https://imagedelivery.net/OvWZrAz6J6K7n9LKUH5pKw/${avatar}/avatar`;
};

const EditProfileClient = () => {
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { mutate: globalMutate } = useSWRConfig();
  const { user, mutate } = useUser();
  const [name, setName] = useState("");
  const [nameError, setNameError] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [localAvatarUrl, setLocalAvatarUrl] = useState("");
  const [hasInitialized, setHasInitialized] = useState(false);

  useEffect(() => {
    if (!user || hasInitialized) return;
    setName(user.name ?? "");
    setHasInitialized(true);
  }, [hasInitialized, user?.id, user?.name]);

  useEffect(() => {
    return () => {
      if (localAvatarUrl) URL.revokeObjectURL(localAvatarUrl);
    };
  }, [localAvatarUrl]);

  const [editProfile] = useMutation<EditProfileResponse>(`/api/users/me`);

  const onNameChange = (nextName: string) => {
    setName(nextName);
    if (nextName.length > 10) {
      setNameError("최대 10글자까지 입력가능합니다.");
      return;
    }
    setNameError("");
  };

  const onAvatarChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    setLocalAvatarUrl(file ? URL.createObjectURL(file) : "");
    setAvatarFile(file);
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isLoading) return;
    if (name.length > 10) {
      toast.error("닉네임은 최대 10글자까지 입력할 수 있습니다.");
      return;
    }

    const nextName = name.trim();
    const hasNameChange = !!nextName && nextName !== user?.name;
    const hasAvatarChange = !!avatarFile;

    if (!hasNameChange && !hasAvatarChange) {
      toast.info("변경된 내용이 없습니다.");
      return;
    }

    setIsLoading(true);

    const editProfileBody = {
      name: hasNameChange ? nextName : null,
      avatarId: null as string | null,
    };

    try {
      if (avatarFile && user) {
        const fileApiRes = await fetch(`/api/files`);
        if (!fileApiRes.ok) {
          throw new Error("이미지 업로드 URL을 가져오지 못했습니다.");
        }
        const { uploadURL } = await fileApiRes.json();
        if (!uploadURL) {
          throw new Error("이미지 업로드 URL이 유효하지 않습니다.");
        }

        const form = new FormData();
        form.append("file", avatarFile, user?.id + "");

        const uploadRes = await fetch(uploadURL, {
          method: "POST",
          body: form,
        });
        if (!uploadRes.ok) {
          throw new Error("이미지 업로드에 실패했습니다.");
        }
        const uploadData = await uploadRes.json();
        const id = uploadData?.result?.id;
        if (!id) {
          throw new Error("업로드 이미지 ID를 확인할 수 없습니다.");
        }

        editProfileBody.avatarId = id;
      }

      const result = await editProfile({
        data: editProfileBody,
      });

      if (!result.success) {
        toast.error(result.error || result.message || "프로필 저장에 실패했습니다.");
        return;
      }

      if (user?.id) {
        const nextProfile = {
          ...user,
          name: hasNameChange ? nextName : user.name,
          avatar: editProfileBody.avatarId ?? user.avatar,
        };

        // 저장 직후 UI에서 바로 반영되도록 SWR 캐시를 먼저 갱신한다.
        await Promise.all([
          mutate((prev: any) => {
            if (!prev) return prev;
            return { ...prev, profile: { ...prev.profile, ...nextProfile } };
          }, false),
          globalMutate("/api/users/me", (prev: any) => {
            if (!prev) return prev;
            return { ...prev, profile: { ...prev.profile, ...nextProfile } };
          }, false),
          globalMutate(`/api/users/${user.id}`, (prev: UserResponse | undefined) => {
            if (!prev?.user) return prev;
            return { ...prev, user: { ...prev.user, ...nextProfile } };
          }, false),
        ]);

        // 낙관적 반영 뒤 백그라운드 재검증으로 서버 상태와 동기화한다.
        void mutate();
        void globalMutate("/api/users/me");
        void globalMutate(`/api/users/${user.id}`);
      }

      toast.success("프로필이 저장되었습니다.");
      router.replace("/myPage");
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "프로필 저장 중 오류가 발생했습니다.";
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };
  const hasNameChange = !!name.trim() && name.trim() !== user?.name;
  const canSubmit =
    (hasNameChange || !!avatarFile) && !isLoading && !nameError;
  const remoteAvatarUrl = resolveAvatarUrl(user?.avatar);
  const previewSrc = localAvatarUrl || remoteAvatarUrl;

  return (
    <form onSubmit={onSubmit} className="max-w-2xl mx-auto p-6 space-y-8">
      <div className="bg-white rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.08)] p-6">
        <div className="flex flex-col items-center space-y-6">
          <div className="relative group">
            {previewSrc ? (
              <Image
                alt="프로필 이미지"
                src={previewSrc}
                height={96}
                width={96}
                className="w-24 h-24 rounded-full object-cover ring-2 ring-primary/10 group-hover:ring-primary/20 transition-all"
              />
            ) : (
              <div className="w-24 h-24 rounded-full bg-gray-100 ring-2 ring-primary/10 group-hover:ring-primary/20 transition-all" />
            )}
            <label
              htmlFor="picture"
              className="absolute -bottom-2 -right-2 bg-white p-2 rounded-full shadow-md cursor-pointer hover:bg-gray-50 transition-colors"
            >
              <svg
                className="w-5 h-5 text-primary"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.414-.828A2 2 0 0110.93 3h2.14a2 2 0 011.664.89l.414.828A2 2 0 0016.07 7H17a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
              <input
                id="picture"
                type="file"
                className="hidden"
                accept="image/*"
                disabled={isLoading}
                onChange={onAvatarChange}
              />
            </label>
          </div>

          <div className="w-full">
            <Input
              type="text"
              placeholder="닉네임을 입력해주세요"
              className="w-full"
              value={name}
              onChange={(event) => onNameChange(event.target.value)}
              disabled={isLoading}
            />
            {nameError && <p className="mt-2 text-sm text-red-500">{nameError}</p>}
          </div>
        </div>
      </div>

      <Button
        type="submit"
        variant="default"
        size="sm"
        fullWidth
        disabled={!canSubmit}
      >
        {isLoading ? (
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            <span>저장 중...</span>
          </div>
        ) : (
          "프로필 저장"
        )}
      </Button>
    </form>
  );
};

export default EditProfileClient;
