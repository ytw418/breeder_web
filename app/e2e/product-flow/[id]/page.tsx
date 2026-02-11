import { notFound } from "next/navigation";
import ProductClient from "../../../(web)/products/[id]/ProductClient";
import type { ItemDetailResponse } from "pages/api/products/[id]";

const e2eProduct: NonNullable<ItemDetailResponse["product"]> = {
  id: 101,
  name: "테스트 사슴벌레",
  price: 120000,
  description: "E2E 찜 토글 테스트용 상품 설명입니다.",
  photos: ["e2e-product-image"],
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  userId: 999,
  category: "곤충",
  tags: [],
  isSold: false,
  isDeleted: false,
  isHidden: false,
  location: null,
  viewCount: 0,
  wishCount: 0,
  status: "판매중",
  condition: null,
  contactCount: 0,
  expireAt: null,
  deliveryType: null,
  priceOfferable: true,
  mainImage: null,
  isFeatured: false,
  reportCount: 0,
  productType: "생물",
  user: {
    id: 999,
    role: "USER",
    status: "ACTIVE",
    snsId: "e2e-seller",
    provider: "kakao",
    phone: null,
    email: "seller@e2e.local",
    name: "테스트 판매자",
    avatar: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  },
};

export default function E2EProductFlowDetailPage() {
  if (process.env.ENABLE_E2E_ROUTES !== "true") {
    notFound();
  }

  return (
    <ProductClient
      success
      product={e2eProduct}
      relatedProducts={[]}
      isLiked={false}
      hasPurchased={false}
    />
  );
}

