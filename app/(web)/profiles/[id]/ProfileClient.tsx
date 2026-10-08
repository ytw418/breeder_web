"use client";

import { useParams, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import useSWR from "swr";

import MainLayout, { toLoginHref } from "@components/features/MainLayout";
import { ActionSheet, type ActionSheetAction } from "@components/app/ActionSheet";
import { FilterChip, FilterChipRail } from "@components/app/FilterChip";
import { HeaderIconButton } from "@components/app/HeaderIconButton";
import { BlockConfirmDialog } from "@components/app/moderation/BlockConfirmDialog";
import { ReportSheet } from "@components/app/moderation/ReportSheet";
import {
  BreederProgramBadgeList,
  getPrimaryBreederBenefitLabel,
} from "@components/features/breeder/BreederProgramDecorators";
import {
  LineIcon,
  LoadingBlock,
  ProfileAvatar,
  SectionGap,
  SMALL_BUTTON_CLASS,
  TransactionMenu,
} from "@components/features/profile/ProfileRows";
import {
  ProfileAuctionRows,
  ProfileBloodlineRows,
  ProfilePostRows,
  ProfileProductRows,
  useUserAuctionsList,
  useUserPostsList,
  useUserProductsList,
} from "@components/features/profile/ProfileActivityLists";
import { cn } from "@libs/client/utils";
import { toast } from "@libs/client/toast";
import { DELETED_USER_LABEL, isDeletedUserName } from "@libs/shared/deletedUser";
import useBlocks from "hooks/useBlocks";
import useMutation from "hooks/useMutation";
import useUser from "hooks/useUser";
import type { ChatResponseType } from "pages/api/chat";
import type { FollowResponse } from "pages/api/users/[id]/follow";
import type { UserResponse } from "pages/api/users/[id]";
import type { UserBloodlineCardsResponse } from "pages/api/users/[id]/bloodline-cards";

type ActivityTab = "products" | "posts" | "auctions" | "bloodlines";

const PROFILE_ACTIVITY_TABS: { id: ActivityTab; name: string }[] = [
  { id: "products", name: "상품" },
  { id: "posts", name: "게시물" },
  { id: "auctions", name: "경매" },
  { id: "bloodlines", name: "혈통" },
];

/** 응답 정규화 후 탈퇴 사용자 이름은 "탈퇴한 사용자"(접미사 없음)로 온다. */
const isDeletedUser = (name?: string | null) =>
  Boolean(name) && (name === DELETED_USER_LABEL || isDeletedUserName(name));

const ProfileClient = () => {
  const router = useRouter();
  const params = useParams();
  const rawId = params?.id;
  const id = typeof rawId === "string" ? rawId : Array.isArray(rawId) ? rawId[0] ?? "" : "";
  const [activeTab, setActiveTab] = useState<ActivityTab>("products");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [blockTarget, setBlockTarget] = useState<{ id: number; name: string } | null>(null);
  const { user: me } = useUser();
  const { isBlocked: isBlockedUser, isLoading: blocksLoading, unblock, isPending: unblockPending } = useBlocks();

  const { data, error, isLoading, mutate } = useSWR<UserResponse>(id ? `/api/users/${id}` : null);

  // 활동 목록은 그 탭을 열었을 때만 받는다. 경매는 프로필 응답에 경매 수가 없어 탭 카운트에도 쓰므로 늘 받는다.
  const productsList = useUserProductsList(id, activeTab === "products");
  const postsList = useUserPostsList(id, activeTab === "posts");
  const auctionsList = useUserAuctionsList(id);
  const bloodlinesQuery = useSWR<UserBloodlineCardsResponse>(
    id && activeTab === "bloodlines" ? `/api/users/${id}/bloodline-cards` : null
  );

  const [getChatRoomId, { loading: chatLoading }] = useMutation<ChatResponseType>(`/api/chat`);
  const [toggleFollow, { loading: followLoading }] = useMutation<FollowResponse>(`/api/users/${id}/follow`);

  const user = data?.user;
  const isMyProfile = Boolean(me?.id && user?.id && me.id === user.id);
  const isDeleted = isDeletedUser(user?.name);
  // 차단 여부는 차단 목록이 기준이고, 목록을 받기 전에는 프로필 응답의 isBlocked 로 그린다.
  const isBlocked = Boolean(
    user?.id && !isMyProfile && (blocksLoading ? data?.isBlocked : isBlockedUser(user.id))
  );
  // 본인·탈퇴한 사용자 프로필에는 신고/차단 ⋮ 를 두지 않는다.
  const canModerate = Boolean(user && !isMyProfile && !isDeleted);
  const subLabel = isMyProfile ? user?.email : user?.maskedEmail;
  const isFollowing = Boolean(data?.isFollowing);
  const benefitLabel = getPrimaryBreederBenefitLabel(user?.breederPrograms);

  /** 비로그인이면 로그인 화면으로 보내고, 로그인 후 이 프로필로 돌아오게 한다. */
  const requireLogin = () => {
    if (me) return false;
    router.push(toLoginHref(`/profiles/${id}`));
    return true;
  };

  const handleChat = async () => {
    if (requireLogin() || chatLoading || !user?.id) return;
    await getChatRoomId({
      data: { otherId: user.id },
      onCompleted(result) {
        if (result.success && result.ChatRoomId) {
          router.push(`/chat/${result.ChatRoomId}`);
          return;
        }
        toast.error((result as { error?: string }).error || "채팅방 생성에 실패했습니다.");
      },
      onError() {
        toast.error("채팅방 생성에 실패했습니다.");
      },
    });
  };

  const handleFollow = async () => {
    if (requireLogin() || followLoading) return;
    await toggleFollow({
      data: {},
      onCompleted(result) {
        // 차단·자기 자신 등 서버가 거절하면(success:false) 서버 문구를 그대로 알린다.
        if (!result?.success) {
          toast.error((result as { error?: string } | undefined)?.error || "팔로우 처리에 실패했습니다.");
          return;
        }
        void mutate();
      },
      onError() {
        toast.error("팔로우 처리에 실패했습니다.");
      },
    });
  };

  const handleUnblock = async () => {
    if (requireLogin() || unblockPending || !user?.id) return;
    const ok = await unblock(user.id);
    if (ok) void mutate();
  };

  const sheetActions: ActionSheetAction[] = user
    ? [
        {
          key: "report",
          label: "신고하기",
          onSelect: () => {
            if (requireLogin()) return;
            setReportOpen(true);
          },
        },
        isBlocked
          ? { key: "unblock", label: "차단 해제", onSelect: () => void handleUnblock() }
          : {
              key: "block",
              label: "차단하기",
              destructive: true,
              onSelect: () => {
                if (requireLogin()) return;
                setBlockTarget({ id: user.id, name: user.name });
              },
            },
      ]
    : [];

  const tabCountMap: Record<ActivityTab, number | string> = {
    products: user?._count?.products ?? 0,
    posts: user?._count?.posts ?? 0,
    // 남은 페이지가 있으면 받은 수 뒤에 '+'를 붙인다(서버가 경매 총수를 따로 주지 않는다).
    auctions: auctionsList.hasNextPage ? `${auctionsList.items.length}+` : auctionsList.items.length,
    bloodlines: user?._count?.ownedBloodlineCards ?? 0,
  };

  const headerRight = canModerate ? (
    <HeaderIconButton label="더보기" onClick={() => setSheetOpen(true)}>
      <LineIcon name="more" size={24} strokeWidth={2} />
    </HeaderIconButton>
  ) : (
    <span className="h-11 w-11" aria-hidden="true" />
  );

  let body: ReactNode;
  if (isLoading) {
    body = <LoadingBlock height={320} />;
  } else if (error && !data) {
    body = (
      <div className="flex flex-col items-center justify-center px-5 py-24 text-center">
        <p className="text-[14px] text-app-muted">프로필을 불러올 수 없습니다.</p>
        <button
          type="button"
          onClick={() => router.back()}
          className="mt-3 h-9 rounded-md bg-app-surface px-3.5 text-[14px] font-semibold text-app-text"
        >
          돌아가기
        </button>
      </div>
    );
  } else {
    body = (
      <div className="flex flex-col bg-app-bg pb-8">
        {/* ① 프로필 */}
        <div className="px-5 py-5">
          <div className="flex items-center gap-3">
            {/* 앱 profiles/[id] 처럼 프로필 화면 아바타에는 브리더 프레임을 두르지 않는다(프레임은 마이페이지만). */}
            <ProfileAvatar avatar={user?.avatar} name={user?.name ?? ""} />
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-[18px] font-bold text-app-text">{user?.name || ""}</h2>
              {subLabel ? <p className="mt-0.5 truncate text-[13px] text-app-muted">{subLabel}</p> : null}
            </div>
            {isMyProfile ? (
              <button type="button" className={SMALL_BUTTON_CLASS} onClick={() => router.push("/editProfile")}>
                프로필 수정
              </button>
            ) : isDeleted ? null : isBlocked ? (
              // 차단한 사용자는 메시지·팔로우 대신 차단 해제만 둔다.
              <button
                type="button"
                className={SMALL_BUTTON_CLASS}
                disabled={unblockPending}
                onClick={() => void handleUnblock()}
              >
                차단 해제
              </button>
            ) : (
              <div className="flex gap-1.5">
                <button
                  type="button"
                  aria-label="메시지 보내기"
                  className={SMALL_BUTTON_CLASS}
                  disabled={chatLoading}
                  onClick={() => void handleChat()}
                >
                  메시지
                </button>
                <button
                  type="button"
                  aria-pressed={isFollowing}
                  disabled={followLoading}
                  onClick={() => void handleFollow()}
                  className={cn(
                    SMALL_BUTTON_CLASS,
                    isFollowing ? "" : "bg-app-brand text-white"
                  )}
                >
                  {isFollowing ? "팔로잉" : "팔로우"}
                </button>
              </div>
            )}
          </div>

          {/* ② 통계 한 줄 */}
          <p className="mt-3 text-[14px] text-app-muted">
            상품 {user?._count?.products ?? 0} · 팔로워 {user?._count?.followers ?? 0} · 팔로잉{" "}
            {user?._count?.following ?? 0}
          </p>

          {/* ③ 브리더 프로그램 · 시즌 뱃지(중립 pill) */}
          {(user?.breederPrograms?.length ?? 0) > 0 || (user?.badges?.length ?? 0) > 0 ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              <BreederProgramBadgeList programs={user?.breederPrograms} />
              {user?.badges?.map((badge) => (
                <span
                  key={badge.id}
                  className="inline-flex items-center whitespace-nowrap rounded bg-app-surface px-1.5 py-0.5 text-[12px] leading-4 text-app-muted"
                >
                  {badge.label}
                </span>
              ))}
            </div>
          ) : null}
          {benefitLabel ? <p className="mt-2 text-[13px] text-app-muted">{benefitLabel}</p> : null}
        </div>

        <SectionGap />

        {/* ④ 거래 메뉴 */}
        {id ? <TransactionMenu userId={id} isMine={isMyProfile} /> : null}

        <SectionGap />

        {/* ⑤ 등록 콘텐츠 */}
        <div className="pt-4">
          <h3 className="mb-1.5 px-5 text-[18px] font-bold text-app-text">등록 콘텐츠</h3>
          <FilterChipRail className="px-5">
            {PROFILE_ACTIVITY_TABS.map((tab) => (
              <FilterChip
                key={tab.id}
                label={tab.name}
                count={tabCountMap[tab.id]}
                selected={activeTab === tab.id}
                onClick={() => setActiveTab(tab.id)}
              />
            ))}
          </FilterChipRail>
          <div className="mt-1.5">
            {activeTab === "products" ? <ProfileProductRows list={productsList} /> : null}
            {activeTab === "posts" ? <ProfilePostRows list={postsList} /> : null}
            {activeTab === "auctions" ? <ProfileAuctionRows list={auctionsList} /> : null}
            {activeTab === "bloodlines" ? (
              <ProfileBloodlineRows
                data={bloodlinesQuery.data}
                isLoading={bloodlinesQuery.isLoading}
                isError={Boolean(bloodlinesQuery.error)}
                onRetry={() => void bloodlinesQuery.mutate()}
              />
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  return (
    <MainLayout canGoBack title={user?.name} headerRight={headerRight}>
      {body}
      <ActionSheet open={sheetOpen} onClose={() => setSheetOpen(false)} actions={sheetActions} />
      <ReportSheet
        open={reportOpen}
        targetType="USER"
        targetId={user?.id ?? null}
        onClose={() => setReportOpen(false)}
      />
      <BlockConfirmDialog
        target={blockTarget}
        onClose={() => setBlockTarget(null)}
        onBlocked={() => void mutate()}
      />
    </MainLayout>
  );
};

export default ProfileClient;
