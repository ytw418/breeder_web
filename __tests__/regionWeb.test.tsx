import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";

const mockUseUser = jest.fn();
// jest 설정에 hooks/ 별칭이 없어 가상 모듈로 막는다.
jest.mock(
  "hooks/useUser",
  () => ({ __esModule: true, default: () => mockUseUser() }),
  { virtual: true }
);
jest.mock("@components/features/MainLayout", () => ({
  __esModule: true,
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  toLoginHref: (next: string) => `/login?next=${encodeURIComponent(next)}`,
}));

import NearbyBreederList, { nearbyCaption } from "@components/features/post/NearbyBreederList";
import RegionGateCard from "@components/features/region/RegionGateCard";
import { matchRegion } from "@libs/client/locateRegion";
import { REGION_POST_CATEGORY, postCategoryLabel } from "@libs/shared/postCategory";
import { formatRegion, regionOf } from "@libs/shared/regions";
import type { NearbyBreedersResponse } from "pages/api/users/nearby";

const breeder = (id: number, name: string, sigungu = "강남구") => ({
  user: { id, name, avatar: null },
  region: { sido: "서울특별시", sigungu },
  postsCount: 3,
  commentsCount: 7,
  breederPrograms: [],
});

describe("동네 매칭(앱 locateRegion 과 같음)", () => {
  it("카카오 좌표→행정구역 이름을 목록의 시/도·시/군/구와 맞춘다", () => {
    expect(matchRegion({ region: "서울특별시", city: "강남구" })).toEqual({ sido: "서울특별시", sigungu: "강남구" });
    expect(matchRegion({ region: "서울", city: "마포구" })).toEqual({ sido: "서울특별시", sigungu: "마포구" });
  });

  it("일반구가 붙은 시는 앞의 시만 맞추고, 세종은 하나뿐인 시/군/구를 고른다", () => {
    expect(matchRegion({ region: "경기도", city: "수원시 장안구" })).toEqual({ sido: "경기도", sigungu: "수원시" });
    const sejong = matchRegion({ region: "세종특별자치시", city: "" });
    expect(sejong?.sido).toBe("세종특별자치시");
    expect(sejong?.sigungu).toBeTruthy();
  });

  it("목록에 없는 지역은 null", () => {
    expect(matchRegion({ region: "Tokyo", city: "Shibuya" })).toBeNull();
    expect(matchRegion({ region: "서울특별시", city: "없는구" })).toBeNull();
  });
});

describe("내 동네 표시", () => {
  it("시/도·시/군/구가 둘 다 있어야 설정된 것으로 본다", () => {
    expect(regionOf({ regionSido: "서울특별시", regionSigungu: "강남구" })).toEqual({
      sido: "서울특별시",
      sigungu: "강남구",
    });
    expect(regionOf({ regionSido: "서울특별시", regionSigungu: null })).toBeNull();
    expect(regionOf(undefined)).toBeNull();
    expect(formatRegion(regionOf({ regionSido: "서울특별시", regionSigungu: "강남구" }))).toBe("서울특별시 강남구");
  });

  it("'동네' 글 메타는 카테고리 대신 시/군/구, 그 밖은 카테고리 그대로", () => {
    expect(postCategoryLabel({ category: REGION_POST_CATEGORY, regionSigungu: "강남구" })).toBe("강남구");
    expect(postCategoryLabel({ category: REGION_POST_CATEGORY, regionSigungu: null })).toBe("동네");
    expect(postCategoryLabel({ category: "자유", regionSigungu: "강남구" })).toBe("자유");
    expect(postCategoryLabel({ category: null })).toBeNull();
  });
});

describe("동네 브리더 목록(앱 NearbyBreederList)", () => {
  beforeEach(() => mockUseUser.mockReturnValue({ user: { id: 1 } }));

  it("캡션: 시/군/구 그대로, 시/도로 넓혔으면 안내, 미설정이면 없음", () => {
    const region = { sido: "서울특별시", sigungu: "강남구" };
    expect(nearbyCaption({ scope: "sigungu", region })).toBe("강남구 브리더");
    expect(nearbyCaption({ scope: "sido", region })).toBe("강남구엔 아직 없어 서울특별시 전체를 보여드려요");
    expect(nearbyCaption({ scope: "none", region: null })).toBeNull();
  });

  it("3명까지만 그리고 전체 보기로 잇는다", () => {
    const data = {
      success: true,
      scope: "sigungu",
      region: { sido: "서울특별시", sigungu: "강남구" },
      items: [breeder(1, "가"), breeder(2, "나"), breeder(3, "다"), breeder(4, "라")],
    } as unknown as NearbyBreedersResponse;
    render(<NearbyBreederList data={data} isError={false} onRetry={() => undefined} />);
    expect(screen.getByText("강남구 브리더")).toBeTruthy();
    expect(screen.getByText("가")).toBeTruthy();
    expect(screen.queryByText("라")).toBeNull();
    expect(screen.getAllByText("게시글 3 · 댓글 7")).toHaveLength(3);
    expect(screen.getByRole("link", { name: /동네 브리더 전체 보기/ }).getAttribute("href")).toBe(
      "/neighborhood/breeders"
    );
  });

  it("0명이면 빈 상태 문구", () => {
    const data = {
      success: true,
      scope: "sido",
      region: { sido: "서울특별시", sigungu: "강남구" },
      items: [],
    } as unknown as NearbyBreedersResponse;
    render(<NearbyBreederList data={data} isError={false} onRetry={() => undefined} />);
    expect(screen.getByText("아직 강남구에 표시 중인 브리더가 없어요")).toBeTruthy();
    expect(screen.queryByText(/전체 보기/)).toBeNull();
  });

  it("안내 카드: 로그인했으면 내 동네 설정, 아니면 로그인으로", () => {
    const { unmount } = render(<RegionGateCard />);
    expect(screen.getByRole("link", { name: "내 동네 설정" }).getAttribute("href")).toBe("/settings/region");
    unmount();
    mockUseUser.mockReturnValue({ user: undefined });
    render(<RegionGateCard />);
    expect(screen.getByRole("link", { name: "내 동네 설정" }).getAttribute("href")).toBe(
      "/login?next=%2Fsettings%2Fregion"
    );
  });
});
