"use client";
import { useEffect, useState } from "react";

import { useForm } from "react-hook-form";
import useMutation from "hooks/useMutation";
import useUser from "hooks/useUser";
import Image from "@components/atoms/Image";
import { useRouter } from "next/navigation";

import { makeImageUrl } from "@libs/client/utils";
import { Input } from "@components/ui/input";
import { Button } from "@components/ui/button";

interface EditProfileForm {
  name?: string;
  avatar?: FileList;
}

interface EditProfileResponse {
  success: boolean;
  error?: string;
}

const EditProfileClient = () => {
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { user, mutate } = useUser();
  const {
    register,
    setValue,
    handleSubmit,
    setError,
    formState: { errors },
    watch,
  } = useForm<EditProfileForm>();

  useEffect(() => {
    if (user?.name) setValue("name", user.name);
    if (user?.avatar) setAvatarPreview(makeImageUrl(user?.avatar, "avatar"));
  }, [user, setValue]);
  const [editProfile, { loading: editProfileLoading }] =
    useMutation<EditProfileResponse>(`/api/users/me`);

  const onValid = async ({ name, avatar }: EditProfileForm) => {
    if (isLoading) return;

    setIsLoading(true);

    const editProfileBody = {
      name: name === user?.name ? null : name,
      avatarId: null,
    };

    try {
      if (avatar && avatar.length > 0 && user) {
        const { uploadURL } = await (await fetch(`/api/files`)).json();
        const form = new FormData();
        form.append("file", avatar[0], user?.id + "");

        const {
          result: { id },
        } = await (
          await fetch(uploadURL, {
            method: "POST",
            body: form,
          }).then()
        ).json();

        editProfileBody.avatarId = id;
      }

      editProfile({
        data: editProfileBody,
        onCompleted(result) {
          if (result.success) {
            mutate();
            router.push("/myPage");
          } else {
            alert(result.error);
            setIsLoading(false);
          }
        },
        onError(error) {
          setIsLoading(false);
          alert(error);
        },
      });
    } catch (error) {
      alert(`프로필 편집 에러:${JSON.stringify(error)}`);
      setIsLoading(false);
    }
  };

  const [avatarPreview, setAvatarPreview] = useState("");
  const avatar = watch("avatar");

  useEffect(() => {
    if (avatar && avatar.length > 0) {
      const file = avatar[0];
      setAvatarPreview(URL.createObjectURL(file));
    }
  }, [avatar]);
  return (
    <form
      onSubmit={handleSubmit(onValid)}
      className="max-w-2xl mx-auto p-6 space-y-8"
    >
      <div className="bg-white rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.08)] p-6">
        <div className="flex flex-col items-center space-y-6">
          <div className="relative group">
            {avatarPreview ? (
              <Image
                alt="프로필 이미지"
                src={avatarPreview}
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
                {...register("avatar")}
                id="picture"
                type="file"
                className="hidden"
                accept="image/*"
              />
            </label>
          </div>

          <div className="w-full">
            <Input
              {...register("name", {
                maxLength: {
                  value: 10,
                  message: "최대 10글자까지 입력가능합니다.",
                },
              })}
              required={false}
              name="name"
              type="text"
              placeholder="닉네임을 입력해주세요"
              className="w-full"
            />
            {errors.name && (
              <p className="mt-2 text-sm text-red-500">{errors.name.message}</p>
            )}
          </div>
        </div>
      </div>

      <Button
        type="submit"
        variant="default"
        size="sm"
        fullWidth
        disabled={
          watch("name") === user?.name && !watch("avatar")?.[0]
            ? true
            : isLoading
            ? true
            : false
        }
      >
        {isLoading ? (
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-current border-t-transparent" />
        ) : (
          "프로필 저장"
        )}
      </Button>
    </form>
  );
};

export default EditProfileClient;
