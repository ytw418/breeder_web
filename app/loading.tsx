import React from "react";

const loading = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-white">
      {/* 로고 또는 앱 아이콘 스켈레톤 */}
      <div className="w-20 h-20 rounded-full bg-gray-200 animate-pulse mb-8" />

      {/* 로딩 스피너 */}
      <div className="relative">
        <div className="w-12 h-12 border-4 border-gray-200 rounded-full" />
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin absolute top-0 left-0" />
      </div>

      {/* 로딩 텍스트 */}
      <p className="mt-4 text-gray-500 text-sm">로딩 중...</p>
    </div>
  );
};

export default loading;
