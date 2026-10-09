"use client";
/**
 * '현재 위치로 찾기'(앱 src/lib/locateRegion.ts, 대응표 O-6): 브라우저 위치 → 카카오 지도 JS SDK 의 좌표→행정구역 변환 →
 * REGIONS 목록과 맞춰 시/도·시/군/구를 고른다.
 * - 위치 권한은 버튼을 누를 때 처음 묻는다.
 * - 좌표는 이 함수 안에서만 쓰고(브라우저 ↔ 카카오) 우리 서버로 보내거나 저장하지 않는다. 서버에는 지역 이름만 간다
 *   (앱이 기기 역지오코딩을 쓰는 것과 같은 원칙 — 10-07 결정 '좌표 미저장').
 * - 위치 기능·보안 컨텍스트·카카오 JS 키가 없으면 isLocateAvailable() 이 false 라 버튼을 숨긴다.
 */
import { REGIONS, type Region } from "@libs/shared/regions";

/** "서울특별시" / "서울" / "Seoul" 처럼 다양한 표기를 목록의 시/도와 맞춘다. */
const SIDO_ALIASES: Record<string, string[]> = {
  서울특별시: ["서울", "Seoul"],
  부산광역시: ["부산", "Busan"],
  대구광역시: ["대구", "Daegu"],
  인천광역시: ["인천", "Incheon"],
  광주광역시: ["광주", "Gwangju"],
  대전광역시: ["대전", "Daejeon"],
  울산광역시: ["울산", "Ulsan"],
  세종특별자치시: ["세종", "Sejong"],
  경기도: ["경기", "Gyeonggi"],
  강원특별자치도: ["강원", "강원도", "Gangwon"],
  충청북도: ["충북", "Chungcheongbuk", "North Chungcheong"],
  충청남도: ["충남", "Chungcheongnam", "South Chungcheong"],
  전북특별자치도: ["전북", "전라북도", "Jeollabuk", "North Jeolla"],
  전라남도: ["전남", "Jeollanam", "South Jeolla"],
  경상북도: ["경북", "Gyeongsangbuk", "North Gyeongsang"],
  경상남도: ["경남", "Gyeongsangnam", "South Gyeongsang"],
  제주특별자치도: ["제주", "제주도", "Jeju"],
};

const normalize = (value: string | null | undefined) => (value ?? "").replace(/\s+/g, "").toLowerCase();

function matchSido(candidates: string[]): string | null {
  for (const raw of candidates) {
    const v = normalize(raw);
    if (!v) continue;
    for (const { sido } of REGIONS) {
      const names = [sido, ...(SIDO_ALIASES[sido] ?? [])].map(normalize);
      if (names.some((n) => v === n || v.startsWith(n) || n.startsWith(v))) return sido;
    }
  }
  return null;
}

function matchSigungu(sido: string, candidates: string[]): string | null {
  const entry = REGIONS.find((r) => r.sido === sido);
  if (!entry) return null;
  if (entry.sigungu.length === 1) return entry.sigungu[0]; // 세종
  for (const raw of candidates) {
    const v = normalize(raw);
    if (!v) continue;
    // "수원시 장안구" 처럼 일반구가 붙어 오면 앞의 시만 맞춘다.
    const hit = entry.sigungu.find((s) => {
      const n = normalize(s);
      return v === n || v.startsWith(n) || n.startsWith(v);
    });
    if (hit) return hit;
  }
  return null;
}

/** 역지오코딩 결과(region=시/도, city/subregion/district=시·군·구)를 목록과 맞춘다. 맞는 조합이 없으면 null. */
export function matchRegion(address: {
  region?: string | null;
  city?: string | null;
  subregion?: string | null;
  district?: string | null;
}): Region | null {
  const sido = matchSido([address.region, address.city, address.subregion].filter(Boolean) as string[]);
  if (!sido) return null;
  const sigungu = matchSigungu(sido, [address.subregion, address.city, address.district].filter(Boolean) as string[]);
  return sigungu ? { sido, sigungu } : null;
}

const KAKAO_JS_KEY = process.env.NEXT_PUBLIC_KAKAO_JAVASCRIPT_KEY;
const LOCATE_TIMEOUT_MS = 12_000;

export function isLocateAvailable(): boolean {
  return (
    typeof window !== "undefined" &&
    window.isSecureContext &&
    typeof navigator !== "undefined" &&
    "geolocation" in navigator &&
    Boolean(KAKAO_JS_KEY)
  );
}

type KakaoRegionResult = { region_type: string; region_1depth_name: string; region_2depth_name: string };
type KakaoMapsGlobal = {
  maps: {
    load: (callback: () => void) => void;
    services: {
      Geocoder: new () => {
        coord2RegionCode: (
          lng: number,
          lat: number,
          callback: (result: KakaoRegionResult[], status: string) => void
        ) => void;
      };
      Status: { OK: string };
    };
  };
};

let mapsPromise: Promise<KakaoMapsGlobal> | null = null;

/** 카카오 지도 JS SDK(services)를 버튼을 누를 때만 불러온다. 로그인용 Kakao SDK 와는 다른 스크립트다. */
function loadKakaoMaps(): Promise<KakaoMapsGlobal> {
  if (mapsPromise) return mapsPromise;
  mapsPromise = new Promise<KakaoMapsGlobal>((resolve, reject) => {
    const existing = (window as unknown as { kakao?: KakaoMapsGlobal }).kakao;
    if (existing?.maps?.services) return resolve(existing);
    const script = document.createElement("script");
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${KAKAO_JS_KEY}&libraries=services&autoload=false`;
    script.async = true;
    script.onload = () => {
      const kakao = (window as unknown as { kakao?: KakaoMapsGlobal }).kakao;
      if (!kakao?.maps) return reject(new Error("kakao maps unavailable"));
      kakao.maps.load(() => resolve(kakao));
    };
    script.onerror = () => reject(new Error("kakao maps load failed"));
    document.head.appendChild(script);
  }).catch((error) => {
    mapsPromise = null;
    throw error;
  });
  return mapsPromise;
}

function currentPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: false,
      timeout: LOCATE_TIMEOUT_MS,
      // 시/군/구만 고르면 되므로 10분 안의 마지막 위치도 쓴다.
      maximumAge: 10 * 60_000,
    });
  });
}

export type LocateResult =
  | { ok: true; region: Region }
  | { ok: false; reason: "unavailable" | "denied" | "failed" | "unmatched" };

/** 버튼 탭 시 호출. 위치 권한 → 현재 위치 → 카카오 좌표→행정구역 → 목록 매칭. */
export async function locateRegion(): Promise<LocateResult> {
  if (!isLocateAvailable()) return { ok: false, reason: "unavailable" };
  let position: GeolocationPosition;
  try {
    position = await currentPosition();
  } catch (error) {
    const denied = (error as GeolocationPositionError | undefined)?.code === 1;
    return { ok: false, reason: denied ? "denied" : "failed" };
  }
  try {
    const kakao = await loadKakaoMaps();
    const geocoder = new kakao.maps.services.Geocoder();
    const results = await new Promise<KakaoRegionResult[]>((resolve, reject) => {
      geocoder.coord2RegionCode(position.coords.longitude, position.coords.latitude, (result, status) => {
        if (status === kakao.maps.services.Status.OK) resolve(result);
        else reject(new Error(`coord2RegionCode ${status}`));
      });
    });
    // 행정동(H)·법정동(B) 어느 쪽이든 1·2단계 이름은 같다. 행정동을 먼저 쓴다.
    const best = results.find((r) => r.region_type === "H") ?? results[0];
    if (!best) return { ok: false, reason: "unmatched" };
    const region = matchRegion({ region: best.region_1depth_name, city: best.region_2depth_name });
    return region ? { ok: true, region } : { ok: false, reason: "unmatched" };
  } catch {
    return { ok: false, reason: "failed" };
  }
}
