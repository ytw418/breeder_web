const mockOpenNotice = jest.fn();
jest.mock("@libs/client/accountRestriction", () => ({
  ...jest.requireActual("@libs/client/accountRestriction"),
  openAccountRestrictedNotice: () => mockOpenNotice(),
}));

import { authFetch } from "@libs/client/authFetch";
import { getAccessToken, getRefreshToken, setTokens } from "@libs/client/authToken";

const fetchMock = global.fetch as jest.Mock;

const response = (status: number, body: unknown = {}) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
});

beforeEach(() => {
  fetchMock.mockReset();
  window.localStorage.clear();
  setTokens({ accessToken: "old-access", refreshToken: "old-refresh" });
});

describe("authFetch refresh 실패 처리", () => {
  it.each([401, 403])("refresh 가 %d 이면 토큰을 지운다", async (status) => {
    fetchMock
      .mockResolvedValueOnce(response(401))
      .mockResolvedValueOnce(response(status));

    const res = await authFetch("/api/users/me");

    expect(res.status).toBe(401);
    expect(getAccessToken()).toBeNull();
    expect(getRefreshToken()).toBeNull();
  });

  it("refresh 가 서버 오류(500)면 토큰을 남겨 다음 요청에서 다시 시도한다", async () => {
    fetchMock
      .mockResolvedValueOnce(response(401))
      .mockResolvedValueOnce(response(500));

    const res = await authFetch("/api/users/me");

    expect(res.status).toBe(401);
    expect(getAccessToken()).toBe("old-access");
    expect(getRefreshToken()).toBe("old-refresh");
  });

  it("refresh 가 성공하면 새 토큰으로 원 요청을 재시도한다", async () => {
    fetchMock
      .mockResolvedValueOnce(response(401))
      .mockResolvedValueOnce(response(200, { accessToken: "new-access", refreshToken: "new-refresh" }))
      .mockResolvedValueOnce(response(200, { success: true }));

    const res = await authFetch("/api/users/me");

    expect(res.status).toBe(200);
    expect(getAccessToken()).toBe("new-access");
    expect(getRefreshToken()).toBe("new-refresh");
    const retryInit = fetchMock.mock.calls[2][1] as RequestInit;
    expect(new Headers(retryInit.headers).get("Authorization")).toBe("Bearer new-access");
  });
});

describe("authFetch 쓰는 중 정지(refresh 403 ACCOUNT_*)", () => {
  beforeEach(() => {
    mockOpenNotice.mockReset();
    window.sessionStorage.clear();
  });

  it("사유·해제일을 저장하고 로그인 화면의 이용 제한 안내로 보낸다(AC-25)", async () => {
    fetchMock.mockResolvedValueOnce(response(401)).mockResolvedValueOnce(
      response(403, {
        success: false,
        errorCode: "ACCOUNT_SUSPENDED",
        message: "이용이 정지된 계정이에요. 2026.10.12 이후 다시 로그인할 수 있어요. 사유: 스팸·광고",
        reasonLabel: "스팸·광고",
        suspendedUntil: "2026-10-12T00:30:00.000Z",
      })
    );

    const res = await authFetch("/api/posts");

    expect(res.status).toBe(401);
    expect(getAccessToken()).toBeNull();
    expect(JSON.parse(window.sessionStorage.getItem("bredy:account-restriction") || "{}")).toEqual(
      expect.objectContaining({ errorCode: "ACCOUNT_SUSPENDED", reasonLabel: "스팸·광고" })
    );
    expect(mockOpenNotice).toHaveBeenCalledTimes(1);
  });

  it("403 이어도 이용 제한 응답이 아니면 안내로 보내지 않는다", async () => {
    fetchMock.mockResolvedValueOnce(response(401)).mockResolvedValueOnce(response(403, { success: false }));
    await authFetch("/api/posts");
    expect(mockOpenNotice).not.toHaveBeenCalled();
    expect(window.sessionStorage.getItem("bredy:account-restriction")).toBeNull();
  });
});
