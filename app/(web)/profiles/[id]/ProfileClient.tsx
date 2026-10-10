"use client";
/**
 * 타인/내 프로필 — 사진형 A안 v4(앱 src/app/profiles/[id]/index.tsx, 시안 design/mockups/profile/A-karrot.html, PRD profile.md S-1).
 *
 * 구조:
 *   헤더(profile 변형: 뒤로 · 이름 · 공유 · 더보기)
 *   ProfileBlock(아바타 80 + 게시물·팔로워·팔로잉 · 이름 · 컬러 뱃지 · 주력 종 · 소개 · 버튼 36)
 *   ProfileCompletionCard(본인만, v5) · AlbumRow(내 앨범 → 종별 자동 앨범 → 본인이면 '새 앨범')
 *   OnSaleRail '지금 분양 중'(v5: 진행 중 경매 + 판매중(분양중)·예약중 분양글)
 *   UnderlineTabs: 사진 · 기록 · 분양 · 경매 · 혈통(같은 너비, 스크롤하면 헤더 아래에 붙는다)
 *   탭 내용: 사진 3열 그리드(고정 우선) / 게시물·분양글(분양 탭 맨 위 분양·입양내역 행)·경매·혈통 목록
 *   하단 탭바(앱처럼 프로필에서도 바로 탭을 옮긴다)
 */
import { useParams, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import useSWR from "swr";

import MainLayout, { toLoginHref } from "@components/features/MainLayout";
import { ActionSheet, type ActionSheetAction } from "@components/app/ActionSheet";
import { HeaderIconButton } from "@components/app/HeaderIconButton";
import { BlockConfirmDialog } from "@components/app/moderation/BlockConfirmDialog";
import { ReportSheet } from "@components/app/moderation/ReportSheet";
import AlbumRow, { useSpeciesAlbums, useUserAlbums } from "@components/features/profile/AlbumRow";
import FollowButton from "@components/features/profile/FollowButton";
import OnSaleRail, { useUserOnSale } from "@components/features/profile/OnSaleRail";
import ProfileCompletionCard from "@components/features/profile/ProfileCompletionCard";
import PhotoGrid from "@components/features/profile/PhotoGrid";
import { ProfileBlock, ProfileSecondaryButton } from "@components/features/profile/ProfileBlock";
import ProfilePinSheet from "@components/features/profile/ProfilePinSheet";
import UnderlineTabs, { scrollToProfileTabs } from "@components/features/profile/UnderlineTabs";
import {
  LineIcon,
  LoadingBlock,
  SectionGap,
  TransactionMenu,
} from "@components/features/profile/ProfileRows";
import {
  ProfileAuctionRows,
  ProfileBloodlineRows,
  ProfilePostRows,
  ProfileProductRows,
  useUserAuctionsList,
  useUserPhotoPostsList,
  useUserPostsList,
  useUserProductsList,
  type ProfilePost,
} from "@components/features/profile/ProfileActivityLists";
import { PROFILE_TABS, type ProfileTab } from "@libs/client/profileTabs";
import { absoluteUrl, copyText, shareOrCopy } from "@libs/client/share";
import { toast } from "@libs/client/toast";
import { DELETED_USER_LABEL, isDeletedUserName } from "@libs/shared/deletedUser";
import useBlocks from "hooks/useBlocks";
import useMutation from "hooks/useMutation";
import useUser from "hooks/useUser";
import type { ChatResponseType } from "pages/api/chat";
import type { UserResponse } from "pages/api/users/[id]";
import type { UserBloodlineCardsResponse } from "pages/api/users/[id]/bloodline-cards";

/** 응답 정규화 후 탈퇴 사용자 이름은 "탈퇴한 사용자"(접미사 없음)로 온다. */
const isDeletedUser = (name?: string | null) =>
  Boolean(name) && (name === DELETED_USER_LABEL || isDeletedUserName(name));

const ProfileClient = () => {
  const router = useRouter();
  const params = useParams();
  const rawId = params?.id;
  const id = typeof rawId === "string" ? rawId : Array.isArray(rawId) ? rawId[0] ?? "" : "";
  const [activeTab, setActiveTab] = useState<ProfileTab>("photos");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [blockTarget, setBlockTarget] = useState<{ id: number; name: string } | null>(null);
  // 본인 프로필에서 사진 칸 ⋯ 를 누르면 고정/해제 시트
  const [pinTarget, setPinTarget] = useState<ProfilePost | null>(null);
  const { user: me } = useUser();
  const { isBlocked: isBlockedUser, isLoading: blocksLoading, unblock, isPending: unblockPending } = useBlocks();

  const { data, error, isLoading, mutate } = useSWR<UserResponse>(id ? `/api/users/${id}` : null);
  const user = data?.user;

  // 탭은 누구 프로필이든 다섯 개 그대로 둔다(내용이 없으면 빈 상태). 2026-10-09 v4.
  const currentTab = activeTab;

  const isMyProfile = Boolean(me?.id && user?.id && me.id === user.id);
  // 목록은 그 탭을 열었을 때만 받는다. 본인은 완성 카드(대표 사진 고정 여부)가 사진 1페이지를 쓰므로 늘 받는다.
  const photosList = useUserPhotoPostsList(id, undefined, currentTab === "photos" || isMyProfile);
  const postsList = useUserPostsList(id, currentTab === "posts");
  const productsList = useUserProductsList(id, currentTab === "products");
  const auctionsList = useUserAuctionsList(id, currentTab === "auctions");
  const bloodlinesQuery = useSWR<UserBloodlineCardsResponse>(
    id && currentTab === "bloodlines" ? `/api/users/${id}/bloodline-cards` : null
  );
  const albumsQuery = useSpeciesAlbums(id || undefined);
  const userAlbumsQuery = useUserAlbums(id || undefined);
  const onSaleQuery = useUserOnSale(id || undefined);

  const [getChatRoomId, { loading: chatLoading }] = useMutation<ChatResponseType>(`/api/chat`);

  const profilePath = `/profiles/${id}`;
  const isDeleted = isDeletedUser(user?.name);
  // 차단 여부는 차단 목록이 기준이고, 목록을 받기 전에는 프로필 응답의 isBlocked 로 그린다.
  const isBlocked = Boolean(
    user?.id && !isMyProfile && (blocksLoading ? data?.isBlocked : isBlockedUser(user.id))
  );
  // 본인·탈퇴한 사용자 프로필에는 ⋮ 를 두지 않는다.
  const canModerate = Boolean(user && !isMyProfile && !isDeleted);
  const isFollowing = Boolean(data?.isFollowing);

  /** 비로그인이면 로그인 화면으로 보내고, 로그인 후 이 프로필로 돌아오게 한다. */
  const requireLogin = () => {
    if (me) return false;
    router.push(toLoginHref(profilePath));
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

  const handleUnblock = async () => {
    if (requireLogin() || unblockPending || !user?.id) return;
    const ok = await unblock(user.id);
    if (ok) void mutate();
  };

  const handleShare = () => {
    if (!user) return;
    void shareOrCopy({ title: `${user.name}님의 브리디 프로필`, url: `/profiles/${user.id}` });
  };

  const sheetActions: ActionSheetAction[] = user
    ? [
        {
          key: "copy-link",
          label: "링크 복사",
          onSelect: async () => {
            const ok = await copyText(absoluteUrl(`/profiles/${user.id}`));
            if (ok) toast.success("링크를 복사했어요");
            else toast.error("링크를 복사하지 못했어요");
          },
        },
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

  const actions = !user ? null : isMyProfile ? (
    <>
      <ProfileSecondaryButton label="프로필 수정" href="/editProfile" />
      <ProfileSecondaryButton label="프로필 공유" onClick={handleShare} />
    </>
  ) : isDeleted ? null : isBlocked ? (
    // 차단한 사용자는 팔로우·메시지 대신 차단 해제만 둔다.
    <ProfileSecondaryButton label="차단 해제" disabled={unblockPending} onClick={() => void handleUnblock()} />
  ) : (
    <>
      <FollowButton userId={user.id} isFollowing={isFollowing} returnPath={profilePath} size="lg" />
      <ProfileSecondaryButton
        label="메시지"
        ariaLabel="메시지 보내기"
        disabled={chatLoading}
        onClick={() => void handleChat()}
      />
    </>
  );

  const headerRight =
    user && !isDeleted ? (
      <>
        <HeaderIconButton label="프로필 공유" onClick={handleShare}>
          <LineIcon name="share" size={24} />
        </HeaderIconButton>
        {canModerate ? (
          <HeaderIconButton label="더보기" onClick={() => setSheetOpen(true)}>
            <LineIcon name="more" size={24} strokeWidth={2} />
          </HeaderIconButton>
        ) : null}
      </>
    ) : null;

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
        {id ? <ProfileBlock userId={id} user={user} loading={false} isMine={isMyProfile} actions={actions} /> : null}
        {isMyProfile ? (
          <ProfileCompletionCard
            user={user}
            photoPosts={photosList.isLoaded ? photosList.items : undefined}
            userAlbumCount={userAlbumsQuery.data?.albums?.length}
            onGoPhotosTab={() => setActiveTab("photos")}
          />
        ) : null}
        {id ? (
          <AlbumRow
            userId={id}
            albums={albumsQuery.data?.albums}
            userAlbums={userAlbumsQuery.data?.albums}
            isOwner={isMyProfile}
          />
        ) : null}
        {!isBlocked && !isDeleted ? (
          <OnSaleRail data={onSaleQuery.data} isLoading={onSaleQuery.isLoading} onSeeAll={(tab) => {
              setActiveTab(tab);
              scrollToProfileTabs();
            }}
          />
        ) : null}
        <UnderlineTabs tabs={PROFILE_TABS} active={currentTab} onChange={setActiveTab} />
        {/* 탭을 바꿔도 위에 붙은 탭 줄이 내려가지 않게 내용은 최소한 화면 남은 높이(헤더 56 · 탭 46 · 하단 탭바 56)만큼 차지한다. */}
        <div className="min-h-[calc(100dvh-158px-env(safe-area-inset-bottom))]">
          {currentTab === "photos" ? (
            <PhotoGrid
              list={photosList}
              emptyMessage={isMyProfile ? "사진을 올려 프로필을 채워 보세요" : "아직 올린 사진이 없어요"}
              emptyAction={isMyProfile ? { label: "글쓰기", href: "/posts/upload" } : undefined}
              onPinPost={isMyProfile ? setPinTarget : undefined}
            />
          ) : null}
          {currentTab === "posts" ? <ProfilePostRows list={postsList} /> : null}
          {currentTab === "products" && id ? (
            <>
              <TransactionMenu userId={id} isMine={isMyProfile} />
              <SectionGap />
              <ProfileProductRows list={productsList} />
            </>
          ) : null}
          {currentTab === "auctions" ? <ProfileAuctionRows list={auctionsList} /> : null}
          {currentTab === "bloodlines" ? (
            <ProfileBloodlineRows
              data={bloodlinesQuery.data}
              isLoading={bloodlinesQuery.isLoading}
              isError={Boolean(bloodlinesQuery.error)}
              onRetry={() => void bloodlinesQuery.mutate()}
            />
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <MainLayout headerVariant="profile" title={user?.name} headerRight={headerRight} hasTabBar>
      {body}
      <ActionSheet open={sheetOpen} onClose={() => setSheetOpen(false)} actions={sheetActions} />
      <ProfilePinSheet post={pinTarget} onClose={() => setPinTarget(null)} />
      <ReportSheet
        open={reportOpen}
        targetType="USER"
        targetId={user?.id ?? null}
        onClose={() => setReportOpen(false)}
      />
      <BlockConfirmDialog target={blockTarget} onClose={() => setBlockTarget(null)} onBlocked={() => void mutate()} />
    </MainLayout>
  );
};

export default ProfileClient;
