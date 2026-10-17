import { formatKakaoDigest, KAKAO_DIGEST_ROOMS } from "@libs/shared/kakaoDigest";

const room = KAKAO_DIGEST_ROOMS[0];
// 2026-10-15 09:00 KST
const now = new Date("2026-10-15T00:00:00Z");

describe("formatKakaoDigest", () => {
  it("섹션별 항목·한국 시각 마감·utm 링크를 만든다", () => {
    const text = formatKakaoDigest(
      room,
      {
        endingAuctions: [
          { id: 7, title: "릴리화이트 해츨링", currentPrice: 120000, endAt: "2026-10-15T12:00:00Z" },
        ],
        newProducts: [{ id: 3, name: "할리퀸 아성체", price: 0, dealType: "adoption", location: "부천" }],
        newProductCount: 4,
        openQuestions: [{ id: 9, title: "슈퍼푸드 급여 주기" }],
        popularPosts: [],
      },
      now
    );

    expect(text).toContain("🦎 오늘의 크레 소식 10/15 (목)");
    expect(text).toContain("· 릴리화이트 해츨링 — 현재 120,000원, 오후 9시 마감");
    expect(text).toContain("🆕 새 분양글 4개");
    expect(text).toContain("· 할리퀸 아성체 — 무료 분양 (부천)");
    expect(text).toContain("https://bredy.app/auctions/7?utm_source=kakao&utm_medium=openchat&utm_campaign=crested");
    expect(text).not.toContain("많이 본 이야기");
    expect(text).not.toContain("조용하네요");
  });

  it("소식이 없는 날은 빈 섹션 대신 안내 문구를 낸다", () => {
    const text = formatKakaoDigest(
      room,
      { endingAuctions: [], newProducts: [], newProductCount: 0, openQuestions: [], popularPosts: [] },
      now
    );
    expect(text).toContain("오늘은 크레 소식이 조용하네요.");
    expect(text).not.toContain("🆕");
  });
});
