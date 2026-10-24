import { getTimeAgoString, makeImageUrl } from "@libs/client/utils";

describe("getTimeAgoString (상품 행 상대시간, 앱 formatRelativeTime 과 같은 문구)", () => {
  const NOW = new Date("2026-10-06T12:00:00.000Z");
  const ago = (ms: number) => new Date(NOW.getTime() - ms);
  const MIN = 60_000;
  const HOUR = 60 * MIN;
  const DAY = 24 * HOUR;

  beforeAll(() => {
    jest.useFakeTimers();
    jest.setSystemTime(NOW);
  });
  afterAll(() => {
    jest.useRealTimers();
  });

  it.each([
    [30_000, "방금 전"],
    [5 * MIN, "5분 전"],
    [3 * HOUR, "3시간 전"],
    [DAY, "하루 전"],
    [2 * DAY, "2일 전"],
    [30 * DAY, "한 달 전"],
    [90 * DAY, "3달 전"],
    [365 * DAY, "일 년 전"],
    [2 * 365 * DAY, "2년 전"],
  ])("%d ms 전 → %s", (ms, expected) => {
    expect(getTimeAgoString(ago(ms))).toBe(expected);
  });
});

describe("makeImageUrl (저장된 사진 주소)", () => {
  it("보호소 공고 사진 같은 http 주소는 https 로 바꿔 그대로 쓰고, Cloudflare id 는 변환 주소로 만든다", () => {
    expect(makeImageUrl("http://www.animal.go.kr/files/a.jpg", "product")).toBe("https://www.animal.go.kr/files/a.jpg");
    expect(makeImageUrl("https://www.animal.go.kr/files/a.jpg")).toBe("https://www.animal.go.kr/files/a.jpg");
    expect(makeImageUrl("abc123", "product")).toBe("https://imagedelivery.net/OvWZrAz6J6K7n9LKUH5pKw/abc123/product");
  });
});
