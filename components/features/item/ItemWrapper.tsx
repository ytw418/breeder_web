"use client";

import React from "react";
import { cn } from "@libs/client/utils";
interface ItemWrapperProps {
  children: React.ReactNode;
  className?: string;
}

const ItemWrapper = ({ children, className = "" }: ItemWrapperProps) => {
  return <div className={cn("w-full", className)}>{children}</div>;
};

export default ItemWrapper;
