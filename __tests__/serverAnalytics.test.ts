/**
 * @jest-environment node
 */

/**
 * 서버 PostHog 캡처(libs/server/analytics). 의존성 없이 fetch(`${HOST}/capture/`)로 보내고,
 * 키가 없거나 테스트 환경이면 보내지 않으며, 실패·1.5초 초과에도 요청을 막지 않는다.
 */
import { captureServerEvent, resolveServerAnalyticsConfig } from "@libs/server/analytics";

const PROD_ENV = {
  NODE_ENV: "production",
  POSTHOG_SERVER_KEY: "phc_server",
  NEXT_PUBLIC_POSTHOG_KEY: "phc_public",
  NEXT_PUBLIC_POSTHOG_HOST: "https://eu.i.posthog.com/",
};

const okFetch = () => jest.fn(async (_url: string, _init?: RequestInit) => ({ ok: true, status: 200 }) as Response);

beforeEach(() => {
  jest.clearAllMocks();
  jest.useRealTimers();
});

describe("captureServerEvent", () => {
  it("키가 없으면 보내지 않는다", async () => {
    const fetchImpl = okFetch();
    await captureServerEvent(7, "bloodline_created", { bloodline_id: 1 }, {
      env: { NODE_ENV: "production" },
      fetchImpl,
    });
    expect(fetchImpl).not.toHaveBeenCalled();

    // 테스트 환경이면 키가 있어도 보내지 않는다
    await captureServerEvent(7, "bloodline_created", {}, {
      env: { ...PROD_ENV, NODE_ENV: "test" },
      fetchImpl,
    });
    expect(fetchImpl).not.toHaveBeenCalled();

    // 기본값(process.env — jest 는 NODE_ENV=test)도 보내지 않는다
    await captureServerEvent(7, "bloodline_sent", {});
    expect(global.fetch).not.toHaveBeenCalled();

    expect(resolveServerAnalyticsConfig({ NODE_ENV: "production", NEXT_PUBLIC_POSTHOG_KEY: "  " })).toBeNull();
  });

  it("PostHog capture 형식으로 보낸다", async () => {
    const fetchImpl = okFetch();
    await captureServerEvent(
      7,
      "bloodline_sent",
      { bloodline_id: 3, card_id: 9, mode: "issue", via: "chat" },
      { env: PROD_ENV, fetchImpl }
    );
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("https://eu.i.posthog.com/capture/");
    expect(init?.method).toBe("POST");
    expect(init?.headers).toEqual({ "Content-Type": "application/json" });
    expect(init?.signal).toBeDefined();
    const body = JSON.parse(String(init?.body));
    expect(body).toEqual({
      api_key: "phc_server",
      event: "bloodline_sent",
      distinct_id: "7",
      timestamp: expect.any(String),
      properties: { bloodline_id: 3, card_id: 9, mode: "issue", via: "chat", $lib: "bredy-server" },
    });
    expect(Number.isNaN(Date.parse(body.timestamp))).toBe(false);

    // 서버 키가 없으면 공개 키, 호스트가 없으면 기본 호스트
    expect(
      resolveServerAnalyticsConfig({ NODE_ENV: "production", NEXT_PUBLIC_POSTHOG_KEY: "phc_public" })
    ).toEqual({ apiKey: "phc_public", host: "https://us.i.posthog.com" });
  });

  it("실패해도 요청을 막지 않는다", async () => {
    const rejecting = jest.fn(async () => {
      throw new Error("network down");
    });
    await expect(
      captureServerEvent(7, "product_bloodline_attached", {}, { env: PROD_ENV, fetchImpl: rejecting })
    ).resolves.toBeUndefined();
    expect(console.warn).toHaveBeenCalled();

    const serverError = jest.fn(async () => ({ ok: false, status: 500 }) as Response);
    await expect(
      captureServerEvent(7, "auction_bloodline_attached", {}, { env: PROD_ENV, fetchImpl: serverError })
    ).resolves.toBeUndefined();

    // 1.5초 안에 답이 없으면 끊고 끝낸다
    jest.useFakeTimers();
    const hanging = jest.fn(
      (_url: string, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(new Error("aborted")));
        })
    );
    const pending = captureServerEvent(7, "bloodline_created", {}, { env: PROD_ENV, fetchImpl: hanging });
    jest.advanceTimersByTime(1500);
    await expect(pending).resolves.toBeUndefined();
    expect((hanging.mock.calls[0][1]?.signal as AbortSignal).aborted).toBe(true);
  });
});
