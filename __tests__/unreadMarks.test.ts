import {
  UNREAD_MAX_ENTRIES,
  hasUnreadItems,
  isUnreadItem,
  markSeen,
  parseSeen,
  pruneSeen,
  serializeSeen,
} from "@libs/shared/unread-marks";

/** 앱 src/lib/unread-marks.ts 와 같은 규칙(앱은 scripts/test-unread-marks.mjs). */

const NOW = Date.parse("2026-10-09T12:00:00.000Z");
const DAY = 24 * 60 * 60 * 1000;
const iso = (ms: number) => new Date(ms).toISOString();
const minute = (ms: number) => Math.floor(ms / 60000);

describe("안 본 글 판정", () => {
  it("최근 7일 안 + 기록 없음 + 남의 글이면 안 봄", () => {
    expect(isUnreadItem({ id: 1, createdAt: iso(NOW - DAY), authorId: 2 }, {}, 9, NOW)).toBe(true);
  });

  it("상세를 열어 기록이 있으면 봄", () => {
    const seen = markSeen({}, { id: 1, createdAt: iso(NOW - DAY) }, NOW);
    expect(isUnreadItem({ id: 1, createdAt: iso(NOW - DAY) }, seen, 9, NOW)).toBe(false);
  });

  it("7일이 지난 글은 점이 없다", () => {
    expect(isUnreadItem({ id: 1, createdAt: iso(NOW - 7 * DAY - 1000) }, {}, 9, NOW)).toBe(false);
  });

  it("내가 올린 글은 점이 없다(비로그인은 남의 글로 본다)", () => {
    const item = { id: 1, createdAt: iso(NOW - DAY), authorId: 9 };
    expect(isUnreadItem(item, {}, 9, NOW)).toBe(false);
    expect(isUnreadItem(item, {}, null, NOW)).toBe(true);
  });

  it("시각을 못 읽으면 점이 없다", () => {
    expect(isUnreadItem({ id: 1, createdAt: "not-a-date" }, {}, 9, NOW)).toBe(false);
  });

  it("목록 중 하나라도 안 봤으면 탭 점", () => {
    const seen = markSeen({}, { id: 1, createdAt: iso(NOW - DAY) }, NOW);
    expect(hasUnreadItems([{ id: 1, createdAt: iso(NOW - DAY) }], seen, 9, NOW)).toBe(false);
    expect(
      hasUnreadItems(
        [
          { id: 1, createdAt: iso(NOW - DAY) },
          { id: 2, createdAt: iso(NOW - 2 * DAY) },
        ],
        seen,
        9,
        NOW
      )
    ).toBe(true);
  });
});

describe("기록 저장", () => {
  it("이미 봤거나 7일 지난 글이면 같은 객체(저장 생략)", () => {
    const seen = markSeen({}, { id: 1, createdAt: iso(NOW - DAY) }, NOW);
    expect(markSeen(seen, { id: 1, createdAt: iso(NOW - DAY) }, NOW)).toBe(seen);
    expect(markSeen(seen, { id: 2, createdAt: iso(NOW - 8 * DAY) }, NOW)).toBe(seen);
  });

  it("id → 올린 시각(분)으로 남긴다", () => {
    expect(markSeen({}, { id: 5, createdAt: iso(NOW - DAY) }, NOW)).toEqual({ "5": minute(NOW - DAY) });
  });

  it("7일 지난 기록은 지우고, 최근 것부터 최대 개수만 남긴다", () => {
    const old = { "1": minute(NOW - 8 * DAY) };
    expect(pruneSeen(old, NOW)).toEqual({});
    const many: Record<string, number> = {};
    for (let i = 0; i < UNREAD_MAX_ENTRIES + 5; i += 1) many[String(i)] = minute(NOW - DAY) + i;
    const pruned = pruneSeen(many, NOW);
    expect(Object.keys(pruned)).toHaveLength(UNREAD_MAX_ENTRIES);
    expect(pruned).not.toHaveProperty("0");
    expect(pruned).toHaveProperty(String(UNREAD_MAX_ENTRIES + 4));
  });

  it("최대 개수로 저장해도 2KB 를 넘지 않는다(SecureStore 제한)", () => {
    const many: Record<string, number> = {};
    for (let i = 0; i < UNREAD_MAX_ENTRIES; i += 1) many[String(1_000_000 + i)] = minute(NOW) - i;
    expect(serializeSeen(pruneSeen(many, NOW)).length).toBeLessThan(2048);
  });

  it("깨진 저장값은 빈 기록", () => {
    expect(parseSeen("{oops", NOW)).toEqual({});
    expect(parseSeen("[1,2]", NOW)).toEqual({});
    expect(parseSeen(null, NOW)).toEqual({});
    expect(parseSeen(JSON.stringify({ "3": minute(NOW - DAY), "4": "x" }), NOW)).toEqual({
      "3": minute(NOW - DAY),
    });
  });
});
