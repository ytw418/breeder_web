// ============================================================
// 카테고리 시스템
// ============================================================

/** 상품 타입 (생물/용품) */
export const PRODUCT_TYPES = [
  { id: "생물", name: "생물" },
  { id: "용품", name: "용품" },
] as const;

export type ProductType = (typeof PRODUCT_TYPES)[number]["id"];

/** 상품 카테고리 (경매와 동일한 대분류) */
export const CATEGORIES = [
  { id: "곤충", name: "곤충" },
  { id: "파충류", name: "파충류" },
  { id: "어류", name: "어류" },
  { id: "조류", name: "조류" },
  { id: "포유류", name: "포유류" },
  { id: "기타", name: "기타" },
] as const;

export type Category = (typeof CATEGORIES)[number]["id"];

/** 게시글 카테고리 */
export const POST_CATEGORIES = [
  { id: "자유", name: "자유" },
  { id: "질문", name: "질문" },
  { id: "정보", name: "정보" },
  { id: "자랑", name: "자랑" },
  { id: "후기", name: "후기" },
  { id: "사진", name: "사진" },
  { id: "변이", name: "변이" },
] as const;

export type PostCategory = (typeof POST_CATEGORIES)[number]["id"];

/** 상품 상태 */
export const PRODUCT_STATUS = [
  { id: "판매중", name: "판매중" },
  { id: "예약중", name: "예약중" },
  { id: "판매완료", name: "판매완료" },
] as const;

/** 경매 상태 */
export const AUCTION_STATUS = [
  { id: "진행중", name: "진행중" },
  { id: "종료", name: "종료" },
  { id: "유찰", name: "유찰" },
] as const;

export type AuctionStatus = (typeof AUCTION_STATUS)[number]["id"];

/** 기네스북 기록 타입 */
export const RECORD_TYPES = [
  { id: "size", name: "크기 (mm)", unit: "mm" },
  { id: "weight", name: "무게 (g)", unit: "g" },
] as const;

export type RecordType = (typeof RECORD_TYPES)[number]["id"];

// ============================================================
// 기본 상수
// ============================================================

/** 이미지 서버 디폴트 유저 썸네일, 신규 가입시 필요 */
export const DEFAULT_THUMBNAIL_CDN = "";

/** 유저 썸네일에 문제 생겼을 경우 대체 시킬 기본 이미지 (로컬) */
export const DEFAULT_THUMBNAIL_LOCAL = "/images/placeholders/minimal-gray-blur.svg";

/** 이미지에 문제 생겼을 경우 대체 시킬 기본 이미지 (로컬) */
export const DEFAULT_IMAGE_LOCAL = "/images/placeholders/minimal-gray-blur.svg";

export const APP_STORE_URL = "";

export const GOOGLE_PLAY_URL = "";

/** 서비스 정책 문서 */
export const TERMS_OF_SERVICE_URL =
  "https://breeder.notion.site/8a2ca657b9a047498c95ab42ce3d2b75?pvs=74";
export const PRIVACY_POLICY_URL =
  "https://breeder.notion.site/be44680c8d5b43848d0aff25c7c2edba?pvs=74";

export const OS = {
  IOS: "ios",
  ANDROID: "android",
  WEB: "web",
};

export const Provider = {
  APPLE: "apple",
  GOOGLE: "google",
  KAKAO: "kakao",
} as const;

/** iron-session 쿠키 이름 */
export const SESSION_COOKIE_NAME = "kakaoDev";

// 무한스크롤 페이지 사이즈
export const PAGE_SIZE = 30;

export const metaTitleLocale = {
  kr: { locale: "ko_KR" },
  us: { locale: "en_US" },
  jp: { locale: "ja_JP" },
};

export const Role = {
  USER: "USER",
  FAKE_USER: "FAKE_USER",
  ADMIN: "ADMIN",
  SUPER_USER: "SUPER_USER",
};

export const USER_INFO = {
  provider: {
    KAKAO: "kakao",
    APPLE: "apple",
    GOOGLE: "google",
  },
} as const;

export const USERNAME_ADJECTIVES = [
  "대담한",
  "우아한",
  "낙천적인",
  "진중한",
  "활발한",
  "침착한",
  "직선적인",
  "차분한",
  "냉철한",
  "열정적인",
  "쾌활한",
  "온화한",
  "성실한",
  "민감한",
  "강인한",
  "굳센",
  "깨끗한",
  "철저한",
  "겸손한",
  "인내력있는",
  "천재적인",
  "도덕적인",
  "명랑한",
  "상냥한",
  "참을성있는",
  "생기있는",
  "온순한",
  "담백한",
  "능수능란한",
  "낭만적인",
  "논리적인",
  "희극적인",
  "행복한",
  "독립적인",
  "헌신적인",
  "사려깊은",
  "열렬한",
  "대화잘통하는",
  "자신감있는",
  "선명한",
  "엄격한",
  "지루하지않은",
  "창조적인",
  "친절한",
  "신중한",
  "신속한",
  "열심히하는",
  "치밀한",
  "건강한",
  "시원시원한",
  "원만한",
  "재능있는",
  "유능한",
  "지혜로운",
  "남다른",
  "과감한",
  "빠른",
  "명확한",
  "분별력있는",
  "깔끔한",
  "현명한",
  "능력있는",
  "전문적인",
  "참신한",
  "눈치가빠른",
  "미묘한",
  "순발력있는",
  "실용적인",
  "감각적인",
  "자비로운",
  "용감한",
  "명료한",
  "긍정적인",
  "당당한",
  "단호한",
  "태평한",
  "성취지향적인",
  "자상한",
  "천진난만한",
  "명상적인",
  "불굴의",
  "기민한",
  "외향적인",
  "내성적인",
  "기쁨을주는",
  "격렬한",
  "재치있는",
  "교양있는",
  "발랄한",
  "부드러운",
  "흥미로운",
  "창의적인",
  "노력하는",
  "집중력있는",
  "세심한",
  "당찬",
  "고운",
  "영감을주는",
  "소박한",
  "완벽주의적인",
  "터프한",
  "따뜻한",
  "고집센",
  "비판적인",
  "귀여운",
  "균형잡힌",
  "정직한",
  "통찰력있는",
  "깊이있는",
  "애정있는",
  "유쾌한",
  "열심인",
  "자유로운",
  "명석한",
  "개성있는",
  "몰입하는",
  "예의바른",
  "완벽주의자",
  "신뢰할수있는",
  "탐구심이강한",
  "도전적인",
  "공감능력있는",
  "진취적인",
  "카리스마있는",
  "소심한",
  "근면한",
  "시간관념이있는",
  "사랑스러운",
  "융통성있는",
  "친화력있는",
  "협력적인",
  "적극적인",
  "섬세한",
  "타인을존중하는",
  "날카로운",
  "유연한",
  "예리한",
];
export const USERNAME_PRONOUNS = [
  "개",
  "고양이",
  "사자",
  "호랑이",
  "사슴",
  "엘크",
  "비둘기",
  "원숭이",
  "여우",
  "늑대",
  "토끼",
  "곰",
  "햄스터",
  "펭귄",
  "바다거북",
  "뱀",
  "오리",
  "소",
  "말",
  "양",
  "쥐",
  "토둥이",
  "곤충",
  "악어",
  "다람쥐",
  "청어랑",
  "불가사리",
  "해파리",
  "멧돼지",
  "복어",
  "천둥이",
  "물개",
  "돌고래",
  "갈매기",
  "나비",
  "앵무새",
  "벌",
  "나무늘보",
  "참새",
  "하마",
  "물소",
  "고래",
  "선인장",
  "소나무",
  "대나무",
  "미나리",
  "토마토",
  "감자",
  "양파",
  "마늘",
  "팥",
  "대추",
  "참외",
  "딸기",
  "산딸기",
  "포도",
  "오이",
  "호박",
  "콩",
  "밤",
  "감",
  "레몬",
  "키위",
  "자몽",
  "석류",
  "파인애플",
  "블루베리",
  "라즈베리",
  "카카오",
  "커피",
  "차",
  "화분",
  "병아리꽃",
  "자스민",
  "라벤더",
  "코스모스",
  "장미",
  "해바라기",
  "산수유",
  "외나무",
  "느티나무",
  "물방울꽃",
  "카네이션",
  "데이지",
  "억새",
  "밤나무",
  "나무꾼",
  "국화",
  "연꽃",
  "쑥",
  "마늘쫑",
  "호박씨",
  "아보카도",
  "밍크",
  "키다리",
  "꿀벌",
  "노새",
  "백조",
  "불개미",
  "뱀파이어",
  "바다표범",
  "느릅나무",
  "뱀눈여우",
  "사자머리",
  "말벌",
  "블랙핑크",
  "곰팡이",
  "문어",
  "애벌레",
  "코끼리",
  "장수말벌",
  "반딧불이",
  "금강산",
  "까치",
  "왕조기",
  "꿩잡이개",
  "미어캣",
  "파랑새",
  "밀웜",
  "올빼미",
  "아마몬드",
  "청둥오리",
  "고래상어",
  "미어",
  "개구리",
  "붉은여우",
  "밤나방",
  "달팽이",
  "구렁이",
  "고슴도치",
  "무당벌레",
  "벌새",
  "솔개구리",
  "문어구이",
  "두꺼비",
  "오소리",
  "호랑나비",
  "비단뱀",
  "산소나무",
  "아나콘다",
  "푸들",
  "버섯",
  "밤바다",
  "독수리",
  "참고래",
  "송아지",
  "거위",
  "눈토끼",
  "불독",
  "쥐돌이",
  "천리안",
  "사슴벌레",
  "거북이",
  "진드기",
  "소금쟁이",
  "벌레",
  "개미핥기",
  "늙은이",
  "팬더",
];
