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
  | "auction_bloodline_attached"
  // 가입·로그인·탈퇴(가입률·이탈률). 모든 소셜 가입은 pages/api/auth/login.ts 한 곳에서 일어난다.
  | "signup_completed"
  | "login_completed"
  | "account_deleted"
  // 기능 사용률. 앱·웹 모두 이 API 를 거치므로 서버에서 한 번 찍고 platform 으로 나눠 본다.
  | "post_created"
  | "post_answer_created"
  | "post_liked"
  | "product_created"
  | "product_favorited"
  | "auction_created"
  | "auction_bid_placed"
  | "auction_restarted"
  | "chat_room_created"
  | "chat_message_sent"
  | "chat_wave_sent"
  | "user_followed"
  | "report_submitted"
  | "category_onboarding_completed"
  | "region_set"
  | "profile_updated"
  // 찬반 토론·사랑방(앱 docs/prd/live-talk.md §7)
  | "debate_created"
  | "debate_voted"
  | "debate_commented"
  | "town_message_sent"
  | "town_welcome_sent";

export type ClientPlatform = "app" | "web";

type HeaderValue = string | string[] | undefined;
const headerValue = (value: HeaderValue) => (Array.isArray(value) ? value[0] : value) ?? "";

/** 네이티브 fetch 의 User-Agent(Android okhttp, iOS CFNetwork). 브라우저는 Mozilla/... 로 시작한다. */
const NATIVE_APP_USER_AGENT = /^okhttp\/|CFNetwork\/|Darwin\//;

/**
 * 요청이 앱(bredy_app)에서 왔는지 웹에서 왔는지. 앱은 `X-Bredy-Client: app` 헤더를 붙이고,
 * 헤더가 없는 옛 앱 빌드는 네이티브 fetch User-Agent 로 가린다.
 */
export function resolveClientPlatform(req: { headers?: Record<string, HeaderValue> }): ClientPlatform {
  const headers = req.headers ?? {};
  if (headerValue(headers["x-bredy-client"]).toLowerCase() === "app") return "app";
  if (NATIVE_APP_USER_AGENT.test(headerValue(headers["user-agent"]))) return "app";
  return "web";
}

/** signup_completed 에 가입 수단·플랫폼을 사람 속성으로 붙인다($set_once — 다시 로그인해도 바뀌지 않는다). */
export function withSignupPersonProperties(properties: { method: string; platform: ClientPlatform } & Record<string, unknown>) {
  return {
    ...properties,
    $set_once: { signup_method: properties.method, signup_platform: properties.platform },
  };
}

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
