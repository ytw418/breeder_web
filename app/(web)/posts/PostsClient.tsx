"use client";

import { useEffect } from "react";

import Layout from "@components/features/layout";

export default function PostsClient() {
  return (
    <Layout canGoBack title="곤충생활" seoTitle="곤충생활">
      <div className="flex flex-col items-center justify-center h-[calc(100vh-8rem)]">
        <div className="text-center space-y-4">
          <h2 className="text-2xl font-semibold text-gray-900">
            준비중인 서비스입니다
          </h2>
          <p className="text-gray-500">곧 만나요!</p>
        </div>
      </div>
    </Layout>
  );
}
