"use client";

import React from "react";

const SkeletonChatRoom = () => {
  return (
    <div className="flex flex-col h-full">
      {/* 채팅방 헤더 스켈레톤 */}
      <div className="flex items-center space-x-3 p-4 border-b border-gray-100">
        <div className="w-10 h-10 rounded-full bg-gray-200 animate-pulse" />
        <div className="flex-1">
          <div className="h-4 w-32 bg-gray-200 rounded animate-pulse" />
          <div className="h-3 w-24 bg-gray-200 rounded mt-1 animate-pulse" />
        </div>
      </div>

      {/* 채팅 메시지 스켈레톤 */}
      <div className="flex-1 p-4 space-y-4 overflow-y-auto">
        {/* 상대방 메시지 */}
        <div className="flex items-start space-x-2">
          <div className="w-8 h-8 rounded-full bg-gray-200 animate-pulse" />
          <div className="flex flex-col space-y-1">
            <div className="h-4 w-48 bg-gray-200 rounded animate-pulse" />
            <div className="h-4 w-32 bg-gray-200 rounded animate-pulse" />
          </div>
        </div>

        {/* 내 메시지 */}
        <div className="flex items-start justify-end space-x-2">
          <div className="flex flex-col items-end space-y-1">
            <div className="h-4 w-40 bg-primary/20 rounded animate-pulse" />
            <div className="h-4 w-24 bg-primary/20 rounded animate-pulse" />
          </div>
          <div className="w-8 h-8 rounded-full bg-gray-200 animate-pulse" />
        </div>

        {/* 상대방 메시지 */}
        <div className="flex items-start space-x-2">
          <div className="w-8 h-8 rounded-full bg-gray-200 animate-pulse" />
          <div className="flex flex-col space-y-1">
            <div className="h-4 w-36 bg-gray-200 rounded animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default SkeletonChatRoom;
