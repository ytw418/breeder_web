"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import useSWR, { useSWRConfig } from "swr";

import Layout from "@components/features/MainLayout";
import Image from "@components/atoms/Image";
import MarkdownPreview from "@components/features/product/MarkdownPreview";
import ImageLightbox from "@components/features/image/ImageLightbox";
import { ActionSheet, type ActionSheetAction } from "@components/app/ActionSheet";
import { HeaderIconButton } from "@components/app/HeaderIconButton";
import { ImageCarousel } from "@components/app/ImageCarousel";
import { ReportSheet } from "@components/app/moderation/ReportSheet";
import { BlockConfirmDialog } from "@components/app/moderation/BlockConfirmDialog";
import { BloodlineLinkRow } from "@components/features/bloodline/BloodlineLinkRow";
import { ItemDetailResponse } from "pages/api/products/[id]";
import useUser from "hooks/useUser";
import useBlocks from "hooks/useBlocks";
import useConfirmDialog from "hooks/useConfirmDialog";
import { toast } from "@libs/client/toast";
import { authFetch } from "@libs/client/authFetch";
import { shareOrCopy, copyText, absoluteUrl } from "@libs/client/share";
import { makeImageUrl } from "@libs/client/utils";
import { ANALYTICS_EVENTS, trackEvent } from "@libs/client/analytics";
import { extractProductId, getProductPath } from "@libs/product-route";
import { formatProductPrice } from "@libs/productRules";

type ProductActionPayload =
  | { action: "purchase" }
  | { action: "delete" }
  | { action: "sold" }
  | { action: "status_change"; data: { status: "판매중" | "예약중" } };

type DetailProduct = NonNullable<ItemDetailResponse["product"]> & {
  _count?: { favs?: number };
  wishCount?: number;
};

const toLoginHref = (next: string) => `/auth/login?next=${encodeURIComponent(next)}`;

/** 상세 메타의 날짜(앱 formatMonthDay): "10월 6일" */
export function formatMonthDay(value: string | Date | null | undefined): string {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getMonth() + 1}월 ${date.getDate()}일`;
}

const successMessage = (payload: ProductActionPayload) => {
  switch (payload.action) {
    case "purchase":
      return "구매확정 되었습니다.";
    case "sold":
      return "판매완료 처리되었습니다.";
    case "status_change":
      return `상태가 "${payload.data.status}"으로 변경되었습니다.`;
    case "delete":
      return "상품이 삭제되었습니다.";
  }
};

function ChevronRight({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 5l7 7-7 7" />
    </svg>
  );
}

function ImagePlaceholderIcon({ className }: { className: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
        d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
      />
    </svg>
  );
}

/**
 * 상품 상세(앱 src/app/products/[id].tsx).
 * 헤더 ⋮ 시트(공유·링크 복사 / 소유자 수정·삭제 / 그 외 신고·판매자 차단), 사진 캐러셀 + 라이트박스,
 * 판매자 행, 혈통 행(붙인 혈통이 있을 때), "조회 N · 찜 N", 소유자 관리 블록, 하단 고정 바(찜·가격·채팅하기), 연관 상품.
 * SSR 은 비로그인 조회라 삭제·숨김 상품은 product 없이 오고, 소유자 토큰으로 다시 받아 안내만 보인다.
 */
const ProductClient = ({ product: initialProduct, relatedProducts: initialRelated }: ItemDetailResponse) => {
  const router = useRouter();
  const params = useParams();
  const productId = extractProductId(params?.id as string);
  const detailKey = productId ? `/api/products/${productId}` : null;
  const { user, isLoading: isUserLoading } = useUser();
  const { mutate: globalMutate } = useSWRConfig();
  const { isBlocked, unblock, isPending: blockPending } = useBlocks();
  const { confirm, confirmDialog } = useConfirmDialog();

  const { data, error, isLoading, mutate } = useSWR<ItemDetailResponse>(detailKey, {
    revalidateOnFocus: false,
  });

  const [imageIndex, setImageIndex] = useState(0);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [blockTarget, setBlockTarget] = useState<{ id: number; name: string } | null>(null);
  const [actionPending, setActionPending] = useState(false);
  const [favPending, setFavPending] = useState(false);
  const [chatPending, setChatPending] = useState(false);

  const product = (data?.product ?? initialProduct) as DetailProduct | undefined;
  const relatedProducts = data?.relatedProducts ?? initialRelated ?? [];
  const isLiked = Boolean(data?.isLiked);
  const hasPurchased = Boolean(data?.hasPurchased);
  const currentStatus = product?.status || "판매중";
  const isOwner = Boolean(user?.id && product?.user?.id === user.id);
  // 삭제·숨김 상품은 소유자에게만 내려온다. 안내만 보이고 관리 동선(수정·삭제·상태 변경)은 숨긴다.
  const isInactive = Boolean(product?.isDeleted || product?.isHidden);
  const canManage = isOwner && !isInactive;
  const sellerId = product?.user?.id;
  const sellerBlocked = Boolean(sellerId && !isOwner && isBlocked(sellerId));
  const photos = product?.photos?.length ? product.photos : [];
  const productPath = product ? getProductPath(product.id, product.name) : `/products/${productId}`;
  const wishCount = product?._count?.favs ?? product?.wishCount ?? 0;

  useEffect(() => {
    setImageIndex((prev) => Math.min(prev, Math.max(photos.length - 1, 0)));
  }, [photos.length]);

  useEffect(() => {
    if (!product?.id) return;
    trackEvent(ANALYTICS_EVENTS.productDetailViewed, {
      product_id: product.id,
      product_name: product.name,
      product_category: product.category,
      product_price: product.price,
      seller_id: product.user?.id || null,
      user_id: user?.id || null,
      photo_count: product.photos?.length || 0,
    });
  }, [product?.id, user?.id]);

  // 판매자가 아닌 사람이 상세를 열면 조회 수를 한 번 올린다. 로그인 확인이 끝난 뒤 판단해 본인 조회는 보내지 않는다.
  // 상세는 기록 전에 받아 와서 화면 조회수가 1 적으므로 서버가 돌려준 값으로 맞춘다.
  const viewedProductIdRef = useRef<number | null>(null);
  useEffect(() => {
    if (!product?.id || isUserLoading || isInactive || viewedProductIdRef.current === product.id) return;
    viewedProductIdRef.current = product.id;
    if (user?.id && user.id === product.user?.id) return;
    authFetch(`/api/products/${product.id}/view`, { method: "POST" })
      .then((res) => res.json())
      .then((res: { counted?: boolean; viewCount?: number }) => {
        const viewCount = res?.viewCount;
        if (!res?.counted || typeof viewCount !== "number") return;
        void mutate(
          (prev) =>
            prev?.product ? { ...prev, product: { ...prev.product, viewCount } } : prev,
          { revalidate: false }
        );
      })
      .catch(() => undefined);
  }, [product?.id, product?.user?.id, user?.id, isUserLoading, isInactive, mutate]);

  const requireLogin = () => {
    if (user) return false;
    router.push(toLoginHref(productPath));
    return true;
  };

  const goBackToList = () => {
    if (window.history.length > 1) router.back();
    else router.replace("/");
  };

  const refreshLists = () =>
    globalMutate(
      (key) => typeof key === "string" && /^(\$inf\$)?\/api\/(products|users\/)/.test(key)
    );

  const runAction = async (payload: ProductActionPayload) => {
    if (actionPending) return;
    setActionPending(true);
    try {
      const res = await authFetch(`/api/products/${productId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await res.json().catch(() => null)) as {
        success?: boolean;
        error?: string;
        message?: string;
      } | null;
      if (!res.ok || !result?.success) {
        toast.error(
          result?.error ||
            result?.message ||
            (payload.action === "delete" ? "상품 삭제에 실패했습니다." : "상품 처리에 실패했습니다.")
        );
        return;
      }
      trackEvent(
        payload.action === "delete"
          ? ANALYTICS_EVENTS.productDeleted
          : payload.action === "sold"
            ? ANALYTICS_EVENTS.productMarkedSold
            : payload.action === "purchase"
              ? ANALYTICS_EVENTS.productPurchaseConfirmed
              : ANALYTICS_EVENTS.productStatusChanged,
        { product_id: product?.id || null, user_id: user?.id || null }
      );
      toast.success(successMessage(payload));
      void refreshLists();
      if (payload.action === "delete") {
        goBackToList();
        return;
      }
      void mutate();
    } catch {
      toast.error(payload.action === "delete" ? "상품 삭제에 실패했습니다." : "상품 처리에 실패했습니다.");
    } finally {
      setActionPending(false);
    }
  };

  const handleDelete = async () => {
    if (actionPending) return;
    const ok = await confirm({
      title: "이 상품을 삭제할까요?",
      description: "삭제 후에는 복구할 수 없습니다.",
      confirmText: "삭제",
      tone: "danger",
    });
    if (ok) void runAction({ action: "delete" });
  };

  const handleStatusChange = async (nextStatus: "판매중" | "예약중") => {
    setShowStatusMenu(false);
    const ok = await confirm({
      title: `상태를 "${nextStatus}"(으)로 변경할까요?`,
      description: "변경 후에도 다시 상태를 조정할 수 있습니다.",
      confirmText: "변경",
    });
    if (ok) void runAction({ action: "status_change", data: { status: nextStatus } });
  };

  const handleSold = async () => {
    setShowStatusMenu(false);
    const ok = await confirm({
      title: "판매완료로 변경할까요?",
      description: "판매내역에 기록됩니다.",
      confirmText: "판매완료",
    });
    if (ok) void runAction({ action: "sold" });
  };

  const handlePurchase = async () => {
    if (requireLogin() || actionPending) return;
    const ok = await confirm({
      title: "구매확정 할까요?",
      description: "구매내역에 기록됩니다.",
      confirmText: "구매확정",
    });
    if (ok) void runAction({ action: "purchase" });
  };

  const handleFavorite = async () => {
    trackEvent(ANALYTICS_EVENTS.productFavoriteClicked, {
      product_id: product?.id || null,
      seller_id: product?.user?.id || null,
      user_id: user?.id || null,
      action: isLiked ? "unfavorite" : "favorite",
      requires_login: !user,
    });
    if (requireLogin() || favPending || !product) return;
    setFavPending(true);
    const nextLiked = !isLiked;
    const nextCount = Math.max(0, wishCount + (nextLiked ? 1 : -1));
    // 낙관적 반영(찜 상태·찜 수). 실패하면 다시 받는다.
    void mutate(
      (prev) =>
        prev?.product
          ? {
              ...prev,
              isLiked: nextLiked,
              product: {
                ...prev.product,
                _count: { favs: nextCount },
              } as DetailProduct,
            }
          : prev,
      { revalidate: false }
    );
    try {
      const res = await authFetch(`/api/products/${product.id}/fav`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const result = (await res.json().catch(() => null)) as { success?: boolean } | null;
      if (!res.ok || !result?.success) {
        trackEvent(ANALYTICS_EVENTS.productFavoriteFailed, {
          product_id: product.id,
          user_id: user?.id || null,
          error: "favorite_toggle_failed",
        });
        toast.error("관심목록 처리에 실패했습니다.");
      }
    } catch {
      toast.error("오류가 발생했습니다. 다시 시도해주세요.");
    } finally {
      setFavPending(false);
      void mutate();
      void refreshLists();
    }
  };

  const handleChat = async () => {
    trackEvent(ANALYTICS_EVENTS.productChatClicked, {
      product_id: product?.id || null,
      seller_id: product?.user?.id || null,
      user_id: user?.id || null,
      requires_login: !user,
    });
    if (requireLogin() || chatPending || !product) return;
    if (user?.id === product.user?.id) {
      toast.error("자기 자신과는 채팅할 수 없습니다.");
      return;
    }
    setChatPending(true);
    try {
      const res = await authFetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ otherId: product.user.id }),
      });
      const result = (await res.json().catch(() => null)) as {
        success?: boolean;
        ChatRoomId?: number;
        error?: string;
        message?: string;
      } | null;
      if (res.ok && result?.success && result.ChatRoomId) {
        trackEvent(ANALYTICS_EVENTS.productChatRoomCreated, {
          product_id: product.id,
          chat_room_id: result.ChatRoomId,
          user_id: user?.id || null,
        });
        router.push(`/chat/${result.ChatRoomId}`);
        return;
      }
      trackEvent(ANALYTICS_EVENTS.productChatRoomCreateFailed, {
        product_id: product.id,
        user_id: user?.id || null,
        error: result?.error || "chat_room_create_failed",
      });
      // 차단·탈퇴 상대(403 CHAT_BLOCKED / CHAT_PARTNER_DELETED)는 서버 문구를 그대로 보인다.
      toast.error(result?.error || result?.message || "채팅방 생성에 실패했습니다.");
    } catch {
      toast.error("오류가 발생했습니다.");
    } finally {
      setChatPending(false);
    }
  };

  // ── 로딩·오류 ─────────────────────────────────────────────────────────
  if (!product) {
    const status = (error as { status?: number } | undefined)?.status;
    const message =
      status === 404 && error instanceof Error ? error.message : "상품을 불러올 수 없습니다.";
    return (
      <Layout canGoBack title="상품 상세" headerRight={<></>}>
        <div className="flex min-h-[60vh] items-center justify-center px-6">
          {isLoading || (!error && !data) ? (
            <span
              role="status"
              aria-label="불러오는 중"
              className="h-6 w-6 animate-spin rounded-full border-2 border-app-border border-t-app-brand"
            />
          ) : (
            <p className="text-center text-[14px] text-app-muted">{message}</p>
          )}
        </div>
      </Layout>
    );
  }

  // ── ⋮ 시트 ────────────────────────────────────────────────────────────
  // 삭제·숨김 상품은 다른 사람이 열 수 없으므로(404) 공유·링크 복사를 두지 않는다.
  const sheetActions: ActionSheetAction[] = isInactive
    ? []
    : [
        {
          key: "share",
          label: "공유하기",
          onSelect: () => void shareOrCopy({ title: product.name, url: productPath }),
        },
        {
          key: "copy-link",
          label: "링크 복사",
          onSelect: () =>
            void copyText(absoluteUrl(productPath)).then((ok) =>
              ok ? toast.success("링크를 복사했어요") : toast.error("링크를 복사하지 못했어요")
            ),
        },
      ];
  if (canManage) {
    sheetActions.unshift({
      key: "edit",
      label: "수정하기",
      onSelect: () => {
        if (actionPending) return;
        router.push(`/products/${product.id}/edit`);
      },
    });
    sheetActions.push({
      key: "delete",
      label: "삭제하기",
      destructive: true,
      onSelect: () => void handleDelete(),
    });
  }
  if (!isOwner) {
    sheetActions.push({
      key: "report",
      label: "신고하기",
      onSelect: () => {
        if (requireLogin()) return;
        setReportOpen(true);
      },
    });
    if (!sellerBlocked) {
      sheetActions.push({
        key: "block",
        label: "판매자 차단",
        destructive: true,
        onSelect: () => {
          if (requireLogin()) return;
          setBlockTarget({ id: product.user.id, name: product.user.name });
        },
      });
    }
  }

  const headerRight =
    sheetActions.length > 0 ? (
      <HeaderIconButton label="더보기" onClick={() => setSheetOpen(true)}>
        <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="5" r="1.75" />
          <circle cx="12" cy="12" r="1.75" />
          <circle cx="12" cy="19" r="1.75" />
        </svg>
      </HeaderIconButton>
    ) : (
      <></>
    );

  const metaText = [product.category || null, product.productType || null, formatMonthDay(product.createdAt) || null]
    .filter(Boolean)
    .join(" · ");
  const photoUrls = photos.map((photo) => makeImageUrl(photo, "public"));

  return (
    <Layout canGoBack title={product.name || "상세 정보"} seoTitle={product.name} headerRight={headerRight}>
      {sellerBlocked ? (
        // 게시글 상세의 차단 게이트와 같은 레이아웃
        <div className="flex min-h-[70vh] flex-col items-center justify-center px-6 text-center">
          <p className="text-[16px] font-bold text-app-text">차단한 판매자의 상품입니다.</p>
          <p className="mt-2 text-[14px] leading-5 text-app-muted">
            이 판매자의 상품은 목록에서 숨겨집니다.
          </p>
          <div className="mt-5 flex items-center gap-2">
            <button
              type="button"
              onClick={goBackToList}
              className="h-11 rounded-md bg-app-surface px-4 text-[15px] font-semibold text-app-text"
            >
              목록으로
            </button>
            <button
              type="button"
              disabled={blockPending}
              onClick={() => void unblock(product.user.id)}
              className="h-11 rounded-md bg-app-brand px-4 text-[15px] font-semibold text-white disabled:opacity-60"
            >
              차단 해제
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="pb-[calc(96px+env(safe-area-inset-bottom))]">
            {isInactive ? (
              <div className="bg-app-surface px-4 py-3">
                <p className="text-[14px] font-semibold text-app-text">
                  {product.isDeleted ? "삭제한 상품이에요" : "숨김 처리된 상품이에요"}
                </p>
                <p className="mt-0.5 text-[13px] text-app-muted">다른 사용자에게는 보이지 않아요.</p>
              </div>
            ) : null}

            {photos.length > 0 ? (
              <ImageCarousel
                images={photos}
                index={imageIndex}
                onIndexChange={setImageIndex}
                onOpen={(i) => {
                  setImageIndex(i);
                  setViewerOpen(true);
                }}
                alt="상품 이미지"
                className="bg-app-surface"
              />
            ) : (
              <div className="flex aspect-square w-full items-center justify-center bg-app-surface text-app-caption">
                <ImagePlaceholderIcon className="h-12 w-12" />
              </div>
            )}

            {/* 판매자 */}
            <Link
              href={`/profiles/${product.user?.id}`}
              aria-label={`${product.user?.name ?? "판매자"} 프로필 보기`}
              className="flex items-center gap-3 border-b border-app-line px-4 py-3.5"
            >
              <span className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full bg-app-surface">
                {product.user?.avatar ? (
                  <Image
                    src={makeImageUrl(product.user.avatar, "avatar")}
                    alt=""
                    width={44}
                    height={44}
                    className="h-full w-full object-cover"
                  />
                ) : null}
              </span>
              <span className="min-w-0 flex-1 truncate text-[16px] font-semibold text-app-text">
                {product.user?.name}
              </span>
              <span className="text-app-caption">
                <ChevronRight />
              </span>
            </Link>

            {/* 혈통(판매자 행 바로 아래, PRD S-6). 연결이 없거나 회수·숨김된 혈통이면 행도 자리도 없다. */}
            {product.bloodline ? (
              <BloodlineLinkRow bloodline={product.bloodline} pedigreeNote={product.pedigreeNote} />
            ) : null}

            <div className="px-4 pt-4">
              <h1 className="break-keep text-[18px] font-bold text-app-text">{product.name}</h1>
              {metaText ? <p className="mt-1.5 text-[13px] text-app-muted">{metaText}</p> : null}

              <div className="mt-2.5 flex items-center gap-2">
                <p className="text-[20px] font-bold text-app-text">{formatProductPrice(product.price)}</p>
                <span className="rounded bg-app-surface px-2 py-[3px] text-[12px] font-semibold text-app-text">
                  {currentStatus}
                </span>
              </div>

              <div className="mt-5">
                <MarkdownPreview content={product.description ?? ""} emptyText="상품 설명이 없습니다." />
              </div>

              <div className="mt-5 flex items-center justify-between">
                <p className="text-[13px] text-app-muted">
                  조회 {product.viewCount ?? 0} · 찜 {wishCount}
                </p>
                {!isInactive ? (
                  <button
                    type="button"
                    aria-label="상품 공유하기"
                    onClick={() => void shareOrCopy({ title: product.name, url: productPath })}
                    className="flex h-8 items-center gap-1 rounded-2xl bg-app-surface px-3 text-[13px] font-semibold text-app-text"
                  >
                    <svg className="h-3.5 w-3.5 rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                    공유하기
                  </button>
                ) : null}
              </div>

              {canManage ? (
                <div className="mt-5 space-y-2 border-t border-app-line pt-5">
                  <button
                    type="button"
                    disabled={actionPending || currentStatus === "판매완료"}
                    onClick={() => setShowStatusMenu((v) => !v)}
                    className="flex h-12 w-full items-center justify-center gap-1.5 rounded-md bg-app-surface disabled:cursor-default"
                    style={{ opacity: actionPending ? 0.6 : 1 }}
                  >
                    <span
                      className={
                        currentStatus === "판매완료"
                          ? "text-[15px] font-semibold text-app-muted"
                          : "text-[15px] font-semibold text-app-text"
                      }
                    >
                      {actionPending ? "처리 중..." : currentStatus === "판매완료" ? "판매완료" : "상태 변경"}
                    </span>
                    {currentStatus !== "판매완료" ? (
                      <svg className="h-4 w-4 text-app-text" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                      </svg>
                    ) : null}
                  </button>

                  {showStatusMenu && currentStatus !== "판매완료" ? (
                    <div className="overflow-hidden rounded-md border border-app-border bg-app-elevated">
                      {currentStatus !== "판매중" ? (
                        <button
                          type="button"
                          onClick={() => void handleStatusChange("판매중")}
                          className="block w-full px-4 py-3.5 text-left text-[15px] text-app-text hover:bg-app-surface"
                        >
                          판매중으로 변경
                        </button>
                      ) : null}
                      {currentStatus !== "예약중" ? (
                        <button
                          type="button"
                          onClick={() => void handleStatusChange("예약중")}
                          className="block w-full border-t border-app-line px-4 py-3.5 text-left text-[15px] text-app-text hover:bg-app-surface"
                        >
                          예약중으로 변경
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => void handleSold()}
                        className="block w-full border-t border-app-line px-4 py-3.5 text-left text-[15px] text-app-text hover:bg-app-surface"
                      >
                        판매완료로 변경
                      </button>
                    </div>
                  ) : null}

                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={actionPending}
                      onClick={() => router.push(`/products/${product.id}/edit`)}
                      className="h-12 flex-1 rounded-md border border-app-border bg-app-bg text-[15px] font-semibold text-app-text disabled:opacity-60"
                    >
                      수정하기
                    </button>
                    <button
                      type="button"
                      disabled={actionPending}
                      onClick={() => void handleDelete()}
                      className="h-12 flex-1 rounded-md border border-app-border bg-app-bg text-[15px] font-semibold text-app-muted disabled:opacity-60"
                    >
                      {actionPending ? "삭제 중..." : "삭제하기"}
                    </button>
                  </div>
                </div>
              ) : !isOwner && currentStatus === "판매완료" ? (
                <div className="mt-5">
                  {hasPurchased ? (
                    <div className="flex h-12 items-center justify-center rounded-md bg-app-surface text-[15px] font-semibold text-app-muted">
                      구매확정 완료
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={actionPending}
                      onClick={() => void handlePurchase()}
                      className="h-12 w-full rounded-md bg-app-surface text-[15px] font-semibold text-app-text disabled:opacity-60"
                    >
                      {actionPending ? "처리 중..." : "구매확정"}
                    </button>
                  )}
                </div>
              ) : null}
            </div>

            {relatedProducts.length > 0 ? (
              <section className="mt-6 border-t-8 border-app-gap pt-6">
                <h2 className="mb-4 px-4 text-[17px] font-bold text-app-text">연관 상품</h2>
                {/* 앱 products/[id] 연관 상품: 2열 정사각 썸네일 그리드(이름 15 · 가격 15/700). */}
                <div className="grid grid-cols-2 gap-4 px-4">
                  {relatedProducts.slice(0, 20).map((item) => (
                    <Link key={item.id} href={getProductPath(item.id, item.name)} className="flex min-w-0 flex-col gap-1.5">
                      <div className="flex aspect-square w-full items-center justify-center overflow-hidden rounded-lg bg-app-surface">
                        {item.photos?.[0] ? (
                          <Image
                            src={makeImageUrl(item.photos[0], "product")}
                            alt={item.name}
                            width={240}
                            height={240}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="text-app-caption" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
                          </svg>
                        )}
                      </div>
                      <p className="truncate text-[15px] text-app-text">{item.name}</p>
                      <p className="text-[15px] font-bold text-app-text">{formatProductPrice(item.price)}</p>
                    </Link>
                  ))}
                </div>
              </section>
            ) : null}
          </div>

          {/* 하단 고정 바: 찜 · 가격 · 채팅하기(판매자는 ⋮ 시트나 본문 관리 블록을 쓴다) */}
          <div className="fixed inset-x-0 bottom-0 mx-auto max-w-xl z-40 border-t border-app-border bg-app-bg pb-[env(safe-area-inset-bottom)]">
            <div className="mx-auto flex max-w-xl items-center gap-3 px-4 py-2.5">
              <button
                type="button"
                data-testid="favorite-toggle"
                aria-label={isLiked ? "찜 취소" : "찜 추가"}
                aria-pressed={isLiked}
                disabled={favPending}
                onClick={() => void handleFavorite()}
                className={
                  isLiked
                    ? "flex h-12 w-12 shrink-0 items-center justify-center rounded-md border border-app-border bg-app-bg text-app-brand disabled:opacity-60"
                    : "flex h-12 w-12 shrink-0 items-center justify-center rounded-md border border-app-border bg-app-bg text-app-muted disabled:opacity-60"
                }
              >
                <svg
                  className="h-6 w-6"
                  fill={isLiked ? "currentColor" : "none"}
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="1.5"
                    d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                  />
                </svg>
              </button>
              <span className="h-6 w-px shrink-0 bg-app-border" aria-hidden="true" />
              <p className="min-w-0 flex-1 truncate text-[16px] font-bold text-app-text">
                {formatProductPrice(product.price)}
              </p>
              {!isOwner ? (
                <button
                  type="button"
                  disabled={chatPending}
                  onClick={() => void handleChat()}
                  className="h-[52px] shrink-0 rounded-md bg-app-brand px-6 text-[16px] font-semibold text-white disabled:opacity-60"
                >
                  {chatPending ? "여는 중..." : "채팅하기"}
                </button>
              ) : null}
            </div>
          </div>

          <ImageLightbox
            images={photoUrls}
            isOpen={viewerOpen}
            currentIndex={imageIndex}
            onClose={() => setViewerOpen(false)}
            onIndexChange={setImageIndex}
            altPrefix="상품 이미지"
          />
        </>
      )}

      <ActionSheet open={sheetOpen} onClose={() => setSheetOpen(false)} actions={sheetActions} />
      <ReportSheet
        open={reportOpen}
        targetType="PRODUCT"
        targetId={product.id}
        onClose={() => setReportOpen(false)}
      />
      <BlockConfirmDialog
        target={blockTarget}
        onClose={() => setBlockTarget(null)}
        onBlocked={goBackToList}
      />
      {confirmDialog}
    </Layout>
  );
};

export default ProductClient;
