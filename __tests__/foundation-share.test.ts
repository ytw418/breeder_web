const mockToast = { success: jest.fn(), error: jest.fn() };
jest.mock("@libs/client/toast", () => ({ toast: mockToast }));

import { absoluteUrl, copyText, shareOrCopy } from "@libs/client/share";

const setNavigator = (key: "share" | "clipboard", value: unknown) => {
  Object.defineProperty(window.navigator, key, { value, configurable: true, writable: true });
};

describe("share 유틸", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setNavigator("share", undefined);
    setNavigator("clipboard", undefined);
  });

  it("absoluteUrl 은 현재 origin 을 붙이고, 절대 URL 은 그대로 둔다", () => {
    expect(absoluteUrl("/products/1")).toBe(`${window.location.origin}/products/1`);
    expect(absoluteUrl("posts/2")).toBe(`${window.location.origin}/posts/2`);
    expect(absoluteUrl("https://bredy.app/a")).toBe("https://bredy.app/a");
  });

  it("공유 시트가 있으면 shared 를 돌려주고 토스트를 띄우지 않는다", async () => {
    const share = jest.fn().mockResolvedValue(undefined);
    setNavigator("share", share);
    await expect(shareOrCopy({ title: "상품", url: "/products/1" })).resolves.toBe("shared");
    expect(share).toHaveBeenCalledWith({
      title: "상품",
      text: undefined,
      url: `${window.location.origin}/products/1`,
    });
    expect(mockToast.success).not.toHaveBeenCalled();
  });

  it("공유 시트를 닫으면(AbortError) 복사하지 않고 failed", async () => {
    const abort = Object.assign(new Error("cancel"), { name: "AbortError" });
    setNavigator("share", jest.fn().mockRejectedValue(abort));
    const writeText = jest.fn().mockResolvedValue(undefined);
    setNavigator("clipboard", { writeText });
    await expect(shareOrCopy({ title: "상품", url: "/products/1" })).resolves.toBe("failed");
    expect(writeText).not.toHaveBeenCalled();
    expect(mockToast.error).not.toHaveBeenCalled();
  });

  it("공유 시트가 없으면 링크를 복사하고 '링크를 복사했어요' 토스트", async () => {
    const writeText = jest.fn().mockResolvedValue(undefined);
    setNavigator("clipboard", { writeText });
    await expect(shareOrCopy({ title: "글", url: "/posts/3" })).resolves.toBe("copied");
    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/posts/3`);
    expect(mockToast.success).toHaveBeenCalledWith("링크를 복사했어요");
  });

  it("복사도 실패하면 failed 와 오류 토스트", async () => {
    setNavigator("clipboard", { writeText: jest.fn().mockRejectedValue(new Error("denied")) });
    // jsdom 에는 execCommand 가 없어 대체 경로도 실패한다.
    await expect(shareOrCopy({ title: "글", url: "/posts/3" })).resolves.toBe("failed");
    expect(mockToast.error).toHaveBeenCalled();
  });

  it("copyText 는 clipboard 성공 시 true", async () => {
    setNavigator("clipboard", { writeText: jest.fn().mockResolvedValue(undefined) });
    await expect(copyText("hello")).resolves.toBe(true);
  });
});
