import clsx from "clsx";
import { useEffect, useRef, useState } from "react";
import {
  UseFormRegisterReturn,
  UseFormReturn,
} from "react-hook-form/dist/types/form";
import { Colors } from "styles/colors";

import ArrowDownLinear from "@hero/plus.svg";
import Clip from "@hero/plus.svg";
import Close from "@hero/plus.svg";
import { useVariousData } from "@libs/client/VariousProvider";

interface InputProps {
  style?: string;
  name: string;
  kind?: "default" | "select" | "file";
  type?: string;
  register: UseFormRegisterReturn;
  required?: boolean;
  placeholder?: string;
  disabled?: boolean;
  useFormReturn: UseFormReturn<any>;
  maxCount?: number;
  selectList?: {
    key: string;
    value: string;
  }[];
  accept?: string;
  error?: boolean;
  preventModal?: boolean;
}
// default: border-Gray-300 placeholder-Gray-400
// hover: border-Gray-400 placeholder-Gray-400 text-Black
// active: placeholder-Gray-400 focus:border-Gray-500 text-Black
// disabled: border-Gray-300 placeholder-Gray-400 text-Gray-400 bg-Gray-200
// error: border-Red
export default function Input({
  style,
  name,
  kind = "default",
  register,
  type = "text",
  required,
  placeholder,
  disabled,
  useFormReturn,
  maxCount,
  selectList,
  accept,
  error = true,
  preventModal = true,
}: InputProps) {
  const [isOpenSelectMenu, setIsOpenSelectMenu] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const { setHasInput } = useVariousData();
  const handleFocus = () => setIsFocused(true);
  const handleBlur = () => setIsFocused(false);
  const [fileName, setFileName] = useState<undefined | string>(undefined);
  const {
    watch,
    setError,
    setValue,
    getValues,
    clearErrors,
    resetField,
    reset,
    formState: { errors },
  } = useFormReturn;
  const { onChange, ...registerProps } = register;

  const SelectMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handleOutsideClose = (e: { target: any }) => {
      // useRef current에 담긴 엘리먼트 바깥을 클릭 시 SelectMenu 닫힘
      if (isOpenSelectMenu && !SelectMenuRef.current?.contains(e.target)) {
        setIsOpenSelectMenu(false);
      }
    };
    document.addEventListener("click", handleOutsideClose);

    return () => document.removeEventListener("click", handleOutsideClose);
  }, [isOpenSelectMenu]);

  return (
    <div>
      {kind === "default" ? (
        // default 타입에서 maxCount 값이 있으면 우측에 0/0 카운터 생성
        <div className={clsx("relative h-12 w-[450px]", style)}>
          <input
            id={name}
            required={required}
            {...registerProps}
            onChange={(e) => {
              onChange?.(e);
              if (preventModal) {
                setHasInput(true);
              }
            }}
            type={type}
            placeholder={placeholder}
            disabled={disabled}
            className={clsx(
              "body-4 h-full w-full appearance-none rounded-lg border-[1px] border-Gray-300 p-[14px_16px] text-Black placeholder-Gray-400 focus:outline-none",
              {
                "bg-White hover:border-Gray-400 focus:border-Gray-500":
                  !disabled && !errors?.[name]?.message,
                "cursor-not-allowed border-Gray-300 bg-Gray-200 text-Gray-400 hover:border-Gray-300":
                  disabled,
                "border-Red": errors?.[name]?.message && error,
                "pr-[48px]": maxCount,
              }
            )}
          />
          <span className="body-2 absolute bottom-[-24px] left-[0px] text-Red">
            {error && (errors?.[name]?.message as string)}
          </span>
          {maxCount && (
            <div className="body-2 absolute right-4 top-[14px] flex h-[20px] w-[20px] items-center justify-center text-Gray-400">
              {(watch(name)?.length ?? 0) + "/" + maxCount}
            </div>
          )}
        </div>
      ) : null}
      {kind === "select" ? (
        <div className={clsx("relative h-12 w-[450px]", style)}>
          <input
            onClick={() => setIsOpenSelectMenu((prev) => !prev)}
            readOnly
            id={name}
            required={required}
            {...registerProps}
            onChange={(e) => {
              onChange?.(e);
              if (preventModal) {
                setHasInput(true);
              }
            }}
            onBlur={handleBlur} // 포커스 아웃(blur) 이벤트 핸들러 추가
            onFocus={handleFocus} // 포커스 이벤트 핸들러 추가
            type="select"
            placeholder={placeholder}
            disabled={disabled}
            className={clsx(
              "body-4 h-full w-full cursor-pointer appearance-none rounded-lg border-[1px] border-Gray-300 bg-White p-[14px_16px] text-Black placeholder-Gray-400 focus:outline-none",
              {
                "hover:border-Gray-400 focus:border-Gray-500":
                  !disabled && !errors?.[name]?.message,
                "cursor-not-allowed border-Gray-300 bg-Gray-200 text-Gray-400 hover:border-Gray-300":
                  disabled,
                "border-Red": errors?.[name]?.message && error,
                "pr-[48px]": maxCount,
              }
            )}
          />
          <span className="body-2 absolute bottom-[-24px] left-[0px] text-Red">
            {error && (errors?.[name]?.message as string)}
          </span>
          <div className="absolute right-4 top-0 flex h-full cursor-pointer items-center justify-center">
            <ArrowDownLinear
              fill={isFocused ? Colors.BLACK : Colors.GRAY_400}
            />
          </div>
          {isOpenSelectMenu && (
            <div className="absolute left-0 z-10 mt-[7.5px] flex h-auto w-full flex-col items-start rounded-lg bg-white py-2 shadow-[0px_2px_6px_0px_rgba(0,0,0,0.08)]">
              {selectList?.map((val) => (
                <div
                  key={val.key}
                  className="body-2 w-full cursor-pointer p-[8px_16px] text-Black hover:bg-Gray-200"
                  onClick={() => {
                    setValue(name, val.value);
                    setIsOpenSelectMenu((prev) => !prev);
                    clearErrors(name);
                  }}
                >
                  {val.key}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}
      {kind === "file" ? (
        <div
          className={clsx("relative h-12 w-[450px]", style)}
          ref={SelectMenuRef}
        >
          <label
            htmlFor={name}
            className={clsx(
              "body-4 flex h-full w-full cursor-pointer appearance-none items-center rounded-lg border-[1px] border-Gray-300 p-[14px_16px] pr-[48px] text-Black placeholder-Gray-400 focus:outline-none",
              {
                "bg-White hover:border-Gray-400 focus:border-Gray-500":
                  !disabled && !errors?.[name]?.message && !fileName,
                "cursor-not-allowed border-Gray-300 bg-Gray-200 text-Gray-400 hover:border-Gray-300":
                  disabled,
                "border-Red !text-Gray-400": errors?.[name]?.message && error,
                "text-Gray-400": !fileName, // file === undefined
                "bg-Gray-200": fileName && !errors?.[name]?.message, //file === true
              }
            )}
          >
            {fileName ?? placeholder}
          </label>
          <input
            hidden
            required={required}
            id={name}
            type="file"
            accept={accept}
            {...registerProps}
            onChange={(e) => {
              onChange?.(e);
              setHasInput(true);
              setFileName(e.target.files?.[0]?.name);
            }}
            disabled={fileName && !errors?.[name]?.message ? true : false}
          />
          <span className="body-2 absolute bottom-[-24px] left-[0px] text-Red">
            {errors?.[name]?.message as string}
          </span>

          <div className="body-2 absolute right-4 top-[14px] flex h-[20px] w-[20px] items-center justify-center text-Gray-400">
            {fileName && !errors?.[name]?.message ? (
              <Close
                fill={Colors.BLACK}
                width="20"
                height="20"
                className="cursor-pointer"
                onClick={() => {
                  resetField(name);
                  setFileName(undefined);
                }}
              />
            ) : (
              <Clip
                className="cursor-pointer"
                onClick={() => {
                  console.log(
                    'getValues("audioFile") :>> ',
                    getValues("audioFile")
                  );
                }}
              />
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
