/**
 * 첫 상시 토론 주제(앱 docs/prd/evergreen-debate.md §4.3, 2026-10-22 사용자 예시 + 제안 2개).
 * 관리자 '첫 주제 열기' 버튼이 이 목록 중 아직 없는 것만 연다. 질문 40자·선택지 12자 이내.
 */
export interface EvergreenTopic {
  title: string;
  description: string;
  optionA: string;
  optionB: string;
  field: string;
  order?: number;
}

export const EVERGREEN_STARTER_TOPICS: EvergreenTopic[] = [
  {
    field: "aquarium",
    order: 0,
    title: "무환수 어항, 정말 가능하다?",
    description: "물을 갈지 않고 수초·생물 균형만으로 오래 유지하는 어항, 해 보신 분들 경험을 들려주세요.",
    optionA: "가능하다",
    optionB: "불가능하다",
  },
  {
    field: "aquarium",
    order: 1,
    title: "수초 어항에 CO2, 꼭 필요하다?",
    description: "CO2 없이도 수초가 잘 자란다는 분과 꼭 넣어야 한다는 분, 어느 쪽인가요?",
    optionA: "필요하다",
    optionB: "없어도 된다",
  },
  {
    field: "insect",
    order: 0,
    title: "극태, 외국 혈통 교잡이다?",
    description: "극태 개체가 외국 혈통과 섞였다는 이야기, 어떻게 보세요? 특정 분양자를 지목하는 댓글은 가려져요.",
    optionA: "교잡이다",
    optionB: "아니다",
  },
  {
    field: "reptile",
    order: 0,
    title: "지정관리 야생동물(화이트리스트) 제도, 찬성?",
    description: "야생생물법 개정으로 지정관리 야생동물 목록에 든 종만 수입·분양할 수 있게 한 제도, 어떻게 보세요?",
    optionA: "찬성",
    optionB: "반대",
  },
  {
    field: "reptile",
    order: 1,
    title: "파충류 인식, 이게 제일 효과 있다?",
    description: "파충류를 무섭거나 낯설게 보는 시선, 무엇이 가장 잘 바꿀까요?",
    optionA: "체험 행사",
    optionB: "SNS 콘텐츠",
  },
  {
    field: "hamster",
    order: 0,
    title: "햄스터 합사, 해도 된다?",
    description: "어릴 때부터 같이 지낸 형제는 괜찮다는 분과 절대 안 된다는 분, 어느 쪽인가요?",
    optionA: "된다",
    optionB: "안 된다",
  },
  {
    field: "all",
    order: 0,
    title: "펫샵은 다 나쁜 걸까?",
    description: "관리가 좋은 곳도 있다는 분과 구조 자체가 문제라는 분, 생각을 나눠 주세요.",
    optionA: "그렇다",
    optionB: "아니다",
  },
  {
    field: "all",
    order: 1,
    title: "'보호소' 간판 단 유료 입양처, 신종 펫샵이다?",
    description: "보호소·파양 센터라는 이름으로 돈을 받고 입양을 보내는 곳, 어떻게 보세요?",
    optionA: "그렇다",
    optionB: "아니다",
  },
];
