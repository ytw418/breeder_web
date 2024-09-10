"use client";
import Image from "next/image";
import React, { Dispatch, SetStateAction } from "react";
import {
  FieldValues,
  UseFormRegister,
  UseFormRegisterReturn,
  UseFormReturn,
} from "react-hook-form";
import { Colors } from "styles/colors";

import Close from "@hero/plus.svg";
import PlusIcon from "@hero/plus.svg";

interface ImageInputProps {
  imageUrl?: string;
  setImageUrl: Dispatch<SetStateAction<string | undefined>>;
  useFormReturn: UseFormReturn<any>;
  register: UseFormRegisterReturn<any>;
}

const ImageInput = ({
  imageUrl,
  setImageUrl,
  useFormReturn,
  register,
}: ImageInputProps) => {
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const reader = new FileReader();
    const file = e.target.files?.[0];
    if (!file) return;
    reader.onloadend = () => {
      setImageUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
  };
  return (
    <div className="relative">
      {imageUrl ? (
        <div className="IMAGE-BLOCK relative h-[126px] w-[126px] cursor-pointer">
          <Image
            src={imageUrl}
            alt={`이미지`}
            className="peer h-[126px] w-[126px] rounded-lg border-[1px] border-Gray-300 bg-White object-cover"
            width={126}
            height={126}
            onLoadingComplete={(img) => img.setAttribute("imageLoaded", "true")}
          />
          <div className="absolute left-0 top-0 hidden h-full w-full rounded-lg bg-[#191919] opacity-40 hover:block peer-hover:block">
            <Close
              fill={Colors.WHITE}
              width="10"
              height="10"
              className="absolute right-3 top-3 cursor-pointer opacity-70"
              onClick={() => setImageUrl(undefined)}
            />
          </div>
        </div>
      ) : (
        <div className="IMAGE-BLOCK">
          <label htmlFor="imageLoader">
            <div className="flex h-[126px] w-[126px] cursor-pointer items-center justify-center rounded-lg border-[1px] border-Gray-300 bg-White">
              <div className="flex h-[47px] w-[45px] flex-col items-center justify-between">
                <PlusIcon className="block" />
                <span className="body-2">파일선택</span>
              </div>
            </div>
          </label>
          <input
            id="imageLoader"
            type="file"
            accept="image/png, image/jpeg, image/jpg"
            className="hidden"
            {...register}
            onChange={(e) => handleImageChange(e)}
          />
        </div>
      )}
    </div>
  );
};

export default ImageInput;
