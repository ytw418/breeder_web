"use client";

import { useParams } from "next/navigation";
import useSWR from "swr";
import Layout from "@components/features/MainLayout";
import MarkdownPreview from "@components/features/product/MarkdownPreview";
import type { LandingPageRecord } from "pages/api/admin/landing-pages";

interface LandingPageResponse {
  success: boolean;
  page?: LandingPageRecord;
  error?: string;
}

export default function ContentPage() {
  const params = useParams();
  const slug = typeof params?.slug === "string" ? params.slug : "";

  const { data } = useSWR<LandingPageResponse>(
    slug ? `/api/landing-pages/${slug}` : null
  );

  const title = data?.page?.title || "콘텐츠";

  return (
    <Layout canGoBack title={title} seoTitle={title}>
      <div className="max-w-3xl mx-auto px-4 py-6">
        {!data && (
          <div className="space-y-3 animate-pulse">
            <div className="h-7 bg-gray-200 rounded w-1/2" />
            <div className="h-4 bg-gray-200 rounded w-full" />
            <div className="h-4 bg-gray-200 rounded w-5/6" />
            <div className="h-4 bg-gray-200 rounded w-2/3" />
          </div>
        )}

        {data && !data.success && (
          <div className="rounded-xl border border-gray-200 bg-white p-6 text-center text-gray-500">
            {data.error || "페이지를 찾을 수 없습니다."}
          </div>
        )}

        {data?.success && data.page && (
          <article className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <h1 className="text-2xl font-bold text-gray-900">{data.page.title}</h1>
            <div className="mt-4">
              <MarkdownPreview
                content={data.page.content}
                emptyText="내용이 없습니다."
              />
            </div>
          </article>
        )}
      </div>
    </Layout>
  );
}
