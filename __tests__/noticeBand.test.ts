import { noticeBandTitle, pickBandNotice } from "@libs/shared/noticeBand";

// 앱 scripts/web-tests/noticeBand.test.ts 와 같은 파일(앱 사본 src/lib/noticeBand.ts 를 같은 입력으로 본다).
const NOW = Date.parse("2026-10-21T03:00:00.000Z");
const DAY = 24 * 60 * 60 * 1000;
const notice = (id: number, daysAgo: number, title = `공지 ${id}`) => ({
  id,
  title,
  createdAt: new Date(NOW - daysAgo * DAY).toISOString(),
});

describe("홈 공지 띠(home-ia S-1, 감사 #5)", () => {
  it("14일 안·안 읽은 공지만 고르고, 제목은 [공지]·이모지를 떼고 한국 날짜를 붙인다", () => {
    const list = [notice(30, 1), notice(20, 3), notice(10, 20)];
    const none = { seenUpToId: null, isSeen: () => false };
    expect(pickBandNotice(list, none, NOW)?.id).toBe(30);
    // 띠에서 30번을 열었으면 그 이하는 본 것, 상세를 연 기록(unread-marks)도 숨긴다.
    expect(pickBandNotice(list, { seenUpToId: 30, isSeen: () => false }, NOW)).toBeNull();
    expect(pickBandNotice(list, { seenUpToId: null, isSeen: (id) => id === 30 }, NOW)?.id).toBe(20);
    // 14일 지난 공지는 띠에 두지 않는다.
    expect(pickBandNotice([notice(10, 20)], none, NOW)).toBeNull();
    // 2026-10-19T16:30Z 는 한국 10월 20일.
    expect(noticeBandTitle("[공지] 📢 브리디 앱 출시 안내 🎉", "2026-10-19T16:30:00.000Z")).toBe(
      "브리디 앱 출시 안내 · 10.20"
    );
  });
});
