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
import { BloodlineVisualCard } from "@components/features/bloodline/BloodlineVisualCard";
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
  pending: "bg-slate-100 text-slate-700",
  approved: "bg-slate-100 text-slate-700",
  rejected: "bg-slate-100 text-slate-700",
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
  const receivedCards = useMemo(() => {
    if (!bloodlineData) return [];
    if (bloodlineData.receivedBloodlines?.length) return bloodlineData.receivedBloodlines;
    if (bloodlineData.receivedCards?.length) {
      return bloodlineData.receivedCards.filter((card) => card.cardType === "BLOODLINE");
    }
    return (bloodlineData.ownedCards || []).filter(
      (card) => card.creator.id !== user?.id && card.cardType === "BLOODLINE"
    );
  }, [bloodlineData, user?.id]);

  const myCreatedCards = useMemo(() => {
    if (!bloodlineData) return [];
    if (bloodlineData.myBloodlines?.length) return bloodlineData.myBloodlines;
    if (bloodlineData.myCreatedCards?.length) {
      return bloodlineData.myCreatedCards.filter((card) => card.cardType === "BLOODLINE");
    }
    return (bloodlineData.ownedCards || []).filter(
      (card) => card.creator.id === user?.id && card.cardType === "BLOODLINE"
    );
  }, [bloodlineData, user?.id]);

  const tabCountMap: Record<ActivityTab, number> = {
    posts: profileUser?._count?.posts ?? 0,
    comments: profileUser?._count?.Comments ?? 0,
    guinness: mySubmissions.length,
    products: profileUser?._count?.products ?? 0,
    bloodline: (myCreatedCards.length + receivedCards.length) ?? 0,
  };

  const providerLabel =
    user?.provider === USER_INFO.provider.GOOGLE
      ? "Google"
      : user?.provider === USER_INFO.provider.APPLE
        ? "Apple"
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
                className="w-20 h-20 rounded-full bg-slate-200 dark:bg-slate-700 object-cover"
              />
            ) : (
              <div className="w-20 h-20 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center">
                <svg
                  className="w-10 h-10 text-slate-400"
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
              <span className="text-lg font-bold text-slate-900">
                {profileUser?._count?.posts ?? 0}
              </span>
              <span className="text-xs text-slate-500">게시물</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-lg font-bold text-slate-900">
                {profileUser?._count?.insectRecords ?? 0}
              </span>
              <span className="text-xs text-slate-500">공식 기록</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-lg font-bold text-slate-900">
                {profileUser?._count?.followers ?? 0}
              </span>
              <span className="text-xs text-slate-500">팔로워</span>
            </div>
          </div>
        </div>

        {/* 이름 + 이메일 */}
        <div className="mt-4">
          <h2 className="text-lg font-bold text-slate-900">
            {user?.name || ""}
          </h2>
          {user?.email && (
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{user.email}</p>
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
                <p className="mt-2 text-xs font-semibold text-slate-600">
                  {switchMessage}
                </p>
              ) : null}
              {switchError ? (
                <p className="mt-2 text-xs font-semibold text-slate-600">
                  {switchError}
                </p>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>

      <div className="h-px border-t border-slate-100/80" />

      {/* 거래 메뉴 */}
      <div className="px-4 py-4">
        <MySaleHistroyMenu />
      </div>

      <div className="h-px border-t border-slate-100/80" />

      {/* 활동 탭 */}
      <div className="px-4 py-4">
        <h3 className="mb-3 text-base font-semibold text-slate-900">내 활동</h3>

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
              <Link
                href="/bloodline-management"
                className="inline-flex h-10 w-full items-center justify-center rounded-lg bg-gradient-to-r from-slate-500 to-slate-500 text-sm font-semibold text-white shadow-[0_12px_24px_rgba(15, 23, 42,0.23)] transition hover:scale-[1.01] hover:shadow-[0_16px_28px_rgba(15, 23, 42,0.3)]"
              >
                혈통관리로 이동
              </Link>

              {isBloodlineLoading ? (
                <div className="flex h-28 items-center justify-center">
                  <Spinner />
                </div>
              ) : null}

              {bloodlineLoadError ? (
                <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700">
                  혈통카드 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.
                </p>
              ) : null}

              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">내가 만든 카드</p>
                <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-700">
                  {myCreatedCards.length}장
                </span>
              </div>

              {myCreatedCards.map((card) => (
                <section
                  key={card.id}
                  className="overflow-hidden rounded-2xl border border-slate-200/75 bg-gradient-to-br from-white/90 via-slate-50 to-slate-50 p-3"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">내가 만든 카드</p>
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-700">
                      ACTIVE
                    </span>
                  </div>
                    <BloodlineVisualCard
                      cardId={card.id}
                      name={card.name}
                      ownerName={card.currentOwner.name}
                      subtitle={`${card.currentOwner.name} 님의 내가 만든 혈통카드`}
                      image={card.image}
                      variant={card.visualStyle}
                      compact
                    />
                  {card.description ? (
                    <p className="mt-2 text-sm leading-relaxed text-slate-600">
                      {card.description}
                    </p>
                  ) : null}
                  <p className="mt-2 text-xs text-slate-500">
                    현재 보유자: {card.currentOwner.name}
                  </p>
                </section>
              ))}

              {!isBloodlineLoading && myCreatedCards.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 bg-white p-5 text-center text-sm text-slate-500">
                  아직 만든 혈통카드가 없습니다.
                </div>
              ) : null}

              <section className="space-y-3">
                <div className="mb-1 flex items-center justify-between">
                  <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">내가 전달받은 카드</p>
                  <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-700">
                    {receivedCards.length}장
                  </span>
                </div>

                {receivedCards.length ? null : (
                  <div className="rounded-xl border border-dashed border-slate-300 bg-white p-5 text-center text-sm text-slate-500">
                    아직 전달받은 카드가 없습니다.
                  </div>
                )}

                {receivedCards.map((card) => (
                  <section
                    key={card.id}
                    className="overflow-hidden rounded-2xl border border-slate-200/80 bg-gradient-to-br from-white/95 via-slate-50 to-slate-50 p-3 transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_16px_36px_rgba(15, 23, 42,0.2)]"
                  >
                    <BloodlineVisualCard
                      cardId={card.id}
                      name={card.name}
                      ownerName={card.currentOwner.name}
                      subtitle={card.description || "혈통카드 설명이 아직 등록되지 않았습니다."}
                      image={card.image}
                      variant={card.visualStyle}
                      compact
                    />
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-700">
                        제작자 {card.creator.name}
                      </span>
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-700">
                        보유자 {card.currentOwner.name}
                      </span>
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-700">
                        전달 {card.transfers?.length || 0}건
                      </span>
                    </div>

                    {card.transfers?.length ? (
                      <div className="mt-3 space-y-1.5 rounded-lg border border-slate-100 bg-slate-50/80 p-2">
                        <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-700">
                          최근 전달 이력
                        </p>
                        {card.transfers.map((transfer) => (
                          <p key={transfer.id} className="text-xs leading-relaxed text-slate-500">
                            {new Date(transfer.createdAt).toLocaleDateString("ko-KR")} ·{" "}
                            {transfer.fromUser ? transfer.fromUser.name : "시스템"} → {transfer.toUser.name}
                            {transfer.note ? ` · ${transfer.note}` : ""}
                          </p>
                        ))}
                      </div>
                    ) : null}
                  </section>
                ))}
              </section>

            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MyPageClient;
