"use client";

import clsx from "clsx";
import { useState } from "react";

import { Spinner } from "@components/auth/Spinner";
import PlusIcon from "@icons/PlusIcon.svg";

export interface ButtonProps {
  buttonType?: "submit" | "button" | "reset";
  type: "squareDefault" | "squareBorder" | "round";
  text: string;
  withLeftPlus?: boolean;
  withRightPlus?: boolean;
  spinner?: boolean;
  clickAction: any;
  size: "large" | "small";
  state?: "active" | "disable" | "inactive";
  widthFull?: boolean;
}

export const Button = ({
  buttonType,
  type,
  text,
  withLeftPlus = false,
  withRightPlus = false,
  clickAction,
  size,
  state = "active",
  widthFull = false,
  spinner,
}: ButtonProps) => {
  const [iconColor, setIconColor] = useState(
    state === "active"
      ? type === "squareDefault"
        ? "#FFFFFF"
        : "#191919"
      : state === "disable"
      ? "#B2B2B2"
      : "#191919"
  );

  return (
    <button
      className={clsx(
        type === "squareDefault" && "rounded-lg",
        type === "squareBorder" && "rounded-lg border border-Primary",
        type === "round" && "rounded-full px-4 py-[7px]",
        state === "active" &&
          type === "squareDefault" &&
          "bg-Primary text-White",
        state === "active" && type === "squareBorder" && "bg-White text-Black",
        state === "active" && type === "round" && "bg-Primary text-White",
        state === "disable" &&
          "cursor-not-allowed border-Gray-400 bg-Gray-100 text-Gray-400",
        state === "inactive" && "border-Gray-400 bg-Gray-100 text-[#191919]",
        type === "squareDefault" &&
          (size === "large" ? "px-4 py-[14px]" : "px-4 py-[11px]"),
        type === "squareBorder" &&
          (size === "large" ? "px-4 py-[13px]" : "px-4 py-[10px]"),
        widthFull ? "w-full" : "w-fit",
        "flex h-fit items-center justify-center gap-x-1 whitespace-nowrap"
      )}
      disabled={state === "disable"}
      onClick={(e) => {
        clickAction(e);
      }}
      type={buttonType}
    >
      {withLeftPlus && <PlusIcon fill={iconColor} className="-ml-[2px]" />}
      {spinner && (
        <div>
          <Spinner customSize="w-[14px] h-[14px]" />
        </div>
      )}
      <span className="text-[14px] font-bold leading-5">{text}</span>
      {withRightPlus && <PlusIcon fill={iconColor} className="-mr-[2px]" />}
    </button>
  );
};

export default Button;
