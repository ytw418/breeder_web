"use client";

import type { ReactNode } from "react";
import { useParams } from "next/navigation";
import useSWR from "swr";
import Layout from "@components/features/MainLayout";
import MarkdownPreview from "@components/features/product/MarkdownPreview";
import { QueryErrorState } from "@components/app/QueryErrorState";
import type { LandingPageRecord } from "pages/api/admin/landing-pages";

interface LandingPageResponse {
  success: boolean;
  page?: LandingPageRecord;
  error?: string;
}

type FetchError = Error & { status?: number };

const NOT_FOUND_MESSAGE = "페이지를 찾을 수 없습니다.";

// 앱 src/app/content/[slug].tsx 와 같은 상태 분기: 없음 / 오류(다시 시도) / 로딩 / 본문.
function ContentNotFound({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-app-border bg-app-elevated p-6">
      <p className="text-center text-[16px] leading-6 text-app-muted">
        {message}
      </p>
    </div>
  );
}

function ContentLoading() {
  return (
    <div className="flex animate-pulse flex-col gap-3" aria-busy="true">
      <div className="h-7 w-1/2 rounded bg-app-placeholder" />
      <div className="h-4 w-full rounded bg-app-placeholder" />
      <div className="h-4 w-5/6 rounded bg-app-placeholder" />
      <div className="h-4 w-2/3 rounded bg-app-placeholder" />
    </div>
  );
}

export default function ContentPage() {
  const params = useParams();
  const slug = typeof params?.slug === "string" ? params.slug : "";

  const { data, error, isLoading, mutate } = useSWR<
    LandingPageResponse,
    FetchError
  >(slug ? `/api/landing-pages/${slug}` : null);

  const title = data?.page?.title || "콘텐츠";
  const isNotFound =
    !slug ||
    error?.status === 404 ||
    error?.status === 400 ||
    (data !== undefined && (!data.success || !data.page));

  let body: ReactNode;
  if (isNotFound) {
    body = (
      <ContentNotFound
        message={(data && !data.success && data.error) || NOT_FOUND_MESSAGE}
      />
    );
  } else if (error && !data) {
    body = (
      <QueryErrorState
        title="페이지를 불러오지 못했어요"
        onRetry={() => {
          void mutate();
        }}
      />
    );
  } else if (isLoading || !data?.page) {
    body = <ContentLoading />;
  } else {
    body = (
      <article>
        <h1 className="text-[22px] font-bold text-app-text">
          {data.page.title}
        </h1>
        <div className="mt-4">
          <MarkdownPreview
            content={data.page.content}
            emptyText="내용이 없습니다."
          />
        </div>
      </article>
    );
  }

  return (
    <Layout canGoBack title={title} seoTitle={title}>
      <div className="mx-auto min-h-full max-w-3xl bg-app-bg px-4 pb-10 pt-4">
        {body}
      </div>
    </Layout>
  );
}
