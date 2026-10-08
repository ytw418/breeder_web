/**
 * 서버 PostHog 캡처(설계 §3.8). posthog-node 없이 `POST ${HOST}/capture/` 한 번으로 보낸다.
 * - 키: POSTHOG_SERVER_KEY ?? NEXT_PUBLIC_POSTHOG_KEY. 호스트: NEXT_PUBLIC_POSTHOG_HOST ?? https://us.i.posthog.com
 * - 키가 없거나 NODE_ENV=test 면 아무것도 하지 않는다.
 * - 호출처는 응답 직전에 await 한다(Vercel 서버리스는 응답 뒤 작업을 보장하지 않는다). 1.5초 상한이고,
 *   실패·시간 초과는 console.warn 만 남기고 절대 reject 하지 않는다.
 * - 트랜잭션 콜백 안에서 부르지 않는다(Serializable 트랜잭션을 붙잡지 않게).
 */

export type ServerAnalyticsEvent =
  | "bloodline_created"
  | "bloodline_sent"
  | "product_bloodline_attached"
  | "auction_bloodline_attached";

export const SERVER_ANALYTICS_TIMEOUT_MS = 1500;
const DEFAULT_POSTHOG_HOST = "https://us.i.posthog.com";

type Env = Record<string, string | undefined>;

export interface ServerAnalyticsConfig {
  apiKey: string;
  host: string;
}

export function resolveServerAnalyticsConfig(env: Env = process.env): ServerAnalyticsConfig | null {
  if (env.NODE_ENV === "test") return null;
  const apiKey = (env.POSTHOG_SERVER_KEY || env.NEXT_PUBLIC_POSTHOG_KEY || "").trim();
  if (!apiKey) return null;
  const host = (env.NEXT_PUBLIC_POSTHOG_HOST || DEFAULT_POSTHOG_HOST).trim().replace(/\/+$/, "");
  return { apiKey, host };
}

export interface CaptureServerEventOptions {
  /** 테스트용. 기본 process.env */
  env?: Env;
  /** 테스트용. 기본 global fetch */
  fetchImpl?: (url: string, init?: RequestInit) => Promise<Response>;
}

export async function captureServerEvent(
  userId: number,
  event: ServerAnalyticsEvent,
  properties: Record<string, unknown> = {},
  options: CaptureServerEventOptions = {}
): Promise<void> {
  const config = resolveServerAnalyticsConfig(options.env ?? process.env);
  if (!config) return;
  const fetchImpl = options.fetchImpl ?? fetch;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SERVER_ANALYTICS_TIMEOUT_MS);
  try {
    const response = await fetchImpl(`${config.host}/capture/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: config.apiKey,
        event,
        distinct_id: String(userId),
        timestamp: new Date().toISOString(),
        properties: { ...properties, $lib: "bredy-server" },
      }),
      signal: controller.signal,
    });
    if (!response.ok) {
      console.warn("[analytics] PostHog capture 응답 오류", event, response.status);
    }
  } catch (error) {
    console.warn("[analytics] PostHog capture 실패", event, error);
  } finally {
    clearTimeout(timer);
  }
}
