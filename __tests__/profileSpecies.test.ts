import { rankSpecies } from "../libs/server/profileSpecies";
import { BIO_MAX, normalizeBio } from "../libs/shared/profile";

jest.mock("@libs/server/client", () => ({ __esModule: true, default: {} }));

const at = (day: number) => new Date(Date.UTC(2026, 9, day));

describe("rankSpecies (주력 종·종별 앨범 정렬)", () => {
  it("같은 종은 게시글·상품 수를 합친다", () => {
    const ranked = rankSpecies(
      [
        { label: "사슴벌레", count: 2, latestAt: at(1) },
        { label: "장수풍뎅이", count: 3, latestAt: at(2) },
        { label: "사슴벌레", count: 2, latestAt: at(3) },
      ],
      2
    );
    expect(ranked.map((r) => [r.label, r.count])).toEqual([
      ["사슴벌레", 4],
      ["장수풍뎅이", 3],
    ]);
    expect(ranked[0].latestAt).toEqual(at(3));
  });

  it("null·빈 값·community·general·공백만 있는 값은 종으로 세지 않는다", () => {
    const ranked = rankSpecies(
      [
        { label: null, count: 9, latestAt: at(1) },
        { label: "", count: 9, latestAt: at(1) },
        { label: "community", count: 9, latestAt: at(1) },
        { label: "general", count: 9, latestAt: at(1) },
        { label: "  ", count: 9, latestAt: at(1) },
        { label: "베타", count: 1, latestAt: at(1) },
      ],
      5
    );
    expect(ranked.map((r) => r.label)).toEqual(["베타"]);
  });

  it("수가 같으면 최근 사용순, 그래도 같으면 이름순", () => {
    const ranked = rankSpecies(
      [
        { label: "다", count: 1, latestAt: at(1) },
        { label: "나", count: 1, latestAt: at(5) },
        { label: "가", count: 1, latestAt: at(1) },
      ],
      3
    );
    expect(ranked.map((r) => r.label)).toEqual(["나", "가", "다"]);
  });

  it("limit 개만 돌려준다", () => {
    const rows = ["a", "b", "c"].map((label, i) => ({ label, count: 3 - i, latestAt: at(1) }));
    expect(rankSpecies(rows, 2).map((r) => r.label)).toEqual(["a", "b"]);
  });
});

describe("normalizeBio (프로필 소개)", () => {
  it("null·undefined·공백만 있으면 null(지우기)", () => {
    expect(normalizeBio(null)).toEqual({ ok: true, bio: null });
    expect(normalizeBio(undefined)).toEqual({ ok: true, bio: null });
    expect(normalizeBio("  \n  ")).toEqual({ ok: true, bio: null });
  });

  it("앞뒤 공백을 지우고 연속 개행 3개 이상은 2개로 줄인다", () => {
    expect(normalizeBio("  첫 줄  \r\n\n\n\n둘째 줄 \n셋째  ")).toEqual({
      ok: true,
      bio: "첫 줄\n\n둘째 줄\n셋째",
    });
  });

  it("코드포인트 150자는 저장하고 151자는 BIO_TOO_LONG", () => {
    expect(normalizeBio("가".repeat(BIO_MAX))).toEqual({ ok: true, bio: "가".repeat(BIO_MAX) });
    const tooLong = normalizeBio("가".repeat(BIO_MAX + 1));
    expect(tooLong.ok).toBe(false);
    expect(tooLong).toMatchObject({ errorCode: "BIO_TOO_LONG" });
  });

  it("이모지(서로게이트 쌍)는 1자로 센다", () => {
    const emoji = "🦎".repeat(BIO_MAX);
    expect(emoji.length).toBe(BIO_MAX * 2);
    expect(normalizeBio(emoji)).toEqual({ ok: true, bio: emoji });
  });

  it("문자열이 아니면 BIO_INVALID", () => {
    expect(normalizeBio(12)).toMatchObject({ ok: false, errorCode: "BIO_INVALID" });
    expect(normalizeBio({})).toMatchObject({ ok: false, errorCode: "BIO_INVALID" });
  });
});
