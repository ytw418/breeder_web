"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import useSWR, { useSWRConfig } from "swr";
import MainLayout from "@components/features/MainLayout";
import { ProductCard } from "@components/app/ProductCard";
import { ReportSheet } from "@components/app/moderation/ReportSheet";
import { AdopterPickerSheet } from "@components/features/trade/AdopterPickerSheet";
import type { AdoptionConfirmProduct } from "@components/features/trade/AdoptionConfirmSheet";
import { useTradeReviewRefresh } from "@components/features/trade/useTradeReviewRefresh";
import { TradeReviewSheet } from "@components/features/trade/TradeReviewSheet";
import { InitialAvatar } from "@components/ui/InitialAvatar";
import useUser from "hooks/useUser";
import type { ItemDetailResponse } from "pages/api/products/[id]";
import type { MySellHistoryResponseType } from "pages/api/users/[id]/sales";
import { authFetch } from "@libs/client/authFetch";
import { getProductPath } from "@libs/product-route";
import { SOLD_PRODUCT_STATUS, tradeStatusLine } from "@libs/shared/tradeReview";
import { LoadingBlock } from "./ProfileRows";

type HistoryRecord = MySellHistoryResponseType["mySellHistoryData"][number];

type HistoryKind = "favs" | "sales" | "purchases";

interface ProductListProps {
  kind: HistoryKind;
  id: number;
}

const TITLE: Record<HistoryKind, string> = {
  favs: "관심목록",
  sales: "분양내역",
  purchases: "입양내역",
};

const EMPTY_MESSAGE: Record<HistoryKind, string> = {
  favs: "아직 관심 분양글이 없습니다",
  sales: "아직 분양 내역이 없습니다",
  purchases: "아직 입양 내역이 없습니다",
};

/** 권한 없음(비로그인 401·다른 사용자 403) 안내. 다시 시도해도 같아 재시도 버튼은 두지 않는다. */
const DENIED_MESSAGE: Record<HistoryKind, string> = {
  favs: "관심목록은 본인만 볼 수 있습니다.",
  sales: "분양내역을 볼 수 없습니다.",
  purchases: "입양내역을 볼 수 없습니다.",
};

function CenterMessage({
  message,
  actionLabel,
  onAction,
}: {
  message: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-5 py-24 text-center">
      <p className="text-[14px] text-app-muted">{message}</p>
      <button
        type="button"
        onClick={onAction}
        className="mt-3 h-9 rounded-md bg-app-surface px-3.5 text-[14px] font-semibold text-app-text"
      >
        {actionLabel}
      </button>
    </div>
  );
}

/** 본인 분양내역(분양완료)이면 카드 아래 입양자 줄을 붙인다. 남이 보면 서버가 입양자 칸을 주지 않는다(buyerSource 없음). */
const hasBuyerLine = (kind: HistoryKind, record: HistoryRecord) =>
  kind === "sales" &&
  record.buyerSource !== undefined &&
  (record.product as { status?: string | null }).status === SOLD_PRODUCT_STATUS;

/**
 * 본인 분양내역 카드 아래 입양자 줄(앱 profiles/[id]/sales BuyerLine, 시안 #history-cards — 글 열 116 에 맞춘 13 muted):
 * "아바타 16 · 입양자 ○○ · 입양 확정 대기/완료" / "입양자를 아직 정하지 않았어요 · 지정하기 ›"(brand-text) / "브리디 밖에서 분양".
 */
function BuyerLine({ record, onAssign }: { record: HistoryRecord; onAssign: (productId: number) => void }) {
  const product = record.product as typeof record.product & { status?: string | null };
  const text = tradeStatusLine(
    {
      viewerId: null,
      sellerId: record.userId,
      status: product.status ?? "",
      buyerId: record.buyer?.id ?? null,
      buyerSource: record.buyerSource ?? null,
      purchaseConfirmed: Boolean(record.purchaseConfirmed),
      hasReview: false,
      hasReply: false,
      isDeleted: Boolean(product.isDeleted),
    },
    record.buyer?.name
  );
  if (!text) return null;
  const canAssign = record.buyerSource == null && !product.isDeleted && !product.isHidden;
  return (
    // 카드(relative)의 아래 여백 위로 8 올려 붙인다 — relative 라야 카드 바탕에 가려지지 않는다.
    <div className="relative -mt-2 flex items-center gap-1.5 border-b border-app-line bg-app-bg pb-3 pl-[116px] pr-4">
      {record.buyerSource === "bredy" && record.buyer ? (
        <InitialAvatar name={record.buyer.name} avatar={record.buyer.avatar} size={16} />
      ) : null}
      <p className="min-w-0 flex-1 truncate text-[13px] text-app-muted">{text}</p>
      {canAssign ? (
        <button
          type="button"
          aria-label={`${product.name} 입양자 지정하기`}
          onClick={() => onAssign(product.id)}
          className="shrink-0 text-[13px] font-semibold text-app-brand-text"
        >
          지정하기 ›
        </button>
      ) : null}
    </div>
  );
}

/**
 * 본인 입양내역 카드 아래 줄(앱 purchases AdoptionLine, 시안 #history-cards — 글 열 116 에 맞춘 13 muted):
 * '○○님에게 입양' + 후기 전이면 오른쪽 '거래 후기 쓰기' pill 28 r14 1px border 12/600. 후기를 남겼으면(숨겨졌어도) pill 이 없다.
 * 남이 보면 서버가 tradeReview 를 주지 않아(undefined) 줄을 그리지 않는다. 분양자 이름이 없으면 '입양 확정'.
 */
function AdoptionLine({
  record,
  opening,
  onWriteReview,
}: {
  record: HistoryRecord;
  opening: boolean;
  onWriteReview: (record: HistoryRecord) => void;
}) {
  const sellerName = record.product.user?.name?.trim();
  return (
    <div className="relative -mt-2 flex min-h-[40px] items-center gap-1.5 border-b border-app-line bg-app-bg pb-3 pl-[116px] pr-4">
      <p className="min-w-0 flex-1 truncate text-[13px] text-app-muted">
        {sellerName ? `${sellerName}님에게 입양` : "입양 확정"}
      </p>
      {record.tradeReview === null ? (
        <button
          type="button"
          aria-label={`${record.product.name} 거래 후기 쓰기`}
          disabled={opening}
          onClick={() => onWriteReview(record)}
          className="h-7 shrink-0 rounded-[14px] border border-app-border px-3 text-[12px] font-semibold text-app-text disabled:opacity-60"
        >
          거래 후기 쓰기
        </button>
      ) : null}
    </div>
  );
}

/**
 * 분양·입양·관심 목록(앱 profiles/[id]/sales·purchases·favs). ProductCard 플랫 행 / 빈 상태 14 muted 가운데.
 * 입양내역은 다른 사용자도 볼 수 있다(관심목록만 본인 전용 — 서버가 401·403 으로 막고 여기서는 안내만 한다).
 * 본인 분양내역은 분양완료 카드 아래 입양자 줄을 붙이고, '지정하기 ›'는 그 자리에서 입양자 시트를 연다(앱 docs/prd/trade-review.md S-10).
 * 본인 입양내역은 카드 아래 '○○님에게 입양' 줄과 후기 전이면 '거래 후기 쓰기' pill 을 붙인다.
 * `/profiles/0/...`(비로그인 사이드 메뉴 링크)처럼 id 가 양의 정수가 아니면 로그인한 내 id 경로로 바꾼다.
 */
export default function MySellHistoryList({ kind, id }: ProductListProps) {
  const router = useRouter();
  const { user, isLoading: userLoading } = useUser();
  const { mutate: globalMutate } = useSWRConfig();
  // '지정하기 ›'로 연 입양자 시트의 분양글 id(상세로 보내지 않고 그 자리에서 고른다).
  const [pickerProductId, setPickerProductId] = useState<number | null>(null);
  // '거래 후기 쓰기'로 연 후기 시트의 분양글과 그 분양자(시트 '신고' → 분양자 USER 신고).
  const [reviewTarget, setReviewTarget] = useState<{ product: AdoptionConfirmProduct; sellerId: number | null } | null>(
    null
  );
  const [reportSellerId, setReportSellerId] = useState<number | null>(null);
  const [openingId, setOpeningId] = useState<number | null>(null);
  const refreshTradeReviews = useTradeReviewRefresh();
  // 양의 정수가 아닌 id(/profiles/0·abc·-1 …)는 내 id 경로로 바꾼다(앱 useOwnProfileRedirect). /api/users/NaN 요청 금지.
  const resolvingOwner = !(Number.isInteger(id) && id > 0);

  useEffect(() => {
    if (!resolvingOwner || userLoading) return;
    if (user?.id) {
      router.replace(`/profiles/${user.id}/${kind}`);
    } else {
      router.replace(`/auth/login?next=${encodeURIComponent(`/profiles/0/${kind}`)}`);
    }
  }, [kind, resolvingOwner, router, user?.id, userLoading]);

  // 관심목록 권한(본인만)은 서버가 판정한다(비로그인 401 · 다른 사용자 403).
  const { data, error, isLoading, mutate } = useSWR<MySellHistoryResponseType>(
    resolvingOwner ? null : `/api/users/${id}/${kind}`
  );
  const errorStatus = (error as (Error & { status?: number }) | undefined)?.status;

  /**
   * '거래 후기 쓰기': 상세를 새로 받아 trade.canReview 면 그 자리에서 후기 시트를 열고, 아니면(지정 전·옛 공개 버튼으로 남은 확정 등)
   * 상세로 보내 그 화면의 안내·요청 버튼을 보게 한다. 지웠거나 숨긴 분양글은 상세를 열 수 없어(404·403) 시트를 바로 연다
   * (서버가 자격을 본다 — 지운 글에도 후기를 남길 수 있다). 앱 purchases openReview 와 같다.
   */
  const openReview = async (record: HistoryRecord) => {
    if (openingId != null) return;
    const { product } = record;
    const fallback: AdoptionConfirmProduct = {
      id: product.id,
      name: product.name,
      price: product.price,
      photo: product.photos?.[0] ?? null,
      sellerName: product.user?.name ?? "분양자",
      productType: product.productType ?? null,
      category: product.category ?? null,
      dealType: product.dealType ?? null,
    };
    const productPath = getProductPath(product.id, product.name);
    setOpeningId(product.id);
    try {
      const res = await authFetch(`/api/products/${product.id}`);
      if (res.status === 404 || res.status === 403) {
        setReviewTarget({ product: fallback, sellerId: product.user?.id ?? product.userId ?? null });
        return;
      }
      const detail = (await res.json().catch(() => null)) as ItemDetailResponse | null;
      if (res.ok && detail?.trade?.canReview && detail.product) {
        setReviewTarget({
          product: {
            ...fallback,
            sellerName: detail.product.user?.name ?? fallback.sellerName,
            productType: detail.product.productType ?? fallback.productType,
          },
          sellerId: detail.product.user?.id ?? product.userId ?? null,
        });
      } else {
        router.push(productPath);
      }
    } catch {
      router.push(productPath);
    } finally {
      setOpeningId(null);
    }
  };

  const goBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) router.back();
    else router.replace("/");
  };

  let content: ReactNode;
  if (resolvingOwner || isLoading) {
    content = <LoadingBlock height={320} />;
  } else if (!data && errorStatus === 401) {
    content = (
      <div className="flex flex-col items-center justify-center px-5 py-24 text-center">
        <p className="text-[16px] font-semibold text-app-text">로그인이 필요합니다</p>
        <p className="mt-1.5 text-[14px] text-app-muted">{TITLE[kind]}을 보려면 로그인해 주세요.</p>
        <Link
          href={`/auth/login?next=${encodeURIComponent(`/profiles/${id}/${kind}`)}`}
          className="mt-3 inline-flex h-9 items-center rounded-md bg-app-surface px-3.5 text-[14px] font-semibold text-app-text"
        >
          로그인하기
        </Link>
      </div>
    );
  } else if (!data && errorStatus === 403) {
    content = <CenterMessage message={DENIED_MESSAGE[kind]} actionLabel="돌아가기" onAction={goBack} />;
  } else if (error && !data) {
    content = (
      <CenterMessage
        message={`${TITLE[kind]}을 불러올 수 없습니다.`}
        actionLabel="다시 시도"
        onAction={() => void mutate()}
      />
    );
  } else if (!data?.mySellHistoryData?.length) {
    content = (
      <div className="flex items-center justify-center px-5 py-20 text-center">
        <p className="text-[14px] text-app-muted">{EMPTY_MESSAGE[kind]}</p>
      </div>
    );
  } else {
    content = (
      <div>
        {data.mySellHistoryData.map((record) => {
          const product = record.product as typeof record.product & {
            category?: string | null;
            status?: string | null;
          };
          const withBuyerLine = hasBuyerLine(kind, record);
          // 본인 입양내역(서버가 tradeReview 를 줄 때만)은 카드 아래 '○○님에게 입양' 줄.
          const withAdoptionLine = kind === "purchases" && record.tradeReview !== undefined;
          return (
            <div key={record.id}>
              <ProductCard
                className={withBuyerLine || withAdoptionLine ? "border-b-0" : undefined}
                product={{
                  id: product.id,
                  name: product.name,
                  price: product.price,
                  image: product.photos?.[0] ?? null,
                  createdAt: product.createdAt,
                  category: product.category ?? null,
                  status: product.status ?? null,
                  isDeleted: product.isDeleted,
                  isHidden: product.isHidden,
                  wishCount: product._count?.favs ?? 0,
                  dealType: product.dealType ?? null,
                  petInfo: product.petInfo,
                }}
              />
              {withBuyerLine ? <BuyerLine record={record} onAssign={setPickerProductId} /> : null}
              {withAdoptionLine ? (
                <AdoptionLine
                  record={record}
                  opening={openingId === record.product.id}
                  onWriteReview={(target) => void openReview(target)}
                />
              ) : null}
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <MainLayout canGoBack title={TITLE[kind]} seoTitle={TITLE[kind]}>
      {content}
      {pickerProductId != null ? (
        <AdopterPickerSheet
          open
          productId={pickerProductId}
          mode="assign"
          onClose={() => setPickerProductId(null)}
          onChanged={() => {
            void mutate();
            void globalMutate(`/api/products/${pickerProductId}`);
          }}
        />
      ) : null}
      {reviewTarget ? (
        <TradeReviewSheet
          open
          product={reviewTarget.product}
          onClose={() => setReviewTarget(null)}
          onChanged={() => void refreshTradeReviews()}
          onReportSeller={() => setReportSellerId(reviewTarget.sellerId)}
        />
      ) : null}
      <ReportSheet
        open={reportSellerId != null}
        targetType="USER"
        targetId={reportSellerId}
        onClose={() => setReportSellerId(null)}
      />
    </MainLayout>
  );
}
