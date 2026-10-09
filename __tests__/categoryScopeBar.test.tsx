import { act, render, screen } from "@testing-library/react";

// jest 설정에 hooks/ 별칭이 없어 가상 모듈로 막는다. 라벨·고정 목록만 쓴다.
jest.mock(
  "hooks/useCategoryScope",
  () => ({ __esModule: true, default: () => ({ label: "전체 보기", pins: [] }) }),
  { virtual: true }
);

import CategoryScopeBar from "@components/features/category/CategoryScopeBar";
import {
  CATEGORY_SCOPE_ONBOARDED_KEY,
  markCategoryOnboardingDone,
  resetCategoryScopeForTest,
  restoreCategoryScope,
} from "@libs/client/categoryScope";

beforeEach(() => {
  window.localStorage.clear();
  resetCategoryScopeForTest();
});

describe("홈 관심 분야 바(2026-10-09: 온보딩을 마치면 숨김)", () => {
  it("브라우저 저장값을 읽기 전에는 그리지 않는다(마친 사용자에게 잠깐 비치지 않게)", () => {
    const { container } = render(<CategoryScopeBar />);
    expect(container.firstChild).toBeNull();
  });

  it("온보딩 전이면 '전체 보기 · 고정하기' 바를 보여 준다", () => {
    act(() => {
      restoreCategoryScope();
    });
    render(<CategoryScopeBar />);
    const bar = screen.getByRole("link", { name: "관심 분야 전체 보기, 바꾸기" });
    expect(bar.getAttribute("href")).toBe("/settings/categories");
    expect(screen.getByText("고정하기")).toBeTruthy();
  });

  it("온보딩을 마친 브라우저면 그리지 않는다", () => {
    window.localStorage.setItem(CATEGORY_SCOPE_ONBOARDED_KEY, "1");
    act(() => {
      restoreCategoryScope();
    });
    const { container } = render(<CategoryScopeBar />);
    expect(container.firstChild).toBeNull();
  });

  it("보고 있는 중에 온보딩을 마치면 바로 사라진다", () => {
    act(() => {
      restoreCategoryScope();
    });
    const { container } = render(<CategoryScopeBar />);
    expect(screen.getByText("고정하기")).toBeTruthy();

    act(() => {
      markCategoryOnboardingDone();
    });
    expect(container.firstChild).toBeNull();
  });
});
