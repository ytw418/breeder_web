"use client";
import type { GetStaticPaths, GetStaticProps, NextPage } from "next";
import useSWR, { useSWRConfig } from "swr";
import { useState } from "react";
import Image from "next/image";
import Layout from "@components/layout";
import Link from "next/link";
import { cls } from "@libs/client/utils";
import { makeImageUrl } from "@libs/client/utils";
import useMutation from "@libs/client/useMutation";
import { useParams, useRouter } from "next/navigation";
import useUser from "@libs/client/useUser";
import { ItemDetailResponse } from "pages/api/products/[id]";
import Button from "@components/atoms/Button";
import { ChatResponseType } from "pages/api/chat";

const ProductClient = ({ product, relatedProducts }: ItemDetailResponse) => {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const query = useParams();

  const [getChatRoomId, { loading }] =
    useMutation<ChatResponseType>(`/api/chat`);
  const { user, isLoading } = useUser();
  const router = useRouter();
  const { mutate } = useSWRConfig();
  const { data, mutate: boundMutate } = useSWR<ItemDetailResponse>(
    query?.id ? `/api/products/${query.id}` : null
  );
  const [toggleFav, { loading: favLoading }] = useMutation(
    query?.id ? `/api/products/${query?.id}/fav` : ""
  );

  const onFavClick = () => {
    if (!favLoading) toggleFav({ data: {} });
    if (!data) return;
    boundMutate((prev) => prev && { ...prev, isLiked: !prev.isLiked }, false);
  };

  const nextImage = () => {
    if (!product?.photos?.length) return;
    setCurrentImageIndex((prev) =>
      prev === product.photos.length - 1 ? 0 : prev + 1
    );
  };

  const prevImage = () => {
    if (!product?.photos?.length) return;
    setCurrentImageIndex((prev) =>
      prev === 0 ? product.photos.length - 1 : prev - 1
    );
  };

  return (
    <Layout
      seoTitle={product?.name || "상세 정보"}
      title={product?.name || "상세 정보"}
      canGoBack
    >
      <div className="px-4">
        <div className="mb-8">
          <div className="relative h-96">
            {product?.photos && product.photos.length > 0 ? (
              <>
                <Image
                  src={makeImageUrl(
                    product.photos[currentImageIndex],
                    "public"
                  )}
                  className="object-cover bg-slate-300"
                  alt={`상품 이미지 ${currentImageIndex + 1}`}
                  layout="fill"
                  priority={true}
                />
                {product.photos.length > 1 && (
                  <>
                    <button
                      onClick={prevImage}
                      className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 text-white p-2 rounded-full hover:bg-black/70"
                      aria-label="이전 이미지"
                    >
                      <svg
                        className="w-6 h-6"
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
                      className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 text-white p-2 rounded-full hover:bg-black/70"
                      aria-label="다음 이미지"
                    >
                      <svg
                        className="w-6 h-6"
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
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                      {product.photos.map((_, index) => (
                        <button
                          key={index}
                          onClick={() => setCurrentImageIndex(index)}
                          className={cls(
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
              <div className="h-96 bg-slate-300" />
            )}
          </div>
          <Link
            href={`/profiles/${product?.user?.id}`}
            className="flex items-center py-3 space-x-3 border-t border-b cursor-pointer"
          >
            {product?.user?.avatar ? (
              <Image
                src={makeImageUrl(product.user.avatar, "avatar")}
                className="w-12 h-12 rounded-full bg-slate-300"
                width={48}
                height={48}
                alt="avatar"
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-slate-300" />
            )}
            <div>
              <p className="text-sm font-medium text-gray-700">
                {product?.user?.name}
              </p>
              <div className="text-xs font-medium text-gray-500">
                프로필 보기 &rarr;
              </div>
            </div>
          </Link>
          <div className="mt-5">
            <h1 className="title-7 font-bold text-gray-900">{product?.name}</h1>
            <span className="block mt-3 body-4 text-gray-900">
              {product?.price?.toLocaleString()} 원
            </span>
            <p className="my-6 body-3 text-gray-700">{product?.description}</p>
            <div className="flex items-center justify-between space-x-2">
              <Button
                type={"squareDefault"}
                text={"판매자에게 연락하기"}
                size={"small"}
                widthFull
                clickAction={() =>
                  getChatRoomId({
                    data: { otherId: data?.product?.userId },
                    onCompleted(result) {
                      if (result.success) {
                        router.push(`/chat/${result.ChatRoomId}`);
                      } else {
                        alert(result.error);
                      }
                    },
                    onError(error) {
                      alert(error);
                    },
                  })
                }
              />
              <button
                onClick={onFavClick}
                className={cls(
                  "flex items-center justify-center rounded-md p-3 hover:bg-gray-100 focus:outline-none",
                  data?.isLiked
                    ? "text-red-500 hover:text-red-600"
                    : "text-gray-400  hover:text-gray-500 "
                )}
              >
                {data?.isLiked ? (
                  <svg
                    className="w-6 h-6"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      fillRule="evenodd"
                      d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z"
                      clipRule="evenodd"
                    />
                  </svg>
                ) : (
                  <svg
                    className="w-6 h-6 "
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    aria-hidden="true"
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
            </div>
          </div>
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-900">연관 상품</h2>
          <div className="grid grid-cols-2 gap-4 my-8">
            {relatedProducts?.map((product) => (
              <Link key={product.id} href={`/products/${product.id}`}>
                <Image
                  src={makeImageUrl(product.photos?.[0] || "", "product")}
                  height={224}
                  width={150}
                  alt={product.name}
                  className="w-full h-56 mb-4 bg-slate-300"
                />
                <h3 className="-mb-1 text-gray-700">{product.name}</h3>
                <span className="body-3 text-gray-900">
                  {product.price.toLocaleString()} 원
                </span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default ProductClient;
