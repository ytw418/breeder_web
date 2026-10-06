"use client";

import React from "react";

/** 채팅 목록 행 스켈레톤(앱 ChatRowSkeleton): 44 원형 + 텍스트 2줄, 패딩 14/16, 하단 1px line. */
const SkeletonChat = () => {
  return (
    <div className="flex items-center gap-3 border-b border-app-line px-4 py-[14px]" aria-hidden="true">
      <div className="h-11 w-11 shrink-0 animate-pulse rounded-full bg-app-placeholder" />
      <div className="min-w-0 flex-1">
        <div className="h-4 w-[120px] animate-pulse rounded bg-app-placeholder" />
        <div className="mt-1.5 h-3.5 w-4/5 animate-pulse rounded bg-app-placeholder" />
      </div>
    </div>
  );
};

export default SkeletonChat;
