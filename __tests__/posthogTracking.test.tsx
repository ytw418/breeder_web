import { act, render } from "@testing-library/react";
import { useRef } from "react";
import {
  POSTHOG_INIT_OPTIONS,
  POSTHOG_STUB_METHODS,
  identifyPosthogUser,
  isExpectedAuthStatus,
  resetPosthogUser,
} from "@libs/client/posthog";
import useSectionImpressions from "@/hooks/useSectionImpressions";

type PostHogMock = {
  capture: jest.Mock;
  identify: jest.Mock;
  reset: jest.Mock;
  get_distinct_id?: jest.Mock;
};

const setPostHog = (posthog: PostHogMock | undefined) => {
  (window as Window & { posthog?: PostHogMock }).posthog = posthog;
};

afterEach(() => setPostHog(undefined));

describe("PostHog 설정", () => {
  it("웹 안 화면 이동(history 변경)도 페이지뷰로 센다", () => {
    expect(POSTHOG_INIT_OPTIONS.capture_pageview).toBe("history_change");
  });

  it("스크립트가 뜨기 전에 부른 identify 도 큐에 쌓이도록 stub 에 넣는다", () => {
    expect(POSTHOG_STUB_METHODS.split(" ")).toEqual(expect.arrayContaining(["identify", "reset"]));
  });

  it("비로그인 401 만 정상 응답으로 보고 오류로 보내지 않는다", () => {
    expect(isExpectedAuthStatus(401)).toBe(true);
    expect(isExpectedAuthStatus(403)).toBe(false);
    expect(isExpectedAuthStatus(500)).toBe(false);
    expect(isExpectedAuthStatus(undefined)).toBe(false);
  });
});

describe("로그인 사용자 식별", () => {
  it("사용자 id 를 문자열로 identify 하고 속성을 같이 넘긴다", () => {
    const posthog = { capture: jest.fn(), identify: jest.fn(), reset: jest.fn() };
    setPostHog(posthog);
    expect(identifyPosthogUser(12, { is_admin: false })).toBe(true);
    expect(posthog.identify).toHaveBeenCalledWith("12", { is_admin: false });
  });

  it("이미 같은 id 로 식별돼 있으면 다시 보내지 않는다(페이지마다 $set 이 쌓이지 않게)", () => {
    const posthog = {
      capture: jest.fn(),
      identify: jest.fn(),
      reset: jest.fn(),
      get_distinct_id: jest.fn(() => "12"),
    };
    setPostHog(posthog);
    expect(identifyPosthogUser(12, { is_admin: false })).toBe(true);
    expect(posthog.identify).not.toHaveBeenCalled();
  });

  it("로그아웃하면 reset 으로 다음 방문자와 섞이지 않게 한다", () => {
    const posthog = { capture: jest.fn(), identify: jest.fn(), reset: jest.fn() };
    setPostHog(posthog);
    resetPosthogUser();
    expect(posthog.reset).toHaveBeenCalledTimes(1);
  });

  it("PostHog 가 없으면 아무 일도 하지 않는다", () => {
    expect(identifyPosthogUser(1)).toBe(false);
    expect(() => resetPosthogUser()).not.toThrow();
  });
});

describe("홈 섹션 노출(useSectionImpressions)", () => {
  let observed: Element[] = [];
  let fire: (targets: Element[]) => void = () => {};

  beforeEach(() => {
    observed = [];
    class MockIntersectionObserver {
      constructor(callback: IntersectionObserverCallback) {
        fire = (targets) =>
          callback(
            targets.map((target) => ({ target, isIntersecting: true }) as IntersectionObserverEntry),
            this as unknown as IntersectionObserver
          );
      }
      observe(el: Element) {
        if (!observed.includes(el)) observed.push(el);
      }
      unobserve(el: Element) {
        observed = observed.filter((item) => item !== el);
      }
      disconnect() {
        observed = [];
      }
    }
    (window as unknown as { IntersectionObserver: unknown }).IntersectionObserver = MockIntersectionObserver;
  });

  function Home({ onSeen, showLate = false }: { onSeen: (id: string) => void; showLate?: boolean }) {
    const rootRef = useRef<HTMLDivElement>(null);
    useSectionImpressions(rootRef, onSeen);
    return (
      <div ref={rootRef}>
        <section data-home-section="hero_breeder" />
        <section data-home-section="free_giveaway" />
        {showLate ? <section data-home-section="neighborhood_breeders" /> : null}
      </div>
    );
  }

  const section = (id: string) => document.querySelector(`[data-home-section="${id}"]`) as Element;

  it("화면에 들어온 섹션만, 섹션마다 한 번만 기록한다", () => {
    const onSeen = jest.fn();
    render(<Home onSeen={onSeen} />);
    expect(onSeen).not.toHaveBeenCalled();

    act(() => fire([section("free_giveaway")]));
    act(() => fire([section("free_giveaway")]));
    expect(onSeen).toHaveBeenCalledTimes(1);
    expect(onSeen).toHaveBeenCalledWith("free_giveaway");
  });

  it("나중에 그려진 섹션(동네 브리더처럼 따로 불러오는 것)도 지켜본다", async () => {
    const onSeen = jest.fn();
    const { rerender } = render(<Home onSeen={onSeen} />);
    rerender(<Home onSeen={onSeen} showLate />);
    // MutationObserver 콜백은 마이크로태스크로 돈다.
    await act(async () => {});
    expect(observed).toContain(section("neighborhood_breeders"));

    act(() => fire([section("neighborhood_breeders")]));
    expect(onSeen).toHaveBeenCalledWith("neighborhood_breeders");
  });
});
