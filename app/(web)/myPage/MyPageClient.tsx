"use client";

import { authFetch } from "@libs/client/authFetch";
import { setTokens } from "@libs/client/authToken";
import { canUseTestAccountSwitcher } from "@libs/shared/test-accounts";
import AlbumRow, { useSpeciesAlbums, useUserAlbums } from "@components/features/profile/AlbumRow";
import PhotoGrid from "@components/features/profile/PhotoGrid";
import OnSaleRail, { useUserOnSale } from "@components/features/profile/OnSaleRail";
import ProfileCompletionCard from "@components/features/profile/ProfileCompletionCard";
import { ProfileBlock, ProfileSecondaryButton } from "@components/features/profile/ProfileBlock";
import ProfilePinSheet from "@components/features/profile/ProfilePinSheet";
import UnderlineTabs, { scrollToProfileTabs } from "@components/features/profile/UnderlineTabs";
import { shareOrCopy } from "@libs/client/share";
import { BloodlineVisualCard } from "@components/features/bloodline/BloodlineVisualCard";
import {
  bloodlineRowMeta,
  bloodlineUserLabel,
} from "@components/features/bloodline/BloodlineScreenParts";
import {
  EmptyBlock,
  LineIcon,
  LoadingBlock,
  RetryBlock,
  SectionGap,
  TransactionMenu,
} from "@components/features/profile/ProfileRows";
import {
  ProfileAuctionRows,
  ProfilePostRows,
  ProfileProductRows,
  useUserAuctionsList,
  useUserPhotoPostsList,
  useUserPostsList,
  useUserProductsList,
  type ProfilePost,
} from "@components/features/profile/ProfileActivityLists";
import { PROFILE_TABS, type ProfileTab } from "@libs/client/profileTabs";
import { USER_INFO } from "@libs/constants";
import useUser from "hooks/useUser";
import useMutation from "hooks/useMutation";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { LoginReqBody, LoginResponseType } from "pages/api/auth/login";
import useSWR from "swr";
import type { UserResponse } from "pages/api/users/[id]";
import {
  bloodlineCardTypeLabel,
  type BloodlineCardItem,
  type BloodlineCardsResponse,
} from "@libs/shared/bloodline-card";
import { useEffect, useMemo, useState, type ReactNode } from "react";

// 사진형 A안 v4(앱 myPage, PRD profile.md S-2): 탭은 남의 프로필과 같은 다섯 개(사진·기록·분양·경매·혈통).
// 댓글은 사이드 메뉴 '내 댓글'(/profiles/:id/comments), 브리디북 신청 내역은 브리디북 신청 화면에 있다.
// 거래(판매·구매·관심)는 '분양' 탭 맨 위 행과 사이드 메뉴, 설정·고객센터·로그아웃은 사이드 메뉴에 있다.

type TestAccountItem = {
  id: number;
  name: string;
  email: string | null;
  provider: string;
  createdAt: string;
};

type TestAccountListResponse = { success: boolean; error?: string; users?: TestAccountItem[] };
type TestAccountSwitchResponse = {
  success: boolean;
  error?: string;
  accessToken?: string;
  refreshToken?: string;
};

/* ------------------------------------------------------------------ */
/* 혈통                                                                  */
/* ------------------------------------------------------------------ */

/** 내 혈통 / 받은 출처 카드 미리보기. 메타는 혈통 화면 행과 같다(종 · 산지 · 받은 사람 N명 / 종 · ○○님에게서 · 날짜). */
function BloodlineCardPreview({ card, kind }: { card: BloodlineCardItem; kind: "created" | "received" }) {
  return (
    <Link href={`/bloodline-management/card/${card.id}`} className="block">
      <BloodlineVisualCard
        cardId={card.id}
        name={card.name}
        ownerName={bloodlineUserLabel(card.currentOwner)}
        subtitle={bloodlineRowMeta(card)}
        image={card.image}
        variant={card.visualStyle ?? "noir"}
        typeLabel={bloodlineCardTypeLabel(card.cardType)}
        issuedAt={card.createdAt}
        compact
      />
      {kind === "received" ? (
        <>
          <p className="mt-2 text-[13px] text-app-muted">
            처음 보낸 사람 {bloodlineUserLabel(card.creator)} · 전달 {card.transfers?.length || 0}건
          </p>
          {card.transfers?.length ? (
            <div className="mt-1.5 space-y-1">
              {card.transfers.map((transfer) => (
                <p key={transfer.id} className="text-[13px] text-app-muted">
                  {new Date(transfer.createdAt).toLocaleDateString("ko-KR")} ·{" "}
                  {transfer.fromUser ? bloodlineUserLabel(transfer.fromUser) : "시스템"} →{" "}
                  {bloodlineUserLabel(transfer.toUser)}
                  {transfer.note ? ` · ${transfer.note}` : ""}
                </p>
              ))}
            </div>
          ) : null}
        </>
      ) : null}
    </Link>
  );
}

function BloodlineSection({
  title,
  countText,
  cards,
  kind,
  emptyText,
}: {
  title: string;
  countText: string;
  cards: BloodlineCardItem[];
  kind: "created" | "received";
  emptyText: string;
}) {
  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <h4 className="text-[14px] font-bold text-app-text">{title}</h4>
        <span className="text-[13px] text-app-muted">{countText}</span>
      </div>
      {cards.length ? (
        <div className="space-y-3">
          {cards.map((card) => (
            <BloodlineCardPreview key={card.id} card={card} kind={kind} />
          ))}
        </div>
      ) : (
        <p className="py-5 text-center text-[14px] text-app-muted">{emptyText}</p>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* 개발자 도구 (테스트 계정·관리자 전용)                                    */
/* ------------------------------------------------------------------ */

function DevNote({ text }: { text: string }) {
  return <p className="px-4 py-1.5 text-[13px] text-app-muted">{text}</p>;
}

function DevRow({
  label,
  caption,
  disabled,
  onClick,
  href,
}: {
  label: string;
  caption?: string;
  disabled?: boolean;
  onClick?: () => void;
  href?: string;
}) {
  const className =
    "flex h-11 w-full items-center gap-2 px-4 text-left hover:bg-app-surface disabled:opacity-50";
  const inner = (
    <>
      <span className="flex-1 truncate text-[14px] text-app-text">{label}</span>
      {caption ? <span className="text-[13px] text-app-muted">{caption}</span> : null}
    </>
  );
  if (href) {
    return (
      <Link href={href} className={className}>
        {inner}
      </Link>
    );
  }
  return (
    <button type="button" className={className} disabled={disabled} onClick={onClick}>
      {inner}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* 화면                                                                */
/* ------------------------------------------------------------------ */

const MyPageClient = () => {
  const { user, isAdmin, mutate: mutateUser } = useUser();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<ProfileTab>("photos");
  // 사진 칸 ⋯ 를 누르면 프로필 고정/해제 시트
  const [pinTarget, setPinTarget] = useState<ProfilePost | null>(null);
  const [devOpen, setDevOpen] = useState(false);
  const [switchError, setSwitchError] = useState("");
  const [switchMessage, setSwitchMessage] = useState("");
  const [loginWithProvider, { loading: switchingGoogle }] =
    useMutation<LoginResponseType>("/api/auth/login");
  const [fakeUsers, setFakeUsers] = useState<TestAccountItem[]>([]);
  const [fakeUsersLoading, setFakeUsersLoading] = useState(false);
  const [fakeUsersError, setFakeUsersError] = useState("");
  const [switchingFakeUserId, setSwitchingFakeUserId] = useState<number | null>(null);
  const userId = user?.id;

  const profileQuery = useSWR<UserResponse>(userId ? `/api/users/${userId}` : null);
  const bloodlineQuery = useSWR<BloodlineCardsResponse>(
    userId && activeTab === "bloodlines" ? "/api/bloodline-cards" : null
  );
  // 목록은 그 탭을 열었을 때만 받고, 페이지로 나눠 목록 끝 '더보기'로 이어 붙인다.
  const postsList = useUserPostsList(userId, activeTab === "posts");
  const productsList = useUserProductsList(userId, activeTab === "products");
  const auctionsList = useUserAuctionsList(userId, activeTab === "auctions");
  // 사진 1페이지는 완성 카드(대표 사진 고정 여부)도 쓰므로 탭과 상관없이 받는다.
  const photosList = useUserPhotoPostsList(userId);
  const onSaleQuery = useUserOnSale(userId);
  const albumsQuery = useSpeciesAlbums(userId);
  const userAlbumsQuery = useUserAlbums(userId);

  const profileUser = profileQuery.data?.user;
  const profileName = profileUser?.name || user?.name || "";
  const profileLoading = profileQuery.isLoading;
  // 이전에 받은 값이 있으면 계속 보여 주고, 처음부터 못 받았을 때만 오류 줄을 띄운다.
  const profileFailed = Boolean(profileQuery.error) && !profileUser;

  const bloodlineData = bloodlineQuery.data;
  // "내 혈통": 지금 내가 가진 혈통(넘겨받은 혈통 포함). 혈통 v2 서버는 myBloodlines 에 모두 담고
  // receivedBloodlines 는 그 부분집합이다(앱 myPage 와 같다). id 로 한 번만 남긴다.
  const myBloodlines = useMemo(() => {
    if (!bloodlineData) return [];
    const seen = new Set<number>();
    return [...(bloodlineData.myBloodlines ?? []), ...(bloodlineData.receivedBloodlines ?? [])].filter(
      (card) => {
        if (card.cardType !== "BLOODLINE" || seen.has(card.id)) return false;
        seen.add(card.id);
        return true;
      }
    );
  }, [bloodlineData]);

  // "받은 출처 카드": 남이 보내 준 출처 카드(지금 내가 보유).
  const receivedLines = useMemo(() => bloodlineData?.receivedLines ?? [], [bloodlineData]);

  /* ---------------- 개발자 도구 ---------------- */
  const canSwitchTestAccount = canUseTestAccountSwitcher(user, Boolean(isAdmin));
  const showDevTools = canSwitchTestAccount || Boolean(isAdmin);
  const fakeUserListForSwitch = fakeUsers.filter((item) => item.id !== userId);

  useEffect(() => {
    if (!canSwitchTestAccount || !devOpen) return;
    let mounted = true;
    setFakeUsersLoading(true);
    setFakeUsersError("");
    const fetchFakeUsers = async () => {
      try {
        const res = await authFetch("/api/users/test-accounts", { method: "GET", cache: "no-store" });
        const data = (await res.json()) as TestAccountListResponse;
        if (!mounted) return;
        if (!res.ok || !data.success) {
          throw new Error(data.error || "fake user 목록을 불러오지 못했습니다.");
        }
        setFakeUsers(data.users || []);
      } catch (error) {
        if (!mounted) return;
        setFakeUsers([]);
        setFakeUsersError(
          error instanceof Error ? error.message : "fake user 목록 조회 중 오류가 발생했습니다."
        );
      } finally {
        if (mounted) setFakeUsersLoading(false);
      }
    };
    void fetchFakeUsers();
    return () => {
      mounted = false;
    };
  }, [canSwitchTestAccount, devOpen]);

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
      const [{ getAuth, GoogleAuthProvider, signInWithPopup }, { app }] = await Promise.all([
        import("firebase/auth"),
        import("@/firebase"),
      ]);
      const auth = getAuth(app);
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      const { user: googleUser } = await signInWithPopup(auth, provider);
      if (!googleUser?.uid) throw new Error("구글 계정 정보를 가져오지 못했습니다.");
      const body: LoginReqBody = {
        token: await googleUser.getIdToken(),
        snsId: googleUser.uid,
        name: googleUser.displayName || googleUser.email?.split("@")[0] || "Google User",
        provider: USER_INFO.provider.GOOGLE,
        email: googleUser.email,
        avatar: googleUser.photoURL || undefined,
      };
      const result = await loginWithProvider({ data: body });
      if (!result?.success) throw new Error(result?.error || "구글 계정 전환에 실패했습니다.");
      await mutateUser();
      setSwitchMessage("구글 계정으로 전환되었습니다.");
      router.refresh();
    } catch (error) {
      setSwitchError(error instanceof Error ? error.message : "구글 계정 전환에 실패했습니다.");
    }
  };

  const handleSwitchToFakeUser = async (targetUserId: number) => {
    if (switchingFakeUserId === targetUserId || targetUserId === userId) return;
    setSwitchError("");
    setSwitchMessage("");
    setSwitchingFakeUserId(targetUserId);
    try {
      const res = await authFetch("/api/users/test-accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: targetUserId }),
      });
      const data = (await res.json()) as TestAccountSwitchResponse;
      if (!res.ok || !data.success) throw new Error(data.error || "fake user 전환에 실패했습니다.");
      if (data.accessToken && data.refreshToken) {
        setTokens({ accessToken: data.accessToken, refreshToken: data.refreshToken });
      }
      // 전환된 계정으로 모든 캐시(SWR 등)를 새로 읽도록 전체 새로고침으로 이동한다.
      window.location.assign("/myPage");
    } catch (error) {
      setSwitchError(error instanceof Error ? error.message : "fake user 전환 중 오류가 발생했습니다.");
    } finally {
      setSwitchingFakeUserId(null);
    }
  };

  /* ---------------- 활동 탭 ---------------- */
  let activityContent: ReactNode = null;
  if (activeTab === "photos") {
    activityContent = (
      <PhotoGrid
        list={photosList}
        emptyMessage="사진을 올려 프로필을 채워 보세요"
        emptyAction={{ label: "글쓰기", href: "/posts/upload" }}
        onPinPost={setPinTarget}
      />
    );
  } else if (activeTab === "posts") {
    activityContent = (
      <ProfilePostRows list={postsList} emptyDescription="첫 게시글을 작성해 보세요." />
    );
  } else if (activeTab === "products") {
    activityContent = (
      <>
        {userId ? <TransactionMenu userId={userId} isMine /> : null}
        <SectionGap />
        <ProfileProductRows list={productsList} showMeta={false} />
      </>
    );
  } else if (activeTab === "auctions") {
    activityContent = <ProfileAuctionRows list={auctionsList} />;
  } else if (activeTab === "bloodlines") {
    activityContent = (
      <div className="space-y-3 px-4">
        <Link
          href="/bloodline-management"
          className="flex h-11 items-center justify-center rounded-md bg-app-surface text-[15px] font-semibold text-app-text"
        >
          혈통관리로 이동
        </Link>
        {bloodlineQuery.isLoading ? <LoadingBlock height={112} /> : null}
        {bloodlineQuery.error && !bloodlineData ? (
          <RetryBlock
            message="혈통 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요."
            onRetry={() => void bloodlineQuery.mutate()}
          />
        ) : null}
        {!bloodlineQuery.isLoading && bloodlineData ? (
          <>
            <BloodlineSection
              title="내 혈통"
              countText={`${myBloodlines.length}개`}
              cards={myBloodlines}
              kind="created"
              emptyText="아직 만든 혈통이 없습니다."
            />
            <BloodlineSection
              title="받은 출처 카드"
              countText={`${receivedLines.length}장`}
              cards={receivedLines}
              kind="received"
              emptyText="아직 받은 출처 카드가 없습니다."
            />
          </>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col bg-app-bg pb-8">
      {/* 프로필 블록 · 앨범 줄(사진형 A안, 시안 #mine) */}
      {userId ? (
        <>
          <ProfileBlock
            userId={userId}
            user={profileUser}
            fallbackName={profileName}
            fallbackAvatar={user?.avatar}
            loading={profileLoading}
            failed={profileFailed}
            onRetry={() => void profileQuery.mutate()}
            isMine
            actions={
              <>
                <ProfileSecondaryButton label="프로필 수정" href="/editProfile" />
                <ProfileSecondaryButton
                  label="프로필 공유"
                  onClick={() =>
                    void shareOrCopy({ title: `${profileName}님의 브리디 프로필`, url: `/profiles/${userId}` })
                  }
                />
              </>
            }
          />
          <ProfileCompletionCard
            user={profileUser}
            photoPosts={photosList.isLoaded ? photosList.items : undefined}
            userAlbumCount={userAlbumsQuery.data?.albums?.length}
            onGoPhotosTab={() => setActiveTab("photos")}
          />
          <AlbumRow
            userId={userId}
            albums={albumsQuery.data?.albums}
            userAlbums={userAlbumsQuery.data?.albums}
            isOwner
          />
          <OnSaleRail data={onSaleQuery.data} isLoading={onSaleQuery.isLoading} onSeeAll={(tab) => {
              setActiveTab(tab);
              scrollToProfileTabs();
            }}
          />
        </>
      ) : null}

      {/* 내 콘텐츠: 사진 · 기록 · 분양 · 경매 · 혈통(남의 프로필과 같은 탭, 스크롤하면 헤더 아래에 붙는다) */}
      <UnderlineTabs tabs={PROFILE_TABS} active={activeTab} onChange={setActiveTab} />
      {/* 탭을 바꿔도 위에 붙은 탭 줄이 내려가지 않게 내용은 최소한 화면 남은 높이(헤더 56 · 탭 46 · 하단 탭바 56)만큼 차지한다. */}
      <div className="min-h-[calc(100dvh-158px-env(safe-area-inset-bottom))]">{activityContent}</div>
      <ProfilePinSheet post={pinTarget} onClose={() => setPinTarget(null)} />

      {/* 개발자 도구 (테스트 계정·관리자 전용) */}
      {showDevTools ? (
        <>
          <SectionGap />
          <button
            type="button"
            aria-expanded={devOpen}
            onClick={() => setDevOpen((prev) => !prev)}
            className="flex min-h-[48px] w-full items-center gap-3 px-4 text-left"
          >
            <span className="flex-1 text-[15px] text-app-muted">개발자 도구</span>
            <LineIcon name={devOpen ? "chevron-down" : "chevron-right"} size={18} className="text-app-caption" />
          </button>
          {devOpen ? (
            <div className="pb-2">
              {canSwitchTestAccount ? (
                <div>
                  <DevNote text="다른 FAKE_USER 전환" />
                  {fakeUsersLoading ? <DevNote text="목록을 불러오는 중..." /> : null}
                  {fakeUsersError ? <DevNote text={fakeUsersError} /> : null}
                  {!fakeUsersLoading && !fakeUserListForSwitch.length ? (
                    <DevNote text="전환 가능한 FAKE_USER가 없습니다." />
                  ) : null}
                  {fakeUserListForSwitch.map((account) => (
                    <DevRow
                      key={account.id}
                      label={account.name}
                      caption={switchingFakeUserId === account.id ? "전환 중..." : account.provider}
                      disabled={switchingFakeUserId === account.id}
                      onClick={() => void handleSwitchToFakeUser(account.id)}
                    />
                  ))}
                </div>
              ) : null}
              {isAdmin ? (
                <div>
                  <DevNote text={`관리자 · 현재 로그인 ${providerLabel}`} />
                  <DevRow label="관리자 페이지로 이동" href="/admin" />
                  <DevRow
                    label={switchingGoogle ? "구글 계정 전환 중..." : "구글 계정으로 전환"}
                    disabled={switchingGoogle}
                    onClick={() => void handleSwitchToGoogle()}
                  />
                  <DevRow label="카카오 로그인으로 전환" href="/auth/login?next=%2FmyPage" />
                </div>
              ) : null}
              {switchMessage ? <DevNote text={switchMessage} /> : null}
              {switchError ? <DevNote text={switchError} /> : null}
            </div>
          ) : null}
        </>
      ) : null}

    </div>
  );
};

export default MyPageClient;
