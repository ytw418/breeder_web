"use client";
import { useEffect, useState } from "react";

import Input from "@components/input";

import { useForm } from "react-hook-form";
import useApiMutation from "@libs/client/useApiMutation";
import useUser from "@libs/client/useUser";
import Image from "next/image";
import { useRouter } from "next/navigation";
import Button from "@components/atoms/Button";

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
  const { user } = useUser();
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
    if (user?.avatar)
      setAvatarPreview(
        user.avatar.includes("http")
          ? user.avatar
          : `https://imagedelivery.net/OvWZrAz6J6K7n9LKUH5pKw/${user.avatar}/avatar`
      );
  }, [user, setValue]);
  const [editProfile, { loading: editProfileLoading }] =
    useApiMutation<EditProfileResponse>(`/api/users/me`);

  const onValid = async ({ name, avatar }: EditProfileForm) => {
    if (isLoading) return;

    setIsLoading(true);

    const editProfileBody = {
      name: name,
      avatarId: null,
    };
    console.log("avatar :>> ", avatar);

    try {
      if (avatar && avatar.length > 0 && user) {
        const { uploadURL } = await (await fetch(`/api/files`)).json();
        const form = new FormData();
        form.append("file", avatar[0], user?.id + "");
        console.log("uploadURL :>> ", uploadURL);
        const {
          result: { id },
        } = await (
          await fetch(uploadURL, {
            method: "POST",
            body: form,
          }).then()
        ).json();

        console.log("id :>> ", id);
        editProfileBody.avatarId = id;
      }

      editProfile({
        data: editProfileBody,
        onCompleted(result) {
          if (result.success) {
            router.push("/myPage");
          } else {
            alert(result.error);
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
    <form onSubmit={handleSubmit(onValid)} className="py-10 px-4 space-y-4">
      <div className="flex items-center space-x-3">
        {avatarPreview ? (
          <Image
            alt="프로필 이미지"
            src={avatarPreview}
            height={60}
            width={60}
            className="w-14 h-14 rounded-full bg-slate-500"
          />
        ) : (
          <div className="w-14 h-14 rounded-full bg-slate-500" />
        )}
        <label
          htmlFor="picture"
          className="cursor-pointer py-2 px-3 border hover:bg-gray-50 border-gray-300 rounded-md shadow-sm text-sm font-medium focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 text-gray-700"
        >
          이미지 변경
          <input
            {...register("avatar")}
            id="picture"
            type="file"
            className="hidden"
            accept="image/*"
          />
        </label>
      </div>
      <Input
        register={register("name", {
          maxLength: {
            value: 10,
            message: "최대 10글자까지 입력가능합니다.",
          },
        })}
        required={false}
        label="닉네임"
        name="name"
        type="text"
      />

      {/* <Button text={isLoading ? "로딩중" : "완료"} disabled={isLoading} /> */}
      <Button
        buttonType="submit"
        type="squareDefault"
        text="프로필 저장"
        size="small"
        widthFull
        className="mt-5"
        spinner={isLoading}
        state={
          watch("name") === user?.name && !watch("avatar")?.[0]
            ? "disable"
            : isLoading
            ? "disable"
            : "active"
        }
      />
    </form>
  );
};

export default EditProfileClient;
