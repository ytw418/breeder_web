"use client";

import { authFetch } from "@libs/client/authFetch";
import { setTokens } from "@libs/client/authToken";
import { canUseTestAccountSwitcher } from "@libs/shared/test-accounts";
import ConfirmDialog from "@components/atoms/ConfirmDialog";
import { FilterChip, FilterChipRail } from "@components/app/FilterChip";
import { BreederProgramBadgeList } from "@components/features/breeder/BreederProgramDecorators";
import { BloodlineVisualCard } from "@components/features/bloodline/BloodlineVisualCard";
import {
  EmptyBlock,
  LineIcon,
  LoadingBlock,
  MenuRow,
  ProfileAvatar,
  RetryBlock,
  SectionGap,
  SMALL_BUTTON_CLASS,
  TransactionMenu,
} from "@components/features/profile/ProfileRows";
import {
  ProfileCommentRows,
  ProfilePostRows,
  ProfileProductRows,
  useUserCommentsList,
  useUserPostsList,
  useUserProductsList,
} from "@components/features/profile/ProfileActivityLists";
import { USER_INFO } from "@libs/constants";
import useUser from "hooks/useUser";
import useMutation from "hooks/useMutation";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type {
  GuinnessSubmission,
  GuinnessSubmissionsResponse,
} from "pages/api/guinness/submissions";
import type { LoginReqBody, LoginResponseType } from "pages/api/auth/login";
import useSWR from "swr";
import type { UserResponse } from "pages/api/users/[id]";
import type { BloodlineCardItem, BloodlineCardsResponse } from "@libs/shared/bloodline-card";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import useLogout from "../../../hooks/useLogout";

type ActivityTab = "posts" | "comments" | "products" | "bloodline" | "guinness";

const TAB_META: { id: ActivityTab; name: string }[] = [
  { id: "posts", name: "게시물" },
  { id: "comments", name: "댓글" },
  { id: "products", name: "상품" },
  { id: "bloodline", name: "보유 혈통 카드" },
  { id: "guinness", name: "브리디북" },
];

const GUINNESS_STATUS_TEXT: Record<GuinnessSubmission["status"], string> = {
  pending: "심사 대기",
  approved: "승인 완료",
  rejected: "반려",
};

const LIST_ROW_CLASS =
  "flex items-start gap-3 border-b border-app-line px-4 py-3.5 transition-colors hover:bg-app-surface";

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
/* 브리디북 · 혈통 카드                                                  */
/* ------------------------------------------------------------------ */

function GuinnessSubmissionList({
  submissions,
  isLoading,
  isError,
  onRetry,
}: {
  submissions: GuinnessSubmission[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
}) {
  if (isLoading) return <LoadingBlock />;
  if (isError) {
    return (
      <RetryBlock
        message="브리디북 신청 내역을 불러오지 못했습니다. 잠시 후 다시 시도해주세요."
        onRetry={onRetry}
      />
    );
  }
  if (!submissions.length) {
    return (
      <EmptyBlock
        title="체장 기록 신청 내역이 없습니다"
        description="체장 기록을 신청해 공식 인증을 받아보세요."
        action={
          <Link
            href="/guinness/apply"
            className="mt-3 inline-flex h-10 items-center rounded-md bg-app-surface px-3.5 text-[14px] font-semibold text-app-text"
          >
            브리디북 등록하기
          </Link>
        }
      />
    );
  }
  return (
    <div>
      {submissions.map((submission) => (
        <Link
          key={submission.id}
          href={submission.status === "approved" ? "/guinness" : "/guinness/apply"}
          className={LIST_ROW_CLASS}
        >
          <div className="min-w-0 flex-1">
            <p className="truncate text-[16px] font-semibold text-app-text">
              {submission.species} · 체장 {submission.value}mm
            </p>
            <p className="mt-1 text-[13px] text-app-muted">
              {new Date(submission.submittedAt).toLocaleDateString("ko-KR")} ·{" "}
              {GUINNESS_STATUS_TEXT[submission.status]}
            </p>
            {submission.reviewMemo ? (
              <p className="mt-1.5 text-[14px] text-app-muted">심사 메모: {submission.reviewMemo}</p>
            ) : null}
          </div>
          <LineIcon name="chevron-right" size={18} className="mt-0.5 text-app-caption" />
        </Link>
      ))}
    </div>
  );
}

function BloodlineCardPreview({ card, kind }: { card: BloodlineCardItem; kind: "created" | "received" }) {
  const subtitle = card.description || card.speciesType || "설명이 아직 등록되지 않았습니다.";
  return (
    <Link href={`/bloodline-management/card/${card.id}`} className="block">
      <BloodlineVisualCard
        cardId={card.id}
        name={card.name}
        ownerName={card.currentOwner.name}
        subtitle={subtitle}
        image={card.image}
        variant={card.visualStyle ?? "noir"}
        typeLabel={card.cardType === "LINE" ? "라인" : "혈통"}
        issuedAt={card.createdAt}
        compact
      />
      {kind === "received" ? (
        <>
          <p className="mt-2 text-[13px] text-app-muted">
            제작자 {card.creator.name} · 전달 {card.transfers?.length || 0}건
          </p>
          {card.transfers?.length ? (
            <div className="mt-1.5 space-y-1">
              {card.transfers.map((transfer) => (
                <p key={transfer.id} className="text-[13px] text-app-muted">
                  {new Date(transfer.createdAt).toLocaleDateString("ko-KR")} ·{" "}
                  {transfer.fromUser ? transfer.fromUser.name : "시스템"} → {transfer.toUser.name}
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
  cards,
  kind,
  emptyText,
}: {
  title: string;
  cards: BloodlineCardItem[];
  kind: "created" | "received";
  emptyText: string;
}) {
  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <h4 className="text-[14px] font-bold text-app-text">{title}</h4>
        <span className="text-[13px] text-app-muted">{cards.length}장</span>
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
  const handleLogout = useLogout();
  const [activeTab, setActiveTab] = useState<ActivityTab>("posts");
  const [logoutOpen, setLogoutOpen] = useState(false);
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
  const guinnessQuery = useSWR<GuinnessSubmissionsResponse>(userId ? "/api/guinness/submissions" : null);
  const bloodlineQuery = useSWR<BloodlineCardsResponse>(userId ? "/api/bloodline-cards" : null);
  // 게시물·댓글·상품은 페이지로 나눠 받고 목록 끝 '더보기'로 이어 붙인다.
  const postsList = useUserPostsList(userId);
  const commentsList = useUserCommentsList(userId);
  const productsList = useUserProductsList(userId);

  const profileUser = profileQuery.data?.user;
  const profileBreederPrograms = profileUser?.breederPrograms ?? [];
  const profileName = profileUser?.name || user?.name || "";
  const profileLoading = profileQuery.isLoading;
  // 이전에 받은 값이 있으면 계속 보여 주고, 처음부터 못 받았을 때만 오류 줄을 띄운다.
  const profileFailed = Boolean(profileQuery.error) && !profileUser;

  const mySubmissions = useMemo(
    () =>
      [...(guinnessQuery.data?.submissions || [])]
        .filter((submission) => submission.recordType === "size")
        .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()),
    [guinnessQuery.data?.submissions]
  );

  const bloodlineData = bloodlineQuery.data;
  const receivedCards = useMemo(() => {
    if (!bloodlineData) return [];
    if (bloodlineData.receivedBloodlines?.length) return bloodlineData.receivedBloodlines;
    if (bloodlineData.receivedCards?.length) {
      return bloodlineData.receivedCards.filter((card) => card.cardType === "BLOODLINE");
    }
    return (bloodlineData.ownedCards || []).filter(
      (card) => card.creator.id !== userId && card.cardType === "BLOODLINE"
    );
  }, [bloodlineData, userId]);

  const myCreatedCards = useMemo(() => {
    if (!bloodlineData) return [];
    if (bloodlineData.myBloodlines?.length) return bloodlineData.myBloodlines;
    if (bloodlineData.myCreatedCards?.length) {
      return bloodlineData.myCreatedCards.filter((card) => card.cardType === "BLOODLINE");
    }
    return (bloodlineData.ownedCards || []).filter(
      (card) => card.creator.id === userId && card.cardType === "BLOODLINE"
    );
  }, [bloodlineData, userId]);

  const bloodlineCountFallback =
    (profileUser?._count?.createdBloodlineCards ?? 0) + (profileUser?._count?.ownedBloodlineCards ?? 0);

  // 프로필(_count)이나 목록을 아직 받지 못했거나 실패했으면 0 대신 '–' 로 둔다.
  const countOrDash = (profileCount: number | undefined, listLoaded: boolean, listLength: number) => {
    if (profileCount !== undefined) return profileCount;
    return listLoaded ? listLength : "–";
  };
  const tabCountMap: Record<ActivityTab, number | string> = {
    posts: countOrDash(profileUser?._count?.posts, postsList.isLoaded, postsList.items.length),
    comments: countOrDash(profileUser?._count?.Comments, commentsList.isLoaded, commentsList.items.length),
    products: countOrDash(profileUser?._count?.products, productsList.isLoaded, productsList.items.length),
    bloodline:
      bloodlineData !== undefined
        ? myCreatedCards.length + receivedCards.length || bloodlineCountFallback
        : profileUser
          ? bloodlineCountFallback
          : "–",
    guinness: guinnessQuery.data !== undefined ? mySubmissions.length : "–",
  };

  const profileStats = [
    { label: "게시물", value: profileUser?._count?.posts },
    { label: "공식 기록", value: profileUser?._count?.insectRecords },
    { label: "팔로워", value: profileUser?._count?.followers },
  ];

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
  if (activeTab === "posts") {
    activityContent = (
      <ProfilePostRows list={postsList} emptyDescription="첫 게시글을 작성해 보세요." />
    );
  } else if (activeTab === "comments") {
    activityContent = <ProfileCommentRows list={commentsList} />;
  } else if (activeTab === "products") {
    activityContent = <ProfileProductRows list={productsList} />;
  } else if (activeTab === "bloodline") {
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
            message="혈통카드 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요."
            onRetry={() => void bloodlineQuery.mutate()}
          />
        ) : null}
        {!bloodlineQuery.isLoading && bloodlineData ? (
          <>
            <BloodlineSection
              title="내가 만든 카드"
              cards={myCreatedCards}
              kind="created"
              emptyText="아직 만든 혈통카드가 없습니다."
            />
            <BloodlineSection
              title="내가 전달받은 카드"
              cards={receivedCards}
              kind="received"
              emptyText="아직 전달받은 카드가 없습니다."
            />
          </>
        ) : null}
      </div>
    );
  } else {
    activityContent = (
      <GuinnessSubmissionList
        submissions={mySubmissions}
        isLoading={guinnessQuery.isLoading}
        isError={Boolean(guinnessQuery.error) && !guinnessQuery.data}
        onRetry={() => void guinnessQuery.mutate()}
      />
    );
  }

  return (
    <div className="flex flex-col bg-app-bg pb-8">
      {/* 프로필 */}
      <div className="px-4 py-5">
        <div className="flex items-center gap-3">
          <ProfileAvatar avatar={profileUser?.avatar ?? user?.avatar} name={profileName} programs={profileBreederPrograms} />
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-[18px] font-bold text-app-text">{profileName}</h2>
            {user?.email ? <p className="mt-0.5 truncate text-[13px] text-app-muted">{user.email}</p> : null}
            {profileLoading ? (
              <div className="mt-2 h-5 w-[72px] animate-pulse rounded bg-app-surface" />
            ) : (
              <BreederProgramBadgeList className="mt-2" programs={profileBreederPrograms} />
            )}
          </div>
          <Link href="/editProfile" className={SMALL_BUTTON_CLASS}>
            프로필 수정
          </Link>
        </div>

        {profileFailed ? (
          <button
            type="button"
            onClick={() => void profileQuery.mutate()}
            className="mt-3 flex min-h-[42px] w-full items-center justify-center text-[13px] text-app-muted"
          >
            프로필 정보를 불러오지 못했어요 ·&nbsp;<span className="font-semibold text-app-text">다시 시도</span>
          </button>
        ) : (
          <div className="mt-3 flex justify-around">
            {profileStats.map((stat) => (
              <div
                key={stat.label}
                className="flex flex-col items-center"
                aria-label={profileLoading ? `${stat.label} 불러오는 중` : `${stat.label} ${stat.value ?? 0}`}
              >
                {profileLoading ? (
                  <div className="flex h-6 items-center">
                    <div className="h-4 w-7 animate-pulse rounded bg-app-surface" />
                  </div>
                ) : (
                  <span className="text-[18px] font-bold leading-6 text-app-text">{stat.value ?? 0}</span>
                )}
                <span className="mt-0.5 text-[12px] leading-4 text-app-muted">{stat.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <SectionGap />

      {/* 거래 */}
      {userId ? <TransactionMenu userId={userId} isMine /> : null}

      <SectionGap />

      {/* 기타: 설정 · 고객센터 · 로그아웃 */}
      <div className="py-1">
        <MenuRow label="설정" icon="settings" href="/settings" />
        <MenuRow label="고객센터" icon="support" href="/support" />
        <MenuRow label="로그아웃" icon="logout" chevron={false} onClick={() => setLogoutOpen(true)} />
      </div>

      <SectionGap />

      {/* 내 활동 */}
      <div className="pt-4">
        <h3 className="mb-1.5 px-4 text-[16px] font-semibold text-app-text">내 활동</h3>
        <FilterChipRail>
          {TAB_META.map((tab) => (
            <FilterChip
              key={tab.id}
              label={tab.name}
              count={tabCountMap[tab.id]}
              selected={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
            />
          ))}
        </FilterChipRail>
        <div className="mt-1.5">{activityContent}</div>
      </div>

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

      <ConfirmDialog
        open={logoutOpen}
        title="로그아웃할까요?"
        confirmText="로그아웃"
        tone="danger"
        onCancel={() => setLogoutOpen(false)}
        onConfirm={() => {
          setLogoutOpen(false);
          // 홈으로 보낸 뒤 토큰을 지운다(useLogout 이 홈으로 이동).
          void handleLogout();
        }}
      />
    </div>
  );
};

export default MyPageClient;
