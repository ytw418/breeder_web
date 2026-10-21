import { clampScrollY, FAB_SCROLL_INITIAL, nextFabScroll } from "@libs/shared/fabScroll";

// 앱 scripts/web-tests/fabScroll.test.ts 와 같은 파일(앱 사본 src/lib/fabScroll.ts 를 같은 입력으로 본다).
describe("목록 FAB 숨김(2026-10-21 디자인 리뷰)", () => {
  it("아래로 내리면 숨고, 작은 흔들림은 무시하며, 위로 올리거나 맨 위로 오면 다시 보인다", () => {
    const down = nextFabScroll(nextFabScroll(FAB_SCROLL_INITIAL, 40), 200);
    expect(down.hidden).toBe(true);
    // 8 미만 움직임은 방향으로 치지 않는다(같은 상태 그대로).
    expect(nextFabScroll(down, 195)).toBe(down);
    expect(nextFabScroll(down, 180).hidden).toBe(false);
    expect(nextFabScroll({ y: 300, hidden: true }, 10).hidden).toBe(false);
    // iOS 바운스(음수·끝 넘김)는 0~끝으로 자른다.
    expect(clampScrollY(-30, 2000, 800)).toBe(0);
    expect(clampScrollY(1300, 2000, 800)).toBe(1200);
  });
});
