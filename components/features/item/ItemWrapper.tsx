"use client";

import React from "react";
import { cn } from "@libs/client/utils";
interface ItemWrapperProps {
  children: React.ReactNode;
  className?: string;
}

const ItemWrapper = ({ children, className = "" }: ItemWrapperProps) => {
  return (
    <div
      className={cn(
        "group bg-white rounded-xl transition-all duration-200 hover:bg-gray-50",
        className
      )}
    >
      {children}
    </div>
  );
};

export default ItemWrapper;
