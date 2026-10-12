import { act, fireEvent, render, screen } from "@testing-library/react";
import CelebrateSheet, {
  CELEBRATE_AUTO_CLOSE_MS,
  celebrateFact,
  celebrateTitle,
} from "@components/features/celebrate/CelebrateSheet";

describe("글 등록 보상 시트(community-vibe §3.4)", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it("'반려생활 234번째 글'과 사실 한 줄을 보이고 0.8초 뒤 저절로 닫힌다", () => {
    const onDone = jest.fn();
    render(<CelebrateSheet open kind="post" celebrate={{ ordinal: 234, fact: "구로구 첫 글" }} onDone={onDone} />);
    expect(screen.getByText("반려생활 234번째 글")).toBeInTheDocument();
    expect(screen.getByText("구로구 첫 글")).toBeInTheDocument();
    act(() => {
      jest.advanceTimersByTime(CELEBRATE_AUTO_CLOSE_MS - 1);
    });
    expect(onDone).not.toHaveBeenCalled();
    act(() => {
      jest.advanceTimersByTime(1);
    });
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(CELEBRATE_AUTO_CLOSE_MS).toBe(800);
  });

  it("누르면 바로 닫히고, 타이머가 지나도 한 번만 부른다", () => {
    const onDone = jest.fn();
    render(<CelebrateSheet open kind="product" celebrate={{ ordinal: 12, fact: null }} onDone={onDone} />);
    fireEvent.click(screen.getByTestId("celebrate-sheet"));
    act(() => {
      jest.advanceTimersByTime(CELEBRATE_AUTO_CLOSE_MS * 2);
    });
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("종류별 제목과 기본 사실 문구", () => {
    expect(celebrateTitle("product", 12)).toBe("브리디 12번째 분양글");
    expect(celebrateFact("product", null)).toBe("홈 '지금 올라온 분양'에 바로 보여요");
    expect(celebrateFact("post", "오늘 첫 글")).toBe("오늘 첫 글");
  });
});
