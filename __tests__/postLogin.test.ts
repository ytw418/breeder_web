import { getSafeNextPath, resolvePostLoginDestination } from "@libs/client/postLogin";

describe("로그인 뒤 이동 경로", () => {
  it("같은 사이트 경로만 허용한다", () => {
    expect(getSafeNextPath(null)).toBe("/");
    expect(getSafeNextPath("//evil.com")).toBe("/");
    expect(getSafeNextPath("https://evil.com")).toBe("/");
    expect(getSafeNextPath("%2Fposts%2F3")).toBe("/posts/3");
  });

  const base = { serverPinnedIds: [] as number[], localPinCount: 0, onboarded: false };

  it("계정·브라우저 모두 고정이 없고 온보딩을 안 봤으면 온보딩을 거친다", () => {
    expect(resolvePostLoginDestination({ ...base, next: "/" })).toBe("/onboarding");
    expect(resolvePostLoginDestination({ ...base, next: "/posts/3" })).toBe(
      "/onboarding?next=%2Fposts%2F3"
    );
  });

  it("계정에 고정이 있거나, 브라우저에 고정이 있거나, 이미 봤으면 바로 간다", () => {
    expect(resolvePostLoginDestination({ ...base, next: "/posts", serverPinnedIds: [1] })).toBe("/posts");
    expect(resolvePostLoginDestination({ ...base, next: "/posts", localPinCount: 1 })).toBe("/posts");
    expect(resolvePostLoginDestination({ ...base, next: "/posts", onboarded: true })).toBe("/posts");
  });

  it("앱에서 '전체 보기'로 마친 계정(고정 없음 + 마침 표시)은 다시 묻지 않는다", () => {
    expect(resolvePostLoginDestination({ ...base, next: "/posts", serverOnboarded: true })).toBe("/posts");
  });

  it("서버 값을 못 읽어도 온보딩으로 보내고, 온보딩으로 가는 길이면 감싸지 않는다", () => {
    expect(resolvePostLoginDestination({ ...base, next: "/", serverPinnedIds: undefined })).toBe(
      "/onboarding"
    );
    expect(resolvePostLoginDestination({ ...base, next: "/onboarding?next=%2Fposts" })).toBe(
      "/onboarding?next=/posts"
    );
  });
});
