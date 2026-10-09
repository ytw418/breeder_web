"use client";
/** 동네 브리더 전체 보기(앱 neighborhood/breeders.tsx): 캡션 → 동네 브리더 행(최대 50명). 동네 미설정이면 안내 카드. */
import useSWR from "swr";
import Layout from "@components/features/MainLayout";
import { QueryErrorState } from "@components/app/QueryErrorState";
import {
  NEARBY_FULL_LIST_LIMIT,
  NearbyBreederEmpty,
  NearbyBreederRow,
  NearbyBreederSkeletonRows,
  nearbyCaption,
} from "@components/features/post/NearbyBreederList";
import RegionGateCard from "@components/features/region/RegionGateCard";
import { regionOf } from "@libs/shared/regions";
import useUser from "hooks/useUser";
import type { NearbyBreedersResponse } from "pages/api/users/nearby";

export default function NeighborhoodBreedersClient() {
  const { user } = useUser();
  const region = regionOf(user as { regionSido?: string | null; regionSigungu?: string | null } | undefined);
  const { data, error, mutate } = useSWR<NearbyBreedersResponse>(
    region ? `/api/users/nearby?limit=${NEARBY_FULL_LIST_LIMIT}` : null
  );
  const caption = nearbyCaption(data);
  return (
    <Layout canGoBack title="동네 브리더" seoTitle="동네 브리더">
      {!region ? (
        <RegionGateCard className="mt-4" />
      ) : error && !data ? (
        <QueryErrorState title="동네 브리더를 불러오지 못했어요" onRetry={() => void mutate()} className="py-[60px]" />
      ) : !data ? (
        <NearbyBreederSkeletonRows count={6} />
      ) : data.items.length === 0 ? (
        <NearbyBreederEmpty region={data.region} />
      ) : (
        <div className="pb-6">
          {caption ? <p className="px-4 pb-1 pt-3 text-[13px] text-app-muted">{caption}</p> : null}
          {data.items.map((item) => (
            <div key={item.user.id} className="border-b border-app-line">
              <NearbyBreederRow item={item} />
            </div>
          ))}
        </div>
      )}
    </Layout>
  );
}
