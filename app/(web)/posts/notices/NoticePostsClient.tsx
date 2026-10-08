"use client";

import { useEffect, useMemo } from "react";
import Link from "next/link";
import useSWRInfinite from "swr/infinite";

import Image from "@components/atoms/Image";
import Layout from "@components/features/MainLayout";
import { QueryErrorState } from "@components/app/QueryErrorState";
import { RetryFooter } from "@components/app/RetryFooter";
import { useInfiniteScroll } from "hooks/useInfiniteScroll";
import { makeImageUrl } from "@libs/client/utils";
import { toPostPath } from "@libs/post-route";
import type { NoticePostsResponse } from "pages/api/posts/notices";
import { toPostPlainText } from "@libs/shared/post-body";

const PAGE_SIZE = 10;

/** 앱 formatNoticeDate: "10월 6일" */
const formatNoticeDate = (value: string | Date) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getMonth() + 1}월 ${date.getDate()}일`;
};

function SkeletonItem() {
  return (
    <div className="flex items-center border-b border-app-line px-4 py-3.5">
      <div className="flex-1">
        <div className="h-4 w-[70%] rounded bg-app-surface" />
        <div className="mt-2 h-3.5 w-[90%] rounded bg-app-surface" />
        <div className="mt-2 h-3 w-[40%] rounded bg-app-surface" />
      </div>
      <div className="ml-3 h-14 w-14 rounded-lg bg-app-surface" />
    </div>
  );
}

export default function NoticePostsClient() {
  const page = useInfiniteScroll();

  const getKey = (pageIndex: number, previousPageData: NoticePostsResponse | null) => {
    if (previousPageData && (previousPageData.posts.length === 0 || pageIndex >= previousPageData.pages)) {
      return null;
    }
    return `/api/posts/notices?page=${pageIndex + 1}&take=${PAGE_SIZE}`;
  };

  const { data, error, size, setSize, isValidating, mutate } =
    useSWRInfinite<NoticePostsResponse>(getKey);

  useEffect(() => {
    setSize(page);
  }, [page, setSize]);

  const notices = useMemo(() => {
    const seen = new Set<number>();
    return (data ?? [])
      .flatMap((pageData) => pageData?.posts ?? [])
      .filter((post) => {
        if (seen.has(post.id)) return false;
        seen.add(post.id);
        return true;
      });
  }, [data]);

  const header = (
    <p className="truncate px-4 py-3 text-[13px] text-app-muted">운영 공지와 필독 안내만 모아봤어요</p>
  );

  return (
    <Layout canGoBack title="공지사항" seoTitle="공지사항">
      <div className="min-h-full bg-app-bg pb-4">
        {header}
        {!data && !error ? (
          [...Array(5)].map((_, index) => <SkeletonItem key={index} />)
        ) : error && !data?.length ? (
          <QueryErrorState
            title="공지사항을 불러오지 못했어요"
            onRetry={() => void mutate()}
            className="py-14"
          />
        ) : notices.length === 0 ? (
          <p className="px-4 py-14 text-center text-[14px] text-app-muted">
            등록된 공지사항이 없습니다.
          </p>
        ) : (
          notices.map((post) => {
            const date = formatNoticeDate(post.createdAt);
            const thumbnail = post.images?.[0] ?? post.image;
            return (
              <Link
                key={post.id}
                href={toPostPath(post.id, post.title)}
                className="flex w-full items-center border-b border-app-line bg-app-bg px-4 py-3.5"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[16px] font-medium text-app-text">{post.title}</p>
                  <p className="mt-1 truncate text-[14px] text-app-muted">{toPostPlainText(post.description)}</p>
                  <p className="mt-1.5 text-[13px] text-app-muted">{date ? `공지 · ${date}` : "공지"}</p>
                </div>
                {thumbnail ? (
                  <div className="ml-3 h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-app-surface">
                    <Image
                      src={makeImageUrl(thumbnail, "public")}
                      className="h-full w-full object-cover"
                      width={56}
                      height={56}
                      alt=""
                    />
                  </div>
                ) : null}
              </Link>
            );
          })
        )}
        {data?.length ? (
          <RetryFooter
            loading={Boolean(size > data.length && isValidating && !error)}
            error={Boolean(error)}
            onRetry={() => void mutate()}
          />
        ) : null}
      </div>
    </Layout>
  );
}
