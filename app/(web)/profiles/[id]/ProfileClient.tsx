"use client";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";

import Image from "@components/atoms/Image";
import MainLayout from "@components/features/MainLayout";
import MyCommunityPostList from "@components/features/profile/MyCommunityPostList";
import MyPostList from "@components/features/profile/MyPostList";
import ProfileAuctionList from "@components/features/profile/ProfileAuctionList";
import ProfileBloodlineList from "@components/features/profile/ProfileBloodlineList";
import MySaleHistoryMenu from "@components/features/profile/MySaleHistoryMenu";
import { Button } from "@components/ui/button";
import { cn, makeImageUrl } from "@libs/client/utils";
import {
  getBreederProgramBenefitLabel,
  sortBreederPrograms,
  type BreederProgramSummary,
  type BreederProgramType,
} from "@libs/shared/breeder-program";
import useMutation from "hooks/useMutation";
import useUser from "hooks/useUser";
import { ChatResponseType } from "pages/api/chat";
import { FollowResponse } from "pages/api/users/[id]/follow";
import { UserResponse } from "pages/api/users/[id]";
import useSWR from "swr";

type ActivityTab = "products" | "posts" | "bloodlines" | "auctions";

type ProfileUser = NonNullable<UserResponse["user"]> & {
  breederPrograms?: BreederProgramSummary[];
};

const PROFILE_ACTIVITY_TABS: { id: ActivityTab; name: string }[] = [
  { id: "products", name: "상품" },
  { id: "posts", name: "게시물" },
  { id: "auctions", name: "경매" },
  { id: "bloodlines", name: "보유혈통" },
];

const BREEDER_PROGRAM_META: Record<
  BreederProgramType,
  {
    label: string;
    frameClassName: string;
    badgeClassName: string;
  }
> = {
  FOUNDING_BREEDER: {
    label: "창립 브리더",
    frameClassName:
      "bg-gradient-to-br from-amber-200 via-white to-amber-100 ring-[3px] ring-amber-400/75 shadow-[0_0_0_6px_rgba(251,191,36,0.12)]",
    badgeClassName: "border-amber-200 bg-amber-50 text-amber-800",
  },
  PARTNER_BREEDER: {
    label: "파트너 브리더",
    frameClassName:
      "bg-gradient-to-br from-cyan-100 via-white to-slate-100 ring-[3px] ring-cyan-400/70 shadow-[0_0_0_6px_rgba(34,211,238,0.10)]",
    badgeClassName: "border-cyan-200 bg-cyan-50 text-cyan-800",
  },
  VERIFIED_BREEDER: {
    label: "인증 브리더",
    frameClassName:
      "bg-gradient-to-br from-slate-100 via-white to-slate-50 ring-[3px] ring-slate-300 shadow-[0_0_0_6px_rgba(148,163,184,0.10)]",
    badgeClassName: "border-slate-200 bg-slate-100 text-slate-700",
  },
};

const formatFoundingNo = (value?: number | null) => {
  if (!value) return "";
  return `No.${String(value).padStart(3, "0")}`;
};

const ProfileClient = () => {
  const router = useRouter();
  const query = useParams();
  const [activeTab, setActiveTab] = useState<ActivityTab>("products");
  const { user: me } = useUser();
  const { data, mutate } = useSWR<UserResponse>(
    query && `/api/users/${query.id}`
  );

  const [getChatRoomId, { loading: chatLoading }] =
    useMutation<ChatResponseType>(`/api/chat`);

  const [toggleFollow, { loading: followLoading }] =
    useMutation<FollowResponse>(`/api/users/${query?.id}/follow`);

  const isMyProfile = me?.id === data?.user?.id;

  const handleChat = async () => {
    if (!data?.user?.id) return;
    await getChatRoomId({
      data: { otherId: data.user.id },
      onCompleted(result) {
        if (result.success && result.ChatRoomId) {
          router.push(`/chat/${result.ChatRoomId}`);
        }
      },
    });
  };

  const handleFollow = async () => {
    if (followLoading) return;
    await toggleFollow({
      data: {},
      onCompleted() {
        mutate();
      },
    });
  };

  const user = data?.user as ProfileUser | undefined;
  const activeBreederPrograms = sortBreederPrograms(
    (user?.breederPrograms || []).filter((program) => program.status === "ACTIVE")
  );
  const primaryBreederProgram = activeBreederPrograms[0] ?? null;
  const primaryBreederBenefitLabel = primaryBreederProgram
    ? getBreederProgramBenefitLabel(primaryBreederProgram)
    : null;
  const avatarUrl = user?.avatar
    ? user.avatar.includes("http")
      ? user.avatar
      : makeImageUrl(user.avatar, "avatar")
    : "";
  const tabCountMap: Record<ActivityTab, number> = {
    products: user?._count?.products ?? 0,
    posts: user?._count?.posts ?? 0,
    auctions: 0,
    bloodlines: user?._count?.ownedBloodlineCards ?? 0,
  };

  return (
    <MainLayout canGoBack title={user?.name}>
      <div className="flex flex-col">
        <div className="px-6 pb-4 pt-6">
          <div className="flex items-center gap-5">
            <div
              className={cn(
                "flex-shrink-0 rounded-[28px] p-1",
                primaryBreederProgram
                  ? BREEDER_PROGRAM_META[primaryBreederProgram.programType].frameClassName
                  : ""
              )}
            >
              {avatarUrl ? (
                <Image
                  src={avatarUrl}
                  alt={user?.name || "프로필"}
                  width={80}
                  height={80}
                  className={cn(
                    "h-20 w-20 rounded-full bg-gray-200 object-cover",
                    primaryBreederProgram ? "ring-2 ring-white/70" : ""
                  )}
                />
              ) : (
                <div
                  className={cn(
                    "flex h-20 w-20 items-center justify-center rounded-full bg-gray-200",
                    primaryBreederProgram ? "ring-2 ring-white/70" : ""
                  )}
                >
                  <svg
                    className="h-10 w-10 text-gray-400"
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

            <div className="flex flex-1 justify-around">
              <div className="flex flex-col items-center">
                <span className="text-lg font-bold text-gray-900">
                  {user?._count?.products ?? 0}
                </span>
                <span className="text-xs text-gray-500">상품</span>
              </div>
              <div className="flex flex-col items-center">
                <span className="text-lg font-bold text-gray-900">
                  {user?._count?.followers ?? 0}
                </span>
                <span className="text-xs text-gray-500">팔로워</span>
              </div>
              <div className="flex flex-col items-center">
                <span className="text-lg font-bold text-gray-900">
                  {user?._count?.following ?? 0}
                </span>
                <span className="text-xs text-gray-500">팔로잉</span>
              </div>
            </div>
          </div>

          <div className="mt-4">
            <h2 className="text-lg font-bold text-gray-900">{user?.name || ""}</h2>
            {isMyProfile && user?.email ? (
              <p className="mt-0.5 text-sm text-gray-500">{user.email}</p>
            ) : null}
            {!isMyProfile && user?.maskedEmail ? (
              <p className="mt-0.5 text-sm text-gray-500">{user.maskedEmail}</p>
            ) : null}
            {activeBreederPrograms.length > 0 || (user?.badges?.length ?? 0) > 0 ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {activeBreederPrograms.map((program) => {
                  const meta = BREEDER_PROGRAM_META[program.programType];
                  return (
                    <span
                      key={program.id}
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold",
                        meta.badgeClassName
                      )}
                    >
                      <span>{meta.label}</span>
                      {program.programType === "FOUNDING_BREEDER" && program.foundingNo ? (
                        <span className="opacity-80">
                          {formatFoundingNo(program.foundingNo)}
                        </span>
                      ) : null}
                    </span>
                  );
                })}
                {user?.badges?.map((badge) => (
                  <span
                    key={badge.id}
                    className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700"
                  >
                    {badge.label}
                  </span>
                ))}
              </div>
            ) : null}
            {primaryBreederBenefitLabel ? (
              <p className="mt-2 text-xs font-medium text-slate-600">
                {primaryBreederBenefitLabel}
              </p>
            ) : null}
            <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
              <span className="rounded-full bg-slate-100 px-2.5 py-1">
                검증 기록 {user?._count?.insectRecords ?? 0}
              </span>
              <span className="rounded-full bg-slate-100 px-2.5 py-1">
                혈통 활동 {user?._count?.createdBloodlineCards ?? 0}
              </span>
            </div>
          </div>

          {!isMyProfile ? (
            <div className="mt-4 flex gap-2">
              <Button
                variant={data?.isFollowing ? "outline" : "default"}
                className="flex-1"
                onClick={handleFollow}
                disabled={followLoading}
              >
                {data?.isFollowing ? "팔로잉" : "팔로우"}
              </Button>
              <Button
                variant="outline"
                className="flex-1"
                onClick={handleChat}
                disabled={chatLoading}
              >
                메시지
              </Button>
            </div>
          ) : null}

          {isMyProfile ? (
            <div className="mt-4">
              <Button
                variant="outline"
                className="w-full"
                onClick={() => router.push("/editProfile")}
              >
                프로필 수정
              </Button>
            </div>
          ) : null}
        </div>

        <div className="h-2 bg-gray-50" />

        <div className="px-4 py-4">
          <MySaleHistoryMenu />
        </div>

        <div className="h-2 bg-gray-50" />

        <div className="px-4 py-4">
          <h3 className="mb-3 text-base font-semibold text-gray-900">등록 콘텐츠</h3>
          <div className="app-card p-2">
            <div className="app-rail flex gap-2 snap-none">
              {PROFILE_ACTIVITY_TABS.map((tab) => (
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
            {query?.id && activeTab === "products" ? (
              <MyPostList userId={Number(query?.id)} />
            ) : null}
            {query?.id && activeTab === "posts" ? (
              <MyCommunityPostList userId={Number(query?.id)} />
            ) : null}
            {query?.id && activeTab === "auctions" ? (
              <ProfileAuctionList userId={Number(query?.id)} />
            ) : null}
            {query?.id && activeTab === "bloodlines" ? (
              <ProfileBloodlineList userId={Number(query?.id)} />
            ) : null}
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default ProfileClient;
