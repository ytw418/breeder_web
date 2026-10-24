# 강아지·고양이 공간 웹 E2E TC (PRD docs/prd/pet-space.md §11)

스펙: `e2e/pet-space.spec.ts`, 설정: `playwright.pet.config.ts`(localhost:3010 dev 서버에 붙음, iPhone 13).
쓰기 요청(POST /api/users/me 등)은 가로채고, 목록 GET 은 가짜 데이터로 그린다. 로그인은 dev 테스트 계정('초보집사민').

| TC | AC | 전제 | 절차 | 기대 | 결과 |
|---|---|---|---|---|---|
| TC-01 | AC-1 | pins·onboarded 없음 | 홈 열기 | '어떤 아이를 키우시나요?' 카드 8+'아직 없어요', '포유류' 없음 | 통과 |
| TC-02 | AC-1 | onboarded=1, pins 없음 | 홈 열기 | 팝업 뜸 | 통과 |
| TC-03 | AC-1 | 없음 | 건너뛰기 → 새로고침 | 같은 탭에서 다시 안 뜸 | 통과 |
| TC-04 | AC-1 | 없음 | 강아지·고양이 → '2개 고르고 시작하기' → 새로고침 | 닫힘·홈 유지·pins 저장·다시 안 뜸 | 통과 |
| TC-05 | AC-1 | pins=강아지 | 홈 | 안 뜸 | 통과 |
| TC-06 | AC-1 | 없음 | 강아지 → '아직 없어요' | 선택 풀림, 'pins=[]' | 통과 |
| TC-07~10 | AC-2·5 | pins 조합 | /products | 분양·입양 / 분양·경매·입양 / 분양·경매 / 전체=분양·경매 | 통과 |
| TC-11 | AC-3 | 강아지·고양이 | /adoption | 임보 레일·가족을 기다려요·종 칩 | 통과 |
| TC-12 | AC-3·16 | 〃 | 레일 '전체 ›' | /adoption/foster | 통과 |
| TC-13 | AC-16 | 〃 | /products | 가격 없음·정보 한 줄·행 148(링크147+선 1) | 통과 |
| TC-14 | AC-2 | 〃 | '입양' 칸 | /adoption | 통과 |
| TC-15 | AC-6·13 | 〃 | 메뉴 공간 카드→시트→소동물… | 바로 바뀌고 닫힘, 입양 칸 사라짐 | 통과 |
| TC-16 | AC-6 | /adoption | 공간을 바꿈 | /products 로 이동 | 통과 |
| TC-17 | AC-4·14 | 로그인 | 글쓰기 ①②③, 종·기간 없이 다음, 뒤로가기 | 가격 칸 없음, 칸 아래 오류, 내용 유지 | 통과 |
| TC-18 | AC-14·15 | 로그인 | ?kind=adoption | ②부터, 동의 문구 글 종류별 | 통과 |
| - | AC-12 | | 좌우 스와이프 | | 수동 확인 필요 |
| - | AC-9·10·11·13 | | 신고 시트·다른 분야 글·동네·임보 상세 | 상세/피드 가짜 응답 필요 | 보류 (AC-9 reportApi·sanctionShared, AC-10 homeOtherPetsFeed 단위 테스트) |
| - | AC-7·17·18 | | 서버 400 규칙 | | 단위 테스트 대체 (productApi, productRules, petSpace .test.ts) |
| - | AC-8·19 | | PostHog·앱 쿠팡 | | 웹 불가(앱 전용·측정) |
