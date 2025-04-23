"use client";

import React from "react";

const SkeletonChat = () => {
  return (
    <div className="flex items-center space-x-4 px-4 py-3 border-b border-gray-100">
      {/* 프로필 이미지 스켈레톤 */}
      <div className="w-12 h-12 rounded-full bg-gray-200 animate-pulse" />

      {/* 채팅 정보 스켈레톤 */}
      <div className="flex-1">
        <div className="flex justify-between items-center mb-1">
          <div className="h-4 w-24 bg-gray-200 rounded animate-pulse" />
          <div className="h-3 w-16 bg-gray-200 rounded animate-pulse" />
        </div>
        <div className="h-4 w-40 bg-gray-200 rounded animate-pulse" />
      </div>
    </div>
  );
};

export default SkeletonChat;
