"use client";
import Layout from "@components/features/MainLayout";
import { cn, makeImageUrl } from "@libs/client/utils";
import useMutation from "hooks/useMutation";
import useUser from "hooks/useUser";
import Image from "@components/atoms/Image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ItemDetailResponse } from "pages/api/products/[id]";
import { useState } from "react";
import useSWR, { useSWRConfig } from "swr";

import { ChatResponseType } from "pages/api/chat";
import { toast } from "react-toastify";

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
    query?.id ? `/api/products/${query.id}` : null
  );

  // 관심 상품 등록/취소 API 호출
  const [toggleFav, { loading: favLoading }] = useMutation(
    query?.id ? `/api/products/${query?.id}/fav` : ""
  );

  // 터치 이벤트 상태 관리
  const [touchStart, setTouchStart] = useState(0);
  const [touchEnd, setTouchEnd] = useState(0);

  // 상품 삭제 API 호출
  const [deleteProduct, { loading: deleteLoading }] = useMutation(
    `/api/products/${params?.id}`
  );

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
    if (!user) {
      return router.push("/auth/login");
    }
    if (!favLoading) toggleFav({ data: {} });
    if (!data) return;

    boundMutate((prev) => prev && { ...prev, isLiked: !prev.isLiked }, false);
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
          router.push(`/chat/${result.ChatRoomId}`);
        } else {
          toast.error(result.error || "채팅방 생성에 실패했습니다.");
        }
      },
      onError: (error) => {
        console.error("Error in onContactClick:", error);
        toast.error("오류가 발생했습니다.");
      },
    });
  };

  // 상품 삭제 핸들러
  const handleDelete = async () => {
    if (deleteLoading) return;
    if (!confirm("정말로 이 상품을 삭제하시겠습니까?")) return;

    try {
      await deleteProduct({
        data: {
          action: "delete",
        },
      });
      toast.success("상품이 삭제되었습니다.");
      router.push("/");
    } catch (error) {
      toast.error("상품 삭제에 실패했습니다.");
    }
  };

  const isLiked = data?.isLiked || false;

  return (
    <Layout
      seoTitle={product?.name || "상세 정보"}
      title={product?.name || "상세 정보"}
      hasTabBar
      canGoBack
    >
      <div className="max-w-3xl mx-auto px-4">
        {/* 상품 카드 컨테이너 */}
        <div className="bg-white rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.08)] overflow-hidden">
          {/* 상품 이미지 섹션 */}
          <div
            className="relative aspect-[4/3]"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            {product?.photos && product.photos.length > 0 ? (
              <>
                <Image
                  src={makeImageUrl(
                    product.photos[currentImageIndex],
                    "public"
                  )}
                  className="object-cover"
                  alt={`상품 이미지 ${currentImageIndex + 1}`}
                  fill={true}
                  sizes="600px"
                  priority={true}
                  quality={100}
                />
                {/* 이미지 네비게이션 버튼 */}
                {product.photos.length > 1 && (
                  <>
                    <button
                      onClick={prevImage}
                      className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/30 text-white p-2 rounded-full hover:bg-black/50 transition-all opacity-0 group-hover:opacity-100"
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
                      className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/30 text-white p-2 rounded-full hover:bg-black/50 transition-all opacity-0 group-hover:opacity-100"
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
                              ? "bg-white"
                              : "bg-white/50"
                          )}
                          aria-label={`${index + 1}번 이미지로 이동`}
                        />
                      ))}
                    </div>
                  </>
                )}
              </>
            ) : (
              <div className="w-full h-full bg-gray-100" />
            )}
          </div>

          {/* 상품 정보 섹션 */}
          <div className="p-6">
            {/* 판매자 정보 */}
            <Link
              href={`/profiles/${product?.user?.id}`}
              className="flex items-center space-x-3 mb-6 group"
            >
              {product?.user?.avatar ? (
                <Image
                  src={makeImageUrl(product.user.avatar, "avatar")}
                  className="w-10 h-10 rounded-full object-cover ring-2 ring-primary/10 group-hover:ring-primary/20 transition-all"
                  width={40}
                  height={40}
                  alt="avatar"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-gray-200" />
              )}
              <div>
                <p className="font-medium text-gray-900 group-hover:text-primary transition-colors">
                  {product?.user?.name}
                </p>
                <p className="text-xs text-gray-500">프로필 보기</p>
              </div>
            </Link>

            {/* 상품 상세 정보 */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h1 className="text-xl font-semibold text-gray-900 tracking-tight">
                  {product?.name}
                </h1>
              </div>

              {/* 가격 정보 */}
              <div className="flex items-baseline space-x-2">
                <p className="text-2xl font-bold text-primary tracking-tight">
                  {product?.price?.toLocaleString()}원
                </p>
              </div>

              {/* 상품 설명 */}
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-sm text-gray-700 whitespace-pre-line leading-relaxed">
                  {product?.description}
                </p>
              </div>

              {/* 연락하기 버튼 */}
              <div className="flex items-center justify-between space-x-2">
                {user?.id === product?.user?.id ? (
                  <div className="flex space-x-2 w-full">
                    <Link
                      href={`/products/${params?.id}/edit`}
                      className="flex-1 bg-gray-100 text-gray-700 py-3 rounded-md hover:bg-gray-200 transition-colors text-center"
                    >
                      수정하기
                    </Link>
                    <button
                      onClick={handleDelete}
                      disabled={deleteLoading}
                      className="flex-1 bg-red-100 text-red-600 py-3 rounded-md hover:bg-red-200 transition-colors disabled:opacity-50"
                    >
                      {deleteLoading ? "삭제 중..." : "삭제하기"}
                    </button>
                  </div>
                ) : (
                  <>
                    <button
                      onClick={onContactClick}
                      className="flex-1 bg-primary text-white py-3 rounded-md hover:bg-primary-dark transition-colors"
                    >
                      판매자와 채팅하기
                    </button>
                    <button
                      onClick={onFavClick}
                      className={cn(
                        "p-3 rounded-md flex items-center justify-center",
                        isLiked
                          ? "text-red-500 hover:bg-red-50"
                          : "text-gray-400 hover:bg-gray-100"
                      )}
                    >
                      {isLiked ? (
                        <svg
                          className="w-6 h-6"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z"
                            clipRule="evenodd"
                          />
                        </svg>
                      ) : (
                        <svg
                          className="w-6 h-6"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                          />
                        </svg>
                      )}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 연관 상품 섹션 */}
        {relatedProducts && relatedProducts.length > 0 && (
          <div className="mt-12">
            <h2 className="text-lg font-semibold text-gray-900 mb-6">
              연관 상품
            </h2>
            <div className="grid grid-cols-4 md:grid-cols-3 gap-6">
              {relatedProducts.map((product) => (
                <Link
                  key={product.id}
                  href={`/products/${product.id}`}
                  className="group focus:outline-none rounded-xl"
                >
                  <div className="relative aspect-square rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all">
                    <Image
                      src={makeImageUrl(product.photos?.[0] || "", "product")}
                      alt={product.name}
                      fill={true}
                      sizes="100%"
                      className="object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  </div>
                  <div className="mt-3">
                    <h3 className="text-sm font-medium text-gray-900 truncate group-hover:text-primary transition-colors">
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
    </Layout>
  );
};

export default ProductClient;
