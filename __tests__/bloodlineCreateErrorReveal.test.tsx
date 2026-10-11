import { useEffect, type ReactNode } from "react";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { SWRConfig } from "swr";

/**
 * 혈통 만들기 오류 칸 보이기(2026-10-11 제보 "혈통 등록이 안 된다").
 * 폰에서 아래까지 채운 뒤 하단 고정 '혈통 만들기'를 누르면 이름 칸 오류(규칙·중복)가 화면 위로 벗어나
 * 눌러도 아무 반응이 없는 것처럼 보였다. 오류가 난 첫 칸을 화면 안으로 올리는지 본다.
 */

const mockUseUser = jest.fn();
const mockAuthFetch = jest.fn();
const mockReplace = jest.fn();
jest.mock(
  "hooks/useUser",
  () => ({ __esModule: true, default: () => mockUseUser() }),
  {
    virtual: true,
  },
);
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), replace: mockReplace, back: jest.fn() }),
}));
jest.mock("@libs/client/authFetch", () => ({
  authFetch: (...args: unknown[]) => mockAuthFetch(...args),
}));
jest.mock("@libs/client/toast", () => ({
  toast: { success: jest.fn(), error: jest.fn(), info: jest.fn() },
}));
jest.mock("@components/features/MainLayout", () => ({
  __esModule: true,
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  toLoginHref: (next: string) => `/login?next=${encodeURIComponent(next)}`,
}));
// 자르기 창은 canvas 가 없는 jsdom 에서 그릴 수 없다 → 고른 파일을 바로 넘긴다.
jest.mock("@components/features/bloodline/SquareImageCropper", () => ({
  __esModule: true,
  default: function MockCropper({
    file,
    onDone,
  }: {
    file: File;
    onDone: (file: File) => void;
  }) {
    useEffect(() => onDone(file), [file, onDone]);
    return null;
  },
}));

import BloodlineCardCreateClient from "../app/(web)/bloodline-cards/create/BloodlineCardCreateClient";

const categories = [
  {
    id: 3,
    name: "파충류",
    slug: "reptile",
    parentId: null,
    path: "/reptile/",
    sortOrder: 3,
  },
  {
    id: 31,
    name: "크레스티드 게코",
    slug: "crested",
    parentId: 3,
    path: "/reptile/crested/",
    sortOrder: 1,
  },
];

const jsonResponse = (status: number, body: unknown) =>
  ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }) as Response;

/** scrollIntoView 를 부른 요소(jsdom 에는 구현이 없다). */
let scrolled: Element[] = [];

beforeEach(() => {
  scrolled = [];
  mockUseUser.mockReturnValue({
    user: { id: 1, name: "테스터" },
    isLoading: false,
  });
  mockAuthFetch.mockReset();
  mockReplace.mockReset();
  Element.prototype.scrollIntoView = function scrollIntoView(this: Element) {
    scrolled.push(this);
  };
  URL.createObjectURL = jest.fn(() => "blob:preview");
  URL.revokeObjectURL = jest.fn();
});

const renderForm = () =>
  render(
    <SWRConfig
      value={{
        provider: () => new Map(),
        dedupingInterval: 0,
        fetcher: async () => ({ success: true, categories }),
      }}
    >
      <BloodlineCardCreateClient />
    </SWRConfig>,
  );

const nameInput = () => screen.getByLabelText("혈통 이름") as HTMLInputElement;
const scrolledTo = (node: Element) =>
  scrolled.some((target) => target.contains(node));

async function pickSpecies() {
  await waitFor(() =>
    expect(screen.getByRole("option", { name: "파충류" })).toBeTruthy(),
  );
  fireEvent.change(screen.getByLabelText("분류"), {
    target: { value: "파충류" },
  });
  fireEvent.change(screen.getByLabelText("종"), {
    target: { value: "크레스티드 게코" },
  });
}

async function pickPhoto() {
  mockAuthFetch.mockImplementation(async (url: string) => {
    if (url === "/api/files")
      return jsonResponse(200, {
        success: true,
        id: "u1",
        uploadURL: "https://upload.test/u1",
      });
    throw new Error(`unexpected ${url}`);
  });
  const upload = jest.fn(async () =>
    jsonResponse(200, { success: true, result: { id: "img-1" } }),
  );
  global.fetch = upload as unknown as typeof fetch;
  const file = new File(["x"], "gecko.jpg", { type: "image/jpeg" });
  await act(async () => {
    fireEvent.change(
      document.getElementById("bloodline-card-image") as HTMLInputElement,
      {
        target: { files: [file] },
      },
    );
  });
  await waitFor(() => expect(upload).toHaveBeenCalled());
  await waitFor(() =>
    expect(
      screen.getByRole("button", { name: "혈통 만들기" }),
    ).not.toHaveProperty("disabled", true),
  );
}

describe("혈통 만들기 — 오류 칸을 화면에 보인다", () => {
  it("이름 규칙에 어긋나면 이름 칸으로 올라가고 오류를 보인다", async () => {
    renderForm();
    await pickSpecies();
    await pickPhoto();
    fireEvent.change(nameInput(), { target: { value: "Tw-2" } });

    fireEvent.click(screen.getByRole("button", { name: "혈통 만들기" }));

    expect(
      await screen.findByText("이름은 한글·영문·숫자·띄어쓰기로 2~40자예요"),
    ).toBeTruthy();
    await waitFor(() => expect(scrolledTo(nameInput())).toBe(true));
    // 서버로 보내지 않는다
    expect(mockAuthFetch).not.toHaveBeenCalledWith(
      "/api/bloodline-cards",
      expect.anything(),
    );
  });

  it("이름은 맞고 종·사진이 비면 첫 오류 칸(종)으로 올라간다", async () => {
    renderForm();
    await waitFor(() =>
      expect(screen.getByRole("option", { name: "파충류" })).toBeTruthy(),
    );
    fireEvent.change(nameInput(), { target: { value: "Tw2" } });

    fireEvent.click(screen.getByRole("button", { name: "혈통 만들기" }));

    await waitFor(() =>
      expect(scrolledTo(screen.getByLabelText("분류"))).toBe(true),
    );
    expect(scrolledTo(nameInput())).toBe(false);
  });

  it("서버가 이미 있는 이름이라고 하면 이름 칸으로 올라간다", async () => {
    renderForm();
    await pickSpecies();
    await pickPhoto();
    fireEvent.change(nameInput(), { target: { value: "Tw2" } });
    mockAuthFetch.mockImplementation(async (url: string) => {
      if (url === "/api/bloodline-cards") {
        return jsonResponse(409, {
          success: false,
          error: "이미 사용 중인 이름이에요",
          errorCode: "BLOODLINE_DUPLICATE_NAME",
        });
      }
      throw new Error(`unexpected ${url}`);
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "혈통 만들기" }));
    });

    expect(await screen.findByText("이미 사용 중인 이름이에요")).toBeTruthy();
    await waitFor(() => expect(scrolledTo(nameInput())).toBe(true));
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it("칸에 붙일 수 없는 서버 오류는 폼 위 오류로 올라간다", async () => {
    renderForm();
    await pickSpecies();
    await pickPhoto();
    fireEvent.change(nameInput(), { target: { value: "Tw2" } });
    mockAuthFetch.mockImplementation(async (url: string) => {
      if (url === "/api/bloodline-cards") {
        return jsonResponse(500, {
          success: false,
          error: "혈통을 만들지 못했어요",
          errorCode: "BLOODLINE_SERVER_ERROR",
        });
      }
      throw new Error(`unexpected ${url}`);
    });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "혈통 만들기" }));
    });

    const formError = await screen.findByText("혈통을 만들지 못했어요");
    await waitFor(() => expect(scrolledTo(formError)).toBe(true));
  });
});
