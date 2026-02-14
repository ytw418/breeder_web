"use client";

import { useEffect } from "react";
import Link from "next/link";
import useSWRInfinite from "swr/infinite";

import Image from "@components/atoms/Image";
import Layout from "@components/features/MainLayout";
import { useInfiniteScroll } from "hooks/useInfiniteScroll";
import { getTimeAgoString, makeImageUrl } from "@libs/client/utils";
import { NoticePostsResponse } from "pages/api/posts/notices";

const PAGE_SIZE = 10;

export default function NoticePostsClient() {
  const page = useInfiniteScroll();

  const getKey = (
    pageIndex: number,
    previousPageData: NoticePostsResponse | null
  ) => {
    if (previousPageData && previousPageData.posts.length === 0) return null;
    return `/api/posts/notices?page=${pageIndex + 1}&take=${PAGE_SIZE}`;
  };

  const { data, setSize } = useSWRInfinite<NoticePostsResponse>(getKey);

  useEffect(() => {
    setSize(page);
  }, [page, setSize]);

  const notices = data?.flatMap((pageData) => pageData.posts) ?? [];

  return (
    <Layout icon hasTabBar seoTitle="공지사항" showSearch>
      <div className="app-page flex h-full flex-col">
        <section className="px-4 pb-3 pt-3">
          <h1 className="app-title-lg">공지사항</h1>
          <p className="mt-1 app-caption">운영 공지와 필독 안내만 모아봤어요.</p>
        </section>

        <section className="px-4 pb-2">
          <div className="flex items-end justify-between">
            <h2 className="app-section-title">전체 공지</h2>
            <span className="app-count-chip">{notices.length}개</span>
          </div>
        </section>

        <div className="border-y border-slate-100 bg-white pb-4">
          {data ? (
            notices.length > 0 ? (
              notices.map((post) => (
                <Link
                  key={post.id}
                  href={`/posts/${post.id}`}
                  className="block w-full border-b border-slate-100 px-4 py-3 transition-colors hover:bg-slate-50"
                >
                  <div className="flex items-start gap-2.5">
                    <div className="flex-1 min-w-0">
                      <div className="mb-1.5 flex items-center gap-2">
                        <span className="app-pill-accent">공지</span>
                        <span className="text-xs text-slate-400">
                          {getTimeAgoString(new Date(post.createdAt))}
                        </span>
                      </div>

                      <h3 className="app-title-md leading-snug line-clamp-1">
                        {post.title}
                      </h3>
                      <p className="mt-1 app-body-sm line-clamp-2 leading-relaxed">
                        {post.description}
                      </p>

                      <div className="mt-2.5 text-xs font-medium text-slate-500">
                        운영팀 공지
                      </div>
                    </div>

                    {post.image && (
                      <div className="h-[72px] w-[72px] flex-shrink-0 overflow-hidden rounded-lg bg-slate-100">
                        <Image
                          src={makeImageUrl(post.image, "public")}
                          className="h-full w-full object-cover"
                          width={72}
                          height={72}
                          alt=""
                        />
                      </div>
                    )}
                  </div>
                </Link>
              ))
            ) : (
              <div className="px-4 py-10 text-center app-body-sm text-slate-400">
                등록된 공지사항이 없습니다.
              </div>
            )
          ) : (
            <div className="divide-y divide-slate-100">
              {[...Array(5)].map((_, index) => (
                <div key={index} className="flex gap-3 px-4 py-3 animate-pulse">
                  <div className="flex-1 space-y-2">
                    <div className="h-3 w-16 rounded bg-gray-200" />
                    <div className="h-4 w-3/4 rounded bg-gray-200" />
                    <div className="h-3 w-full rounded bg-gray-200" />
                    <div className="h-3 w-1/2 rounded bg-gray-200" />
                  </div>
                  <div className="h-20 w-20 flex-shrink-0 rounded-lg bg-gray-200" />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
