"use client";

import Image from "@components/atoms/Image";
import { Spinner } from "@components/atoms/Spinner";
import MyCommentList from "@components/features/profile/MyCommentList";
import MyCommunityPostList from "@components/features/profile/MyCommunityPostList";
import MySaleHistroyMenu from "@components/features/profile/MySaleHistroyMenu";
import MyPostList from "@components/features/profile/myPostList";
import { Button } from "@components/ui/button";
import { cn } from "@libs/client/utils";
import { USER_INFO } from "@libs/constants";
import useUser from "hooks/useUser";
import useMutation from "hooks/useMutation";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  GuinnessSubmission,
  GuinnessSubmissionsResponse,
} from "pages/api/guinness/submissions";
import { LoginReqBody, LoginResponseType } from "pages/api/auth/login";
import useSWR from "swr";
import { UserResponse } from "pages/api/users/[id]";
import type { BloodlineCardsResponse } from "@libs/shared/bloodline-card";
import { useMemo, useState } from "react";
import useLogout from "../../../hooks/useLogout";

type ActivityTab = "posts" | "comments" | "guinness" | "products" | "bloodline";

const TAB_META: { id: ActivityTab; name: string }[] = [
  { id: "posts", name: "게시물" },
  { id: "comments", name: "댓글" },
  { id: "guinness", name: "브리디북" },
  { id: "products", name: "상품" },
  { id: "bloodline", name: "보유 혈통 카드" },
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

const TEST_USER_PROVIDERS = new Set(["test_user", "seed"]);

type TestSwitchUserItem = {
  id: number;
  name: string;
  email: string | null;
  provider: string;
  createdAt: string;
};

type TestAccountsResponse = {
  success: boolean;
  error?: string;
  users: TestSwitchUserItem[];
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
  const { user, isAdmin, mutate: mutateUser } = useUser();
  const router = useRouter();
  const handleLogout = useLogout();
  const [activeTab, setActiveTab] = useState<ActivityTab>("posts");
  const [switchError, setSwitchError] = useState("");
  const [switchMessage, setSwitchMessage] = useState("");
  const [testSwitchError, setTestSwitchError] = useState("");
  const [switchingTestUserId, setSwitchingTestUserId] = useState<number | null>(null);
  const [loginWithProvider, { loading: switchingGoogle }] =
    useMutation<LoginResponseType>("/api/auth/login");

  // _count 포함된 유저 정보 가져오기
  const { data } = useSWR<UserResponse>(
    user?.id ? `/api/users/${user.id}` : null
  );
  const { data: guinnessData, isLoading: isGuinnessLoading } =
    useSWR<GuinnessSubmissionsResponse>(
      user?.id ? "/api/guinness/submissions" : null
    );
  const isTestUser = TEST_USER_PROVIDERS.has(String(user?.provider || ""));
  const {
    data: testAccountsData,
    isLoading: isTestAccountsLoading,
  } = useSWR<TestAccountsResponse>(isTestUser ? "/api/users/test-accounts" : null);
  const {
    data: bloodlineData,
    isLoading: isBloodlineLoading,
    error: bloodlineLoadError,
  } = useSWR<BloodlineCardsResponse>(user?.id ? "/api/bloodline-cards" : null);

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
    bloodline: bloodlineData?.ownedCards?.length ?? 0,
  };

  const providerLabel =
    user?.provider === USER_INFO.provider.GOOGLE
      ? "Google"
      : user?.provider === USER_INFO.provider.APPLE
        ? "Apple"
        : TEST_USER_PROVIDERS.has(String(user?.provider || ""))
          ? "테스트 유저"
        : "Kakao";

  const handleSwitchToGoogle = async () => {
    setSwitchError("");
    setSwitchMessage("");

    try {
      const [{ getAuth, GoogleAuthProvider, signInWithPopup }, { app }] =
        await Promise.all([import("firebase/auth"), import("@/firebase")]);
      const auth = getAuth(app);
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      const { user: googleUser } = await signInWithPopup(auth, provider);

      if (!googleUser?.uid) {
        throw new Error("구글 계정 정보를 가져오지 못했습니다.");
      }

      const body: LoginReqBody = {
        snsId: googleUser.uid,
        name:
          googleUser.displayName || googleUser.email?.split("@")[0] || "Google User",
        provider: USER_INFO.provider.GOOGLE,
        email: googleUser.email,
        avatar: googleUser.photoURL || undefined,
      };

      const result = await loginWithProvider({
        data: body,
      });
      if (!result?.success) {
        throw new Error(result?.error || "구글 계정 전환에 실패했습니다.");
      }

      await mutateUser();
      setSwitchMessage("구글 계정으로 전환되었습니다.");
      router.refresh();
    } catch (error) {
      setSwitchError(
        error instanceof Error
          ? error.message
          : "구글 계정 전환에 실패했습니다."
      );
    }
  };

  const handleSwitchTestUser = async (target: TestSwitchUserItem) => {
    if (target.id === user?.id) return;
    const confirmed = window.confirm(`${target.name} 계정으로 전환할까요?`);
    if (!confirmed) return;

    setTestSwitchError("");

    try {
      setSwitchingTestUserId(target.id);
      const res = await fetch("/api/users/test-accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: target.id }),
      });
      const result = (await res.json()) as { success?: boolean; error?: string };
      if (!res.ok || !result.success) {
        throw new Error(result.error || "테스트 계정 전환에 실패했습니다.");
      }
      window.location.assign("/myPage");
    } catch (error) {
      setTestSwitchError(error instanceof Error ? error.message : "요청 중 오류가 발생했습니다.");
    } finally {
      setSwitchingTestUserId(null);
    }
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
        {isAdmin ? (
          <div className="mt-2 space-y-2">
            <Link
              href="/admin"
              className="inline-flex h-10 w-full items-center justify-center rounded-lg bg-slate-900 text-sm font-semibold text-white"
            >
              관리자 페이지로 이동
            </Link>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-semibold text-slate-700">
                관리자 계정 전환
              </p>
              <p className="mt-1 text-xs text-slate-600">
                현재 로그인: {providerLabel}
              </p>
              <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={handleSwitchToGoogle}
                  disabled={switchingGoogle}
                >
                  {switchingGoogle ? "전환 중..." : "구글 계정으로 전환"}
                </Button>
                <Link
                  href="/auth/login?next=%2FmyPage"
                  className="inline-flex h-10 items-center justify-center rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700"
                >
                  카카오 로그인으로 전환
                </Link>
              </div>
              {switchMessage ? (
                <p className="mt-2 text-xs font-semibold text-emerald-600">
                  {switchMessage}
                </p>
              ) : null}
              {switchError ? (
                <p className="mt-2 text-xs font-semibold text-rose-600">
                  {switchError}
                </p>
              ) : null}
            </div>
          </div>
        ) : null}
        {isTestUser ? (
          <div className="mt-2 rounded-lg border border-indigo-200 bg-indigo-50 p-3">
            <p className="text-xs font-semibold text-indigo-900">테스트 유저 계정 전환</p>
            <p className="mt-1 text-xs text-indigo-700">
              테스트 유저 권한 계정끼리 버튼으로 즉시 세션 전환할 수 있습니다.
            </p>
            {isTestAccountsLoading ? (
              <p className="mt-2 text-xs text-indigo-700">계정 목록 불러오는 중...</p>
            ) : (
              <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {(testAccountsData?.users || []).map((account) => (
                  <button
                    key={account.id}
                    type="button"
                    disabled={switchingTestUserId === account.id}
                    onClick={() => handleSwitchTestUser(account)}
                    className="rounded-md border border-indigo-200 bg-white px-3 py-2 text-left text-xs text-indigo-900 transition-colors hover:bg-indigo-100 disabled:opacity-60"
                  >
                    <p className="font-semibold">
                      {account.name}
                      {account.id === user?.id ? " (현재)" : ""}
                    </p>
                    <p className="mt-0.5 text-[11px] text-indigo-700">
                      {account.email || "이메일 없음"}
                    </p>
                  </button>
                ))}
              </div>
            )}
            {testSwitchError ? (
              <p className="mt-2 text-xs font-semibold text-rose-600">{testSwitchError}</p>
            ) : null}
          </div>
        ) : null}
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
          {activeTab === "bloodline" && (
            <div className="space-y-3">
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-900">
                혈통카드는 이용자 생성 기반 기능이며, 브리디는 혈통/적법성/품질을 보증하지 않습니다.
              </div>
              <Link
                href="/bloodline-cards/create"
                className="inline-flex h-10 w-full items-center justify-center rounded-lg bg-slate-900 text-sm font-semibold text-white"
              >
                혈통카드 만들기 / 전달하기
              </Link>

              {isBloodlineLoading ? (
                <div className="flex h-28 items-center justify-center">
                  <Spinner />
                </div>
              ) : null}

              {bloodlineLoadError ? (
                <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
                  혈통카드 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.
                </p>
              ) : null}

              {bloodlineData?.createdCard ? (
                <div className="rounded-lg border border-slate-200 bg-white p-3">
                  <p className="text-xs font-semibold text-slate-500">내 대표 카드</p>
                  <p className="mt-1 text-sm font-bold text-slate-900">
                    {bloodlineData.createdCard.name}
                  </p>
                  {bloodlineData.createdCard.description ? (
                    <p className="mt-1 text-sm text-slate-600">
                      {bloodlineData.createdCard.description}
                    </p>
                  ) : null}
                  <p className="mt-2 text-xs text-slate-500">
                    현재 보유자: {bloodlineData.createdCard.currentOwner.name}
                  </p>
                </div>
              ) : null}

              {(bloodlineData?.ownedCards || []).map((card) => (
                <div key={card.id} className="rounded-lg border border-slate-200 bg-white p-3">
                  <p className="text-sm font-bold text-slate-900">{card.name}</p>
                  {card.description ? (
                    <p className="mt-1 text-sm text-slate-600">{card.description}</p>
                  ) : null}
                  <p className="mt-2 text-xs text-slate-500">
                    제작자: {card.creator.name} / 현재 보유자: {card.currentOwner.name}
                  </p>
                  {card.transfers?.length ? (
                    <div className="mt-3 space-y-1.5">
                      <p className="text-xs font-semibold text-slate-700">최근 전달 이력</p>
                      {card.transfers.map((transfer) => (
                        <p key={transfer.id} className="text-xs text-slate-500">
                          {new Date(transfer.createdAt).toLocaleDateString("ko-KR")} ·{" "}
                          {transfer.fromUser ? transfer.fromUser.name : "시스템"} →{" "}
                          {transfer.toUser.name}
                          {transfer.note ? ` · ${transfer.note}` : ""}
                        </p>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))}

              {!isBloodlineLoading && (bloodlineData?.ownedCards?.length || 0) === 0 ? (
                <div className="rounded-lg border border-dashed border-slate-300 bg-white p-5 text-center text-sm text-slate-500">
                  아직 보유 중인 혈통카드가 없습니다. 전용 페이지에서 대표 혈통카드를 만들어보세요.
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MyPageClient;
