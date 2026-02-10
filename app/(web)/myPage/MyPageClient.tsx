"use client";

import Image from "@components/atoms/Image";
import { Spinner } from "@components/atoms/Spinner";
import MyCommentList from "@components/features/profile/MyCommentList";
import MyCommunityPostList from "@components/features/profile/MyCommunityPostList";
import MySaleHistroyMenu from "@components/features/profile/MySaleHistroyMenu";
import MyPostList from "@components/features/profile/myPostList";
import { Button } from "@components/ui/button";
import { cn } from "@libs/client/utils";
import useUser from "hooks/useUser";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  GuinnessSubmission,
  GuinnessSubmissionsResponse,
} from "pages/api/guinness/submissions";
import useSWR from "swr";
import { UserResponse } from "pages/api/users/[id]";
import { useMemo, useState } from "react";
import useLogout from "../../../hooks/useLogout";

type ActivityTab = "posts" | "comments" | "guinness" | "products";

const TAB_META: { id: ActivityTab; name: string }[] = [
  { id: "posts", name: "게시물" },
  { id: "comments", name: "댓글" },
  { id: "guinness", name: "브리디북" },
  { id: "products", name: "상품" },
];

const GUINNESS_STATUS_TEXT: Record<GuinnessSubmission["status"], string> = {
  pending: "심사 대기",
  approved: "승인 완료",
  rejected: "반려",
};

const GUINNESS_STATUS_CLASS: Record<GuinnessSubmission["status"], string> = {
  pending: "bg-amber-100 text-amber-700",
  approved: "bg-emerald-100 text-emerald-700",
  rejected: "bg-rose-100 text-rose-700",
};

const GuinnessSubmissionList = ({
  submissions,
  isLoading,
}: {
  submissions: GuinnessSubmission[];
  isLoading: boolean;
}) => {
  if (isLoading) {
    return (
      <div className="flex h-32 items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (!submissions.length) {
    return (
      <div className="app-card flex h-36 flex-col items-center justify-center text-slate-500">
        <p className="app-title-md text-slate-600">체장 기록 신청 내역이 없습니다</p>
        <p className="app-caption mt-1">체장 기록을 신청해 공식 인증을 받아보세요.</p>
        <Link
          href="/guinness/apply"
          className="mt-3 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white"
        >
          브리디북 등록하기
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      {submissions.map((submission) => (
        <div key={submission.id} className="app-card px-3.5 py-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="app-title-md truncate">
                {submission.species} · 체장 {submission.value}mm
              </p>
              <p className="app-caption mt-1">
                신청일 {new Date(submission.submittedAt).toLocaleDateString("ko-KR")}
              </p>
            </div>
            <span
              className={cn(
                "shrink-0 rounded-full px-2 py-1 text-[11px] font-semibold",
                GUINNESS_STATUS_CLASS[submission.status]
              )}
            >
              {GUINNESS_STATUS_TEXT[submission.status]}
            </span>
          </div>
          {submission.reviewMemo && (
            <p className="app-body-sm mt-2 rounded-lg bg-slate-50 dark:bg-slate-800/70 px-2.5 py-2 text-slate-600">
              심사 메모: {submission.reviewMemo}
            </p>
          )}
          <div className="mt-2 flex items-center gap-2">
            {submission.status === "approved" ? (
              <Link href="/guinness" className="app-pill-muted">
                브리디북 보기
              </Link>
            ) : (
              <Link href="/guinness/apply" className="app-pill-muted">
                신청 상세/수정
              </Link>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

const MyPageClient = () => {
  const { user } = useUser();
  const router = useRouter();
  const handleLogout = useLogout();
  const [activeTab, setActiveTab] = useState<ActivityTab>("posts");

  // _count 포함된 유저 정보 가져오기
  const { data } = useSWR<UserResponse>(
    user?.id ? `/api/users/${user.id}` : null
  );
  const { data: guinnessData, isLoading: isGuinnessLoading } =
    useSWR<GuinnessSubmissionsResponse>(
      user?.id ? "/api/guinness/submissions" : null
    );

  const avatarUrl =
    user?.avatar &&
    (user.avatar.includes("http")
      ? user.avatar
      : `https://imagedelivery.net/OvWZrAz6J6K7n9LKUH5pKw/${user.avatar}/avatar`);

  const profileUser = data?.user;
  const mySubmissions = useMemo(
    () =>
      [...(guinnessData?.submissions || [])]
        .filter((submission) => submission.recordType === "size")
        .sort(
          (a, b) =>
            new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
        ),
    [guinnessData?.submissions]
  );

  const tabCountMap: Record<ActivityTab, number> = {
    posts: profileUser?._count?.posts ?? 0,
    comments: profileUser?._count?.Comments ?? 0,
    guinness: mySubmissions.length,
    products: profileUser?._count?.products ?? 0,
  };

  return (
    <div className="flex flex-col pb-4">
      {/* 프로필 헤더 */}
      <div className="px-6 pt-6 pb-4">
        <div className="flex items-center gap-5">
          {/* 아바타 */}
          <div className="flex-shrink-0">
            {avatarUrl ? (
              <Image
                src={avatarUrl}
                alt={user?.name || "프로필"}
                width={80}
                height={80}
                className="w-20 h-20 rounded-full bg-gray-200 dark:bg-slate-700 object-cover"
              />
            ) : (
              <div className="w-20 h-20 rounded-full bg-gray-200 dark:bg-slate-700 flex items-center justify-center">
                <svg
                  className="w-10 h-10 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="1.5"
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                  />
                </svg>
              </div>
            )}
          </div>

          {/* 통계 */}
          <div className="flex-1 flex justify-around">
            <div className="flex flex-col items-center">
              <span className="text-lg font-bold text-gray-900">
                {profileUser?._count?.posts ?? 0}
              </span>
              <span className="text-xs text-gray-500">게시물</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-lg font-bold text-gray-900">
                {profileUser?._count?.insectRecords ?? 0}
              </span>
              <span className="text-xs text-gray-500">공식 기록</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-lg font-bold text-gray-900">
                {profileUser?._count?.followers ?? 0}
              </span>
              <span className="text-xs text-gray-500">팔로워</span>
            </div>
          </div>
        </div>

        {/* 이름 + 이메일 */}
        <div className="mt-4">
          <h2 className="text-lg font-bold text-gray-900">
            {user?.name || ""}
          </h2>
          {user?.email && (
            <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">{user.email}</p>
          )}
        </div>

        {/* 액션 버튼 */}
        <div className="flex gap-2 mt-4">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => router.push("/editProfile")}
          >
            프로필 수정
          </Button>
          <Button
            variant="outline"
            className="flex-1"
            onClick={handleLogout}
          >
            로그아웃
          </Button>
        </div>
      </div>

      {/* 구분선 */}
      <div className="h-2 bg-gray-50" />

      {/* 거래 메뉴 */}
      <div className="px-4 py-4">
        <MySaleHistroyMenu />
      </div>

      {/* 구분선 */}
      <div className="h-2 bg-gray-50" />

      {/* 활동 탭 */}
      <div className="px-4 py-4">
        <h3 className="mb-3 text-base font-semibold text-gray-900">내 활동</h3>

        <div className="app-card p-2">
          <div className="app-rail flex gap-2 snap-none">
            {TAB_META.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "app-chip",
                  activeTab === tab.id ? "app-chip-active" : "app-chip-muted"
                )}
              >
                {tab.name}
                <span className="ml-1.5 text-[11px] opacity-80">
                  {tabCountMap[tab.id]}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="mt-3">
          {activeTab === "posts" && <MyCommunityPostList userId={user?.id} />}
          {activeTab === "comments" && <MyCommentList userId={user?.id} />}
          {activeTab === "guinness" && (
            <GuinnessSubmissionList
              submissions={mySubmissions}
              isLoading={isGuinnessLoading}
            />
          )}
          {activeTab === "products" && <MyPostList userId={user?.id} />}
        </div>
      </div>
    </div>
  );
};

export default MyPageClient;
