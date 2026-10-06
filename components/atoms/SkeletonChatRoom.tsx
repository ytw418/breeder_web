"use client";

import React from "react";

/** 채팅방 말풍선 스켈레톤(앱 RoomSkeleton): 상대 2 / 내 것 1, 말풍선 높이 40 r20, 아바타 36. */
const SkeletonChatRoom = () => {
  return (
    <div className="flex flex-col gap-3 px-4 pt-4" aria-hidden="true">
      <div className="flex items-end gap-2">
        <div className="h-9 w-9 shrink-0 animate-pulse rounded-full bg-app-placeholder" />
        <div className="h-10 w-[212px] animate-pulse rounded-[20px] bg-app-placeholder" />
      </div>
      <div className="flex justify-end">
        <div className="h-10 w-[180px] animate-pulse rounded-[20px] bg-app-placeholder" />
      </div>
      <div className="flex items-end gap-2">
        <div className="h-9 w-9 shrink-0 animate-pulse rounded-full bg-app-placeholder" />
        <div className="h-10 w-36 animate-pulse rounded-[20px] bg-app-placeholder" />
      </div>
    </div>
  );
};

export default SkeletonChatRoom;
