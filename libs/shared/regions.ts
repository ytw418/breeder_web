/**
 * 동네 브리더용 행정구역 목록(시/도 17 → 시/군/구).
 * - 일반구(수원시 장안구 등)는 넣지 않고 시 단위로 끊는다. 세종은 시/군/구가 없어 자기 이름 한 행이다.
 * - 앱 `src/constants/regions.ts` 와 같은 내용이어야 한다. 서버는 이 목록에 없는 조합을 400 INVALID_REGION 으로 막는다.
 * - 좌표는 어디에도 저장하지 않는다(위치정보법 신고 대상이 되지 않게 지역명만 다룬다).
 */
export const REGIONS: ReadonlyArray<{ sido: string; sigungu: readonly string[] }> = [
  { sido: "서울특별시", sigungu: ["종로구", "중구", "용산구", "성동구", "광진구", "동대문구", "중랑구", "성북구", "강북구", "도봉구", "노원구", "은평구", "서대문구", "마포구", "양천구", "강서구", "구로구", "금천구", "영등포구", "동작구", "관악구", "서초구", "강남구", "송파구", "강동구"] },
  { sido: "부산광역시", sigungu: ["중구", "서구", "동구", "영도구", "부산진구", "동래구", "남구", "북구", "해운대구", "사하구", "금정구", "강서구", "연제구", "수영구", "사상구", "기장군"] },
  { sido: "대구광역시", sigungu: ["중구", "동구", "서구", "남구", "북구", "수성구", "달서구", "달성군", "군위군"] },
  { sido: "인천광역시", sigungu: ["중구", "동구", "미추홀구", "연수구", "남동구", "부평구", "계양구", "서구", "강화군", "옹진군"] },
  { sido: "광주광역시", sigungu: ["동구", "서구", "남구", "북구", "광산구"] },
  { sido: "대전광역시", sigungu: ["동구", "중구", "서구", "유성구", "대덕구"] },
  { sido: "울산광역시", sigungu: ["중구", "남구", "동구", "북구", "울주군"] },
  { sido: "세종특별자치시", sigungu: ["세종특별자치시"] },
  { sido: "경기도", sigungu: ["수원시", "성남시", "의정부시", "안양시", "부천시", "광명시", "평택시", "동두천시", "안산시", "고양시", "과천시", "구리시", "남양주시", "오산시", "시흥시", "군포시", "의왕시", "하남시", "용인시", "파주시", "이천시", "안성시", "김포시", "화성시", "광주시", "양주시", "포천시", "여주시", "연천군", "가평군", "양평군"] },
  { sido: "강원특별자치도", sigungu: ["춘천시", "원주시", "강릉시", "동해시", "태백시", "속초시", "삼척시", "홍천군", "횡성군", "영월군", "평창군", "정선군", "철원군", "화천군", "양구군", "인제군", "고성군", "양양군"] },
  { sido: "충청북도", sigungu: ["청주시", "충주시", "제천시", "보은군", "옥천군", "영동군", "증평군", "진천군", "괴산군", "음성군", "단양군"] },
  { sido: "충청남도", sigungu: ["천안시", "공주시", "보령시", "아산시", "서산시", "논산시", "계룡시", "당진시", "금산군", "부여군", "서천군", "청양군", "홍성군", "예산군", "태안군"] },
  { sido: "전북특별자치도", sigungu: ["전주시", "군산시", "익산시", "정읍시", "남원시", "김제시", "완주군", "진안군", "무주군", "장수군", "임실군", "순창군", "고창군", "부안군"] },
  { sido: "전라남도", sigungu: ["목포시", "여수시", "순천시", "나주시", "광양시", "담양군", "곡성군", "구례군", "고흥군", "보성군", "화순군", "장흥군", "강진군", "해남군", "영암군", "무안군", "함평군", "영광군", "장성군", "완도군", "진도군", "신안군"] },
  { sido: "경상북도", sigungu: ["포항시", "경주시", "김천시", "안동시", "구미시", "영주시", "영천시", "상주시", "문경시", "경산시", "의성군", "청송군", "영양군", "영덕군", "청도군", "고령군", "성주군", "칠곡군", "예천군", "봉화군", "울진군", "울릉군"] },
  { sido: "경상남도", sigungu: ["창원시", "진주시", "통영시", "사천시", "김해시", "밀양시", "거제시", "양산시", "의령군", "함안군", "창녕군", "고성군", "남해군", "하동군", "산청군", "함양군", "거창군", "합천군"] },
  { sido: "제주특별자치도", sigungu: ["제주시", "서귀포시"] },
];

export interface Region {
  sido: string;
  sigungu: string;
}

export const REGION_REQUIRED_MESSAGE = "동네를 먼저 설정해 주세요.";
export const INVALID_REGION_MESSAGE = "알 수 없는 지역입니다.";

/** 목록에 있는 시/도 + 시/군/구 조합이면 true. */
export function isValidRegion(sido: unknown, sigungu: unknown): boolean {
  if (typeof sido !== "string" || typeof sigungu !== "string") return false;
  const entry = REGIONS.find((r) => r.sido === sido);
  return !!entry && entry.sigungu.includes(sigungu);
}

/** "서울특별시 강남구" 처럼 한 줄로. 세종은 중복되지 않게 한 번만 쓴다. */
export function formatRegion(region: Partial<Region> | null | undefined): string | null {
  if (!region?.sido || !region.sigungu) return null;
  return region.sido === region.sigungu ? region.sido : `${region.sido} ${region.sigungu}`;
}

/** 목록에 있는 시/도 이름이면 true. */
/** 프로필(regionSido/regionSigungu)에서 동네를 꺼낸다. 둘 다 있어야 설정된 것으로 본다(앱 constants/regions.ts 와 같음). */
export function regionOf(
  user: { regionSido?: string | null; regionSigungu?: string | null } | null | undefined
): Region | null {
  if (!user?.regionSido || !user.regionSigungu) return null;
  return { sido: user.regionSido, sigungu: user.regionSigungu };
}

export function isValidSido(sido: unknown): boolean {
  return typeof sido === "string" && REGIONS.some((r) => r.sido === sido);
}

/**
 * 선택 입력 지역(혈통 산지 등): 시·도만 또는 시·도 + 시·군·구.
 * 둘 다 비면 null, 시·군·구만 오거나 목록 밖 조합·문자열이 아닌 값이면 "invalid". 앞뒤 공백은 지운다.
 */
export function parseOptionalRegion(
  sido: unknown,
  sigungu: unknown
): { sido: string; sigungu: string | null } | null | "invalid" {
  const read = (value: unknown): string | null | "invalid" => {
    if (value === undefined || value === null) return null;
    if (typeof value !== "string") return "invalid";
    return value.trim() || null;
  };
  const s = read(sido);
  const g = read(sigungu);
  if (s === "invalid" || g === "invalid") return "invalid";
  if (!s) return g ? "invalid" : null;
  if (!isValidSido(s)) return "invalid";
  if (g && !isValidRegion(s, g)) return "invalid";
  return { sido: s, sigungu: g };
}

/** 시/도 짧은 이름. 앱 src/constants/regions.ts 와 같은 표. */
const SIDO_SHORT: Record<string, string> = {
  서울특별시: "서울",
  부산광역시: "부산",
  대구광역시: "대구",
  인천광역시: "인천",
  광주광역시: "광주",
  대전광역시: "대전",
  울산광역시: "울산",
  세종특별자치시: "세종",
  경기도: "경기",
  강원특별자치도: "강원",
  충청북도: "충북",
  충청남도: "충남",
  전북특별자치도: "전북",
  전라남도: "전남",
  경상북도: "경북",
  경상남도: "경남",
  제주특별자치도: "제주",
};

/** 특별시·광역시·특별자치시는 구 단위까지 쓰지 않는다. */
const isMetropolitanSido = (sido: string) => /(특별시|광역시|특별자치시)$/.test(sido);

/**
 * 짧은 지역 표시. "충청남도 공주시" → "충남 공주", 특별시·광역시·세종은 시·도 축약만("서울", "세종"),
 * 시·도만 있으면 축약("충남"). 시·군 이름이 시·도 축약과 같으면 한 번만("제주"). 목록 밖 시·도는 받은 그대로.
 * 앱 src/constants/regions.ts 와 같은 함수다.
 */
export function formatRegionShort(
  region: { sido?: string | null; sigungu?: string | null } | null | undefined
): string | null {
  const sido = region?.sido?.trim();
  if (!sido) return null;
  const short = SIDO_SHORT[sido] ?? sido;
  const sigungu = region?.sigungu?.trim();
  if (!sigungu || isMetropolitanSido(sido)) return short;
  const local = sigungu.length > 2 ? sigungu.replace(/(시|군)$/, "") : sigungu;
  return local === short ? short : `${short} ${local}`;
}
