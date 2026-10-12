import { fireEvent, render, screen } from "@testing-library/react";
import { HorizontalRail } from "@components/ui/HorizontalRail";

/** jsdom 에 PointerEvent 가 없어 MouseEvent 에 pointerType 을 붙여 보낸다. */
function pointer(target: EventTarget, type: string, clientX: number) {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, clientX, button: 0 });
  Object.defineProperty(event, "pointerType", { value: "mouse" });
  target.dispatchEvent(event);
}

function setup(onClick = jest.fn()) {
  render(
    <HorizontalRail label="레일" data-testid="rail">
      <button type="button" onClick={onClick}>
        카드
      </button>
    </HorizontalRail>
  );
  const rail = screen.getByTestId("rail");
  // jsdom 은 레이아웃이 없어 넘치는 레일 크기를 직접 준다.
  Object.defineProperty(rail, "scrollWidth", { configurable: true, value: 1000 });
  Object.defineProperty(rail, "clientWidth", { configurable: true, value: 390 });
  rail.scrollBy = ((opts: ScrollToOptions) => {
    rail.scrollLeft += opts.left ?? 0;
  }) as typeof rail.scrollBy;
  return { rail, button: screen.getByRole("button", { name: "카드" }), onClick };
}

describe("HorizontalRail(데스크톱 마우스 가로 스크롤)", () => {
  it("마우스로 끌면 scrollLeft 가 바뀌고, 끈 뒤 클릭은 막는다", () => {
    const { rail, button, onClick } = setup();
    pointer(button, "pointerdown", 300);
    pointer(window, "pointermove", 200);
    pointer(window, "pointerup", 200);
    expect(rail.scrollLeft).toBe(100);
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("끌지 않은 클릭(5px 이하)은 그대로 간다", () => {
    const { rail, button, onClick } = setup();
    pointer(button, "pointerdown", 300);
    pointer(window, "pointermove", 297);
    pointer(window, "pointerup", 297);
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(rail.scrollLeft).toBe(0);
  });

  it("세로 휠은 가로로 넘기고, 키보드 → 로도 넘긴다", () => {
    const { rail } = setup();
    fireEvent.wheel(rail, { deltaY: 120, deltaX: 0 });
    expect(rail.scrollLeft).toBe(120);
    fireEvent.keyDown(rail, { key: "ArrowRight" });
    expect(rail.scrollLeft).toBeGreaterThan(120);
    expect(rail).toHaveAttribute("tabindex", "0");
  });
});
