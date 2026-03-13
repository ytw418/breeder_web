const BRIDGE_STORAGE_KEY = "bredy:mobile-push-device";
const APP_UA_MARKER = "BredyMobileApp";

type WebToNativeMessageType = "SESSION_READY" | "SESSION_CLEARED" | "OPEN_EXTERNAL_URL";
type NativeToWebMessageType = "DEVICE_PUSH_TOKEN_AVAILABLE" | "PUSH_NOTIFICATION_OPENED";

export interface MobilePushDevicePayload {
  token: string;
  platform: string;
  appVersion?: string;
}

interface BridgeMessage<TType extends string, TPayload = Record<string, unknown>> {
  source: "bredy-mobile";
  type: TType;
  payload?: TPayload;
}

const isBrowser = () => typeof window !== "undefined";

export const isMobileApp = () => {
  if (!isBrowser()) return false;
  if (window.ReactNativeWebView) return true;
  return window.navigator.userAgent.includes(APP_UA_MARKER);
};

export const readStoredMobilePushDevice = (): MobilePushDevicePayload | null => {
  if (!isBrowser()) return null;

  try {
    const raw = window.localStorage.getItem(BRIDGE_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as MobilePushDevicePayload;
  } catch {
    return null;
  }
};

export const storeMobilePushDevice = (payload: MobilePushDevicePayload) => {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(BRIDGE_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // noop
  }
};

export const postNativeMessage = <TPayload = Record<string, unknown>>(
  type: WebToNativeMessageType,
  payload?: TPayload
) => {
  if (!isBrowser() || !window.ReactNativeWebView) return;
  const message: BridgeMessage<WebToNativeMessageType, TPayload> = {
    source: "bredy-mobile",
    type,
    payload,
  };
  window.ReactNativeWebView.postMessage(JSON.stringify(message));
};

export const notifySessionReady = () => {
  postNativeMessage("SESSION_READY");
  if (!isBrowser()) return;
  window.dispatchEvent(new CustomEvent("bredy:session-ready"));
};

export const notifySessionCleared = () => {
  postNativeMessage("SESSION_CLEARED");
  if (!isBrowser()) return;
  window.dispatchEvent(new CustomEvent("bredy:session-cleared"));
};

export const openExternalUrl = (url: string) => {
  postNativeMessage("OPEN_EXTERNAL_URL", { url });
};

export const isNativeBridgeMessage = (value: unknown): value is BridgeMessage<NativeToWebMessageType> => {
  if (!value || typeof value !== "object") return false;
  const candidate = value as { source?: string; type?: string };
  return candidate.source === "bredy-mobile" && typeof candidate.type === "string";
};
