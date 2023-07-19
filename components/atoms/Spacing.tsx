"use client";
import clsx from "clsx";
import { HTMLAttributes, memo } from "react";

interface Props extends HTMLAttributes<HTMLDivElement> {
  children?: never;
  direction?: "horizontal" | "vertical";
  size: number;
}

export const Spacing = ({ direction = "vertical", size, ...props }: Props) => {
  return (
    <div
      className={clsx("flex-none")}
      style={direction === "vertical" ? { height: size } : { width: size }}
      {...props}
    />
  );
};
