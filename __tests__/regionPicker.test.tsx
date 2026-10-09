import type { ReactNode } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";

const mockUseUser = jest.fn();
const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn() };
const mockAuthFetch = jest.fn();

// jest 설정에 hooks/ 별칭이 없어 가상 모듈로 막는다.
jest.mock(
  "hooks/useUser",
  () => ({ __esModule: true, default: () => mockUseUser() }),
  { virtual: true }
);
jest.mock("next/navigation", () => ({ useRouter: () => mockRouter }));
jest.mock("swr", () => ({ useSWRConfig: () => ({ cache: new Map(), mutate: jest.fn() }) }));
jest.mock("@components/features/MainLayout", () => ({
  __esModule: true,
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
jest.mock("@libs/client/authFetch", () => ({ authFetch: (...args: unknown[]) => mockAuthFetch(...args) }));
jest.mock("@libs/client/locateRegion", () => ({ isLocateAvailable: () => false, locateRegion: jest.fn() }));
jest.mock("@libs/client/toast", () => ({ toast: { error: jest.fn() } }));

import RegionPicker from "@components/features/region/RegionPicker";

const DRAFT_KEY = "bredy:region-draft";

const okResponse = () => ({ ok: true, json: async () => ({ success: true }) });
const postedBodies = () =>
  mockAuthFetch.mock.calls.map(([, init]) => JSON.parse((init as { body: string }).body));
const toggle = () => screen.getByRole("switch", { name: "동네 브리더에 나를 표시" });
const doneButton = () => screen.getByRole("button", { name: "완료" });

beforeEach(() => {
  jest.clearAllMocks();
  window.sessionStorage.clear();
  mockAuthFetch.mockResolvedValue(okResponse());
});

describe("내 동네 화면(완료로 저장)", () => {
  it("동네가 없으면 완료를 못 누르고 나를 표시도 꺼져 보인다", () => {
    mockUseUser.mockReturnValue({ user: { id: 1 }, mutate: jest.fn() });
    render(<RegionPicker />);
    expect(screen.getByText("설정 안 함")).toBeTruthy();
    expect((doneButton() as HTMLButtonElement).disabled).toBe(true);
    expect(toggle().getAttribute("aria-checked")).toBe("false");
  });

  it("시/군/구 화면에서 고르고 돌아오면 그 동네를 보여 주고, 처음 정하는 동네는 나를 표시가 켜져 있다", async () => {
    mockUseUser.mockReturnValue({ user: { id: 1 }, mutate: jest.fn() });
    window.sessionStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({ picked: true, region: { sido: "서울특별시", sigungu: "강남구" } })
    );
    render(<RegionPicker />);
    expect(await screen.findByText("서울특별시 강남구")).toBeTruthy();
    expect(toggle().getAttribute("aria-checked")).toBe("true");
    expect(mockAuthFetch).not.toHaveBeenCalled();
    expect(window.sessionStorage.getItem(DRAFT_KEY)).toBeNull();
  });

  it("완료를 누르면 동네와 나를 표시를 한 번에 저장하고 이전 화면으로 돌아간다", async () => {
    const mutate = jest.fn();
    mockUseUser.mockReturnValue({ user: { id: 1 }, mutate });
    window.sessionStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({ picked: true, region: { sido: "서울특별시", sigungu: "강남구" } })
    );
    render(<RegionPicker />);
    await screen.findByText("서울특별시 강남구");
    await act(async () => {
      fireEvent.click(doneButton());
    });
    expect(postedBodies()).toEqual([{ regionSido: "서울특별시", regionSigungu: "강남구", regionVisible: true }]);
    expect(mutate).toHaveBeenCalled();
    await waitFor(() => expect(mockRouter.back.mock.calls.length + mockRouter.replace.mock.calls.length).toBe(1));
  });

  it("이미 동네가 있으면 저장된 나를 표시 값을 그대로 보여 주고, 바꾼 게 없으면 저장 없이 돌아간다", async () => {
    mockUseUser.mockReturnValue({
      user: { id: 1, regionSido: "경기도", regionSigungu: "성남시", regionVisible: false },
      mutate: jest.fn(),
    });
    render(<RegionPicker />);
    expect(screen.getByText("경기도 성남시")).toBeTruthy();
    expect(toggle().getAttribute("aria-checked")).toBe("false");
    await act(async () => {
      fireEvent.click(doneButton());
    });
    expect(mockAuthFetch).not.toHaveBeenCalled();
    expect(mockRouter.back.mock.calls.length + mockRouter.replace.mock.calls.length).toBe(1);
  });

  it("나를 표시만 바꾸면 그 값만 저장한다", async () => {
    mockUseUser.mockReturnValue({
      user: { id: 1, regionSido: "경기도", regionSigungu: "성남시", regionVisible: false },
      mutate: jest.fn(),
    });
    render(<RegionPicker />);
    fireEvent.click(toggle());
    expect(mockAuthFetch).not.toHaveBeenCalled();
    await act(async () => {
      fireEvent.click(doneButton());
    });
    expect(postedBodies()).toEqual([{ regionVisible: true }]);
  });
});

describe("시/군/구 고르기", () => {
  it("고르면 저장하지 않고 고른 동네를 들고 내 동네 화면으로 돌아간다", () => {
    mockUseUser.mockReturnValue({ user: { id: 1 }, mutate: jest.fn() });
    window.sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ viaHome: true, visible: false }));
    render(<RegionPicker sido="서울특별시" />);
    fireEvent.click(screen.getByRole("button", { name: "서울특별시 마포구" }));
    expect(mockAuthFetch).not.toHaveBeenCalled();
    expect(JSON.parse(window.sessionStorage.getItem(DRAFT_KEY) ?? "null")).toEqual({
      viaHome: true,
      visible: false,
      picked: true,
      region: { sido: "서울특별시", sigungu: "마포구" },
    });
    expect(mockRouter.back).toHaveBeenCalledTimes(1);
  });

  it("주소로 바로 들어왔으면 뒤로 가지 않고 내 동네 화면으로 바꾼다", () => {
    mockUseUser.mockReturnValue({ user: { id: 1 }, mutate: jest.fn() });
    render(<RegionPicker sido="서울특별시" />);
    fireEvent.click(screen.getByRole("button", { name: "서울특별시 마포구" }));
    expect(mockRouter.back).not.toHaveBeenCalled();
    expect(mockRouter.replace).toHaveBeenCalledWith("/settings/region");
  });

  it("내 동네 화면에서 고르던 시/군/구에 표시한다", () => {
    mockUseUser.mockReturnValue({ user: { id: 1 }, mutate: jest.fn() });
    render(<RegionPicker sido="서울특별시" selected="송파구" />);
    expect(screen.getByRole("button", { name: "서울특별시 송파구" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "서울특별시 강남구" }).getAttribute("aria-pressed")).toBe("false");
  });
});
