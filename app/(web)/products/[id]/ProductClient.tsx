"use client";
import Layout from "@components/features/MainLayout";
import { cn, makeImageUrl } from "@libs/client/utils";
import useMutation from "hooks/useMutation";
import useUser from "hooks/useUser";
import Image from "@components/atoms/Image";
import MarkdownPreview from "@components/features/product/MarkdownPreview";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ItemDetailResponse } from "pages/api/products/[id]";
import { useEffect, useState } from "react";
import useSWR, { useSWRConfig } from "swr";

import { ChatResponseType } from "pages/api/chat";
import { toast } from "react-toastify";
import useConfirmDialog from "hooks/useConfirmDialog";
import { ANALYTICS_EVENTS, trackEvent } from "@libs/client/analytics";
import { extractProductId, getProductPath } from "@libs/product-route";

const DETAIL_FALLBACK_IMAGE = "/images/placeholders/detail-fallback-white.svg";

/**
 * 상품 상세 페이지의 클라이언트 컴포넌트
 * @param product - 상품 상세 정보
 * @param relatedProducts - 연관 상품 목록
 */
const ProductClient = ({ product, relatedProducts }: ItemDetailResponse) => {
  // 이미지 슬라이더 상태 관리
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const query = useParams();

  // 채팅방 생성 API 호출
  const [getChatRoomId] = useMutation<ChatResponseType>(`/api/chat`);
  const { user } = useUser();
  const router = useRouter();
  const params = useParams();
  const { mutate } = useSWRConfig();

  // 상품 상세 정보 데이터 페칭
  const { data, mutate: boundMutate } = useSWR<ItemDetailResponse>(
    query?.id ? `/api/products/${extractProductId(query.id as string)}` : null
  );

  // 관심 상품 등록/취소 API 호출
  const [toggleFav, { loading: favLoading }] = useMutation(
    query?.id ? `/api/products/${extractProductId(query?.id as string)}/fav` : ""
  );

  // 터치 이벤트 상태 관리
  const [touchStart, setTouchStart] = useState(0);
  const [touchEnd, setTouchEnd] = useState(0);

  // 상품 삭제 API 호출
  const [deleteProduct, { loading: deleteLoading }] = useMutation(
    `/api/products/${extractProductId(params?.id as string)}`
  );

  // 상태 변경 API
  const [updateStatus, { loading: statusLoading }] = useMutation(
    `/api/products/${extractProductId(params?.id as string)}`
  );

  // 상태 드롭다운 표시 여부
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const { confirm, confirmDialog } = useConfirmDialog();

  /**
   * 터치 시작 이벤트 핸들러
   * @param e - 터치 이벤트 객체
   */
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.targetTouches[0].clientX);
  };

  /**
   * 터치 이동 이벤트 핸들러
   * @param e - 터치 이벤트 객체
   */
  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  /**
   * 터치 종료 이벤트 핸들러
   * 이미지 슬라이드 방향 결정 및 처리
   */
  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return;

    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > 50;
    const isRightSwipe = distance < -50;

    if (isLeftSwipe) {
      nextImage();
    }
    if (isRightSwipe) {
      prevImage();
    }
  };

  /**
   * 관심 상품 등록/취소 핸들러
   */
  const onFavClick = () => {
    trackEvent(ANALYTICS_EVENTS.productFavoriteClicked, {
      product_id: product?.id || null,
      seller_id: product?.user?.id || null,
      user_id: user?.id || null,
      action: isLiked ? "unfavorite" : "favorite",
      requires_login: !user,
    });

    if (!user) {
      return router.push("/auth/login");
    }
    if (favLoading) return;

    // 낙관적 UI 업데이트
    boundMutate((prev) => prev && { ...prev, isLiked: !prev.isLiked }, false);

    toggleFav({
      data: {},
      onCompleted(result) {
        if (!result.success) {
          trackEvent(ANALYTICS_EVENTS.productFavoriteFailed, {
            product_id: product?.id || null,
            user_id: user?.id || null,
            error: result.error || "favorite_toggle_failed",
          });
          // 실패 시 롤백
          boundMutate();
          toast.error("관심목록 처리에 실패했습니다.");
        }
      },
      onError() {
        trackEvent(ANALYTICS_EVENTS.productFavoriteFailed, {
          product_id: product?.id || null,
          user_id: user?.id || null,
          error: "network_error",
        });
        // 에러 시 롤백
        boundMutate();
        toast.error("오류가 발생했습니다. 다시 시도해주세요.");
      },
    });
  };

  /**
   * 다음 이미지로 이동
   */
  const nextImage = () => {
    if (!product?.photos?.length) return;
    setCurrentImageIndex((prev) =>
      prev === product.photos.length - 1 ? 0 : prev + 1
    );
  };

  /**
   * 이전 이미지로 이동
   */
  const prevImage = () => {
    if (!product?.photos?.length) return;
    setCurrentImageIndex((prev) =>
      prev === 0 ? product.photos.length - 1 : prev - 1
    );
  };

  /**
   * 판매자와 채팅 시작 핸들러
   */
  const onContactClick = () => {
    trackEvent(ANALYTICS_EVENTS.productChatClicked, {
      product_id: product?.id || null,
      seller_id: product?.user?.id || null,
      user_id: user?.id || null,
      requires_login: !user,
    });

    if (!user) {
      return router.push("/auth/login");
    }

    if (!product || !user) return;

    getChatRoomId({
      data: {
        otherId: product.user.id,
      },
      onCompleted: (result) => {
        if (result.success && result.ChatRoomId) {
          trackEvent(ANALYTICS_EVENTS.productChatRoomCreated, {
            product_id: product?.id || null,
            chat_room_id: result.ChatRoomId,
            user_id: user?.id || null,
          });
          router.push(`/chat/${result.ChatRoomId}`);
        } else {
          trackEvent(ANALYTICS_EVENTS.productChatRoomCreateFailed, {
            product_id: product?.id || null,
            user_id: user?.id || null,
            error: result.error || "chat_room_create_failed",
          });
          toast.error(result.error || "채팅방 생성에 실패했습니다.");
        }
      },
      onError: (error) => {
        trackEvent(ANALYTICS_EVENTS.productChatRoomCreateFailed, {
          product_id: product?.id || null,
          user_id: user?.id || null,
          error: error instanceof Error ? error.message : "unknown_error",
        });
        console.error("Error in onContactClick:", error);
        toast.error("오류가 발생했습니다.");
      },
    });
  };

  // 상품 삭제 핸들러
  const handleDelete = async () => {
    if (deleteLoading) return;
    const confirmed = await confirm({
      title: "이 상품을 삭제할까요?",
      description: "삭제 후에는 복구할 수 없습니다.",
      confirmText: "삭제",
      tone: "danger",
    });
    if (!confirmed) return;

    try {
      await deleteProduct({
        data: {
          action: "delete",
        },
      });
      trackEvent(ANALYTICS_EVENTS.productDeleted, {
        product_id: product?.id || null,
        user_id: user?.id || null,
      });
      toast.success("상품이 삭제되었습니다.");
      router.push("/");
    } catch (error) {
      toast.error("상품 삭제에 실패했습니다.");
    }
  };

  /** 판매 상태 변경 (판매중/예약중) */
  const handleStatusChange = async (newStatus: string) => {
    setShowStatusMenu(false);
    const confirmed = await confirm({
      title: `상태를 "${newStatus}"(으)로 변경할까요?`,
      description: "변경 후에도 다시 상태를 조정할 수 있습니다.",
      confirmText: "변경",
    });
    if (!confirmed) return;

    await updateStatus({
      data: { action: "status_change", data: { status: newStatus } },
      onCompleted() {
        trackEvent(ANALYTICS_EVENTS.productStatusChanged, {
          product_id: product?.id || null,
          user_id: user?.id || null,
          next_status: newStatus,
        });
        boundMutate();
        toast.success(`상태가 "${newStatus}"으로 변경되었습니다.`);
      },
    });
  };

  /** 판매완료 처리 */
  const handleSold = async () => {
    setShowStatusMenu(false);
    const confirmed = await confirm({
      title: "판매완료로 변경할까요?",
      description: "판매내역에 기록됩니다.",
      confirmText: "판매완료",
    });
    if (!confirmed) return;

    await updateStatus({
      data: { action: "sold" },
      onCompleted() {
        trackEvent(ANALYTICS_EVENTS.productMarkedSold, {
          product_id: product?.id || null,
          user_id: user?.id || null,
        });
        boundMutate();
        toast.success("판매완료 처리되었습니다.");
      },
    });
  };

  /** 구매확정 */
  const handlePurchase = async () => {
    const confirmed = await confirm({
      title: "구매확정 할까요?",
      description: "구매내역에 기록됩니다.",
      confirmText: "구매확정",
    });
    if (!confirmed) return;

    await updateStatus({
      data: { action: "purchase" },
      onCompleted() {
        trackEvent(ANALYTICS_EVENTS.productPurchaseConfirmed, {
          product_id: product?.id || null,
          user_id: user?.id || null,
          seller_id: product?.user?.id || null,
        });
        boundMutate();
        toast.success("구매확정 되었습니다.");
      },
    });
  };

  const isLiked = data?.isLiked || false;
  const currentStatus = data?.product?.status || product?.status || "판매중";
  const isOwner = user?.id === product?.user?.id;
  const hasPurchased = data?.hasPurchased || false;
  const mainImageSrc =
    product?.photos && product.photos.length > 0
      ? makeImageUrl(product.photos[currentImageIndex], "public")
      : DETAIL_FALLBACK_IMAGE;

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
  }, [
    product?.id,
    product?.name,
    product?.category,
    product?.price,
    product?.user?.id,
    product?.photos?.length,
    user?.id,
  ]);

  return (
    <Layout
      seoTitle={product?.name || "상세 정보"}
      title={product?.name || "상세 정보"}
      canGoBack
    >
      <div className="pb-24">
        <div className="bg-white">
          {/* 상품 이미지 섹션 */}
          <div
            className="group relative aspect-[4/3] bg-slate-100"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            <Image
              src={mainImageSrc}
              fallbackSrc={DETAIL_FALLBACK_IMAGE}
              className="object-cover"
              alt={`상품 이미지 ${currentImageIndex + 1}`}
              fill={true}
              sizes="600px"
              priority={true}
              quality={100}
            />
            {/* 이미지 네비게이션 버튼 */}
            {product?.photos && product.photos.length > 1 && (
              <>
                <button
                  onClick={prevImage}
                  className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/35 p-2 text-white transition-all hover:bg-black/55 opacity-0 group-hover:opacity-100"
                  aria-label="이전 이미지"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 19l-7-7 7-7"
                    />
                  </svg>
                </button>
                <button
                  onClick={nextImage}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/35 p-2 text-white transition-all hover:bg-black/55 opacity-0 group-hover:opacity-100"
                  aria-label="다음 이미지"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </button>
                {/* 이미지 인디케이터 */}
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                  {product.photos.map((_, index) => (
                    <button
                      key={index}
                      onClick={() => setCurrentImageIndex(index)}
                      className={cn(
                        "w-2 h-2 rounded-full transition-all",
                        currentImageIndex === index
                          ? "bg-white dark:bg-white"
                          : "bg-white/50 dark:bg-white/50"
                      )}
                      aria-label={`${index + 1}번 이미지로 이동`}
                    />
                  ))}
                </div>
              </>
            )}
          </div>

          {/* 상품 정보 섹션 */}
          <div className="px-4 py-4">
            {/* 판매자 정보 */}
            <Link
              href={`/profiles/${product?.user?.id}`}
              className="group mb-4 flex items-center space-x-3 border-b border-slate-100 dark:border-slate-800 pb-4"
            >
              {product?.user?.avatar ? (
                <Image
                  src={makeImageUrl(product.user.avatar, "avatar")}
                  className="h-10 w-10 rounded-full object-cover ring-1 ring-slate-200 transition-all group-hover:ring-slate-300"
                  width={40}
                  height={40}
                  alt="avatar"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-gray-200" />
              )}
              <div>
                <p className="font-medium text-gray-900 dark:text-slate-100 group-hover:text-primary transition-colors">
                  {product?.user?.name}
                </p>
                <p className="text-xs text-gray-500">프로필 보기</p>
              </div>
            </Link>

            {/* 상품 상세 정보 */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-semibold text-gray-900 dark:text-slate-100 tracking-tight">
                    {product?.name}
                  </h1>
                  <span
                    className={cn(
                      "inline-flex h-6 shrink-0 items-center whitespace-nowrap rounded-md px-2 text-xs font-medium leading-none",
                      currentStatus === "판매중"
                        ? "bg-green-100 text-green-700"
                        : currentStatus === "예약중"
                        ? "bg-yellow-100 text-yellow-700"
                        : "bg-gray-200 text-gray-500"
                    )}
                  >
                    {currentStatus}
                  </span>
                </div>
              </div>

              {/* 가격 정보 */}
              <div className="flex items-baseline space-x-2">
                <p className="text-2xl font-bold text-primary tracking-tight">
                  {product?.price?.toLocaleString()}원
                </p>
              </div>

              {/* 상품 설명 */}
              <div className="border-t border-slate-100 dark:border-slate-800 pt-4">
                <MarkdownPreview
                  content={data?.product?.description ?? product?.description ?? ""}
                  emptyText="상품 설명이 없습니다."
                />
              </div>

              {/* 액션 버튼 영역 */}
              <div className="space-y-3 border-t border-slate-100 dark:border-slate-800 pt-4">
                {isOwner ? (
                  <>
                    {/* 판매자 전용: 상태 변경 드롭다운 */}
                    <div className="relative">
                      <button
                        onClick={() => setShowStatusMenu(!showStatusMenu)}
                        disabled={statusLoading}
                        className={cn(
                          "flex w-full items-center justify-center gap-2 rounded-md border py-3 font-medium transition-colors",
                          currentStatus === "판매완료"
                            ? "cursor-not-allowed border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-400"
                            : "border-slate-900 bg-slate-900 text-white hover:bg-slate-800"
                        )}
                      >
                        {statusLoading
                          ? "처리 중..."
                          : currentStatus === "판매완료"
                          ? "판매완료"
                          : "상태 변경"}
                        {currentStatus !== "판매완료" && (
                          <svg
                            className={cn(
                              "w-4 h-4 transition-transform",
                              showStatusMenu && "rotate-180"
                            )}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 9l-7 7-7-7"
                            />
                          </svg>
                        )}
                      </button>
                      {showStatusMenu && currentStatus !== "판매완료" && (
                        <div className="absolute left-0 right-0 top-full z-10 mt-1 overflow-hidden rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm">
                          {currentStatus !== "판매중" && (
                            <button
                              onClick={() => handleStatusChange("판매중")}
                              className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm hover:bg-slate-50"
                            >
                              <span className="w-2 h-2 rounded-full bg-green-500" />
                              판매중으로 변경
                            </button>
                          )}
                          {currentStatus !== "예약중" && (
                            <button
                              onClick={() => handleStatusChange("예약중")}
                              className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm hover:bg-slate-50"
                            >
                              <span className="w-2 h-2 rounded-full bg-yellow-500" />
                              예약중으로 변경
                            </button>
                          )}
                          <button
                            onClick={handleSold}
                            className="flex w-full items-center gap-2 border-t border-slate-100 dark:border-slate-800 px-4 py-3 text-left text-sm hover:bg-slate-50"
                          >
                            <span className="w-2 h-2 rounded-full bg-gray-400" />
                            판매완료로 변경
                          </button>
                        </div>
                      )}
                    </div>

                    {/* 판매자 전용: 수정/삭제 */}
                    <div className="flex space-x-2">
                      <Link
                        href={`/products/${extractProductId(params?.id as string)}/edit`}
                        className="flex-1 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 py-3 text-center text-sm font-medium text-slate-700 dark:text-slate-300 transition-colors hover:bg-slate-50"
                      >
                        수정하기
                      </Link>
                      <button
                        onClick={handleDelete}
                        disabled={deleteLoading}
                        className="flex-1 rounded-md border border-red-200 bg-white dark:bg-slate-900 py-3 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
                      >
                        {deleteLoading ? "삭제 중..." : "삭제하기"}
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    {/* 구매자: 채팅 + 찜 + 구매확정 */}
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={onContactClick}
                        className="h-10 flex-1 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 text-sm font-semibold text-slate-700 dark:text-slate-300 transition-colors hover:bg-slate-50"
                      >
                        판매자와 채팅하기
                      </button>
                      <button
                        onClick={onFavClick}
                        data-testid="favorite-toggle"
                        aria-label={isLiked ? "찜 취소" : "찜 추가"}
                        className={cn(
                          "flex h-10 w-10 items-center justify-center rounded-md border border-slate-200",
                          isLiked
                            ? "text-red-500 hover:bg-red-50"
                            : "text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800"
                        )}
                      >
                        {isLiked ? (
                          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                            <path
                              fillRule="evenodd"
                              d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z"
                              clipRule="evenodd"
                            />
                          </svg>
                        ) : (
                          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="2"
                              d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                            />
                          </svg>
                        )}
                      </button>
                    </div>

                    {/* 판매완료 상품에 대한 구매확정 버튼 */}
                    {currentStatus === "판매완료" && !hasPurchased && (
                      <button
                        onClick={handlePurchase}
                        disabled={statusLoading}
                        className="h-10 w-full rounded-md border border-primary/30 bg-primary/10 text-sm font-semibold text-primary transition-colors hover:bg-primary/15 disabled:opacity-50"
                      >
                        {statusLoading ? "처리 중..." : "구매확정"}
                      </button>
                    )}
                    {currentStatus === "판매완료" && hasPurchased && (
                      <div className="h-10 w-full rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 text-center text-sm font-medium leading-10 text-slate-500">
                        구매확정 완료
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 연관 상품 섹션 */}
        {relatedProducts && relatedProducts.length > 0 && (
          <div className="mt-8 border-t border-slate-100 dark:border-slate-800 px-4 pt-6">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">
              연관 상품
            </h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {relatedProducts.map((product) => (
                <Link
                  key={product.id}
                  href={getProductPath(product.id, product.name)}
                  className="group focus:outline-none"
                >
                  <div className="relative aspect-square overflow-hidden bg-slate-100">
                    {/** 연관 상품도 이미지 누락/오류 시 동일한 기본 이미지를 사용한다. */}
                    <Image
                      src={
                        product.photos?.[0]
                          ? makeImageUrl(product.photos[0], "product")
                          : DETAIL_FALLBACK_IMAGE
                      }
                      fallbackSrc={DETAIL_FALLBACK_IMAGE}
                      alt={product.name}
                      fill={true}
                      sizes="100%"
                      className="object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  </div>
                  <div className="mt-2">
                    <h3 className="truncate text-sm font-medium text-gray-900 dark:text-slate-100 group-hover:text-primary transition-colors">
                      {product.name}
                    </h3>
                    <p className="text-primary font-medium text-sm">
                      {product.price?.toLocaleString()}원
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
      {confirmDialog}
    </Layout>
  );
};

export default ProductClient;
