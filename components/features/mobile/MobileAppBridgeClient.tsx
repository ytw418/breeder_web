"use client";

import { useEffect } from "react";
import {
  isMobileApp,
  isNativeBridgeMessage,
  postNativeMessage,
  readStoredMobilePushDevice,
  storeMobilePushDevice,
} from "@libs/client/mobile/bridge";

type NativeMessagePayload = {
  token?: string;
  platform?: string;
  appVersion?: string;
  path?: string;
};

const isSafePath = (value: unknown) =>
  typeof value === "string" && value.startsWith("/") && !value.startsWith("//");

const syncMobilePushToken = async () => {
  const device = readStoredMobilePushDevice();
  if (!device?.token) return;

  try {
    await fetch("/api/mobile/push-token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        token: device.token,
        platform: device.platform,
        appVersion: device.appVersion,
        userAgent: typeof navigator === "undefined" ? undefined : navigator.userAgent,
      }),
    });
  } catch {
    // noop
  }
};

const navigateFromPush = (path?: string) => {
  if (!isSafePath(path)) return;
  if (typeof window === "undefined") return;
  const nextPath = path as string;
  if (window.location.pathname === nextPath) return;
  window.location.assign(nextPath);
};

const MobileAppBridgeClient = () => {
  useEffect(() => {
    if (!isMobileApp()) return;

    const handleNativePayload = (payload: unknown) => {
      if (typeof payload !== "string") return;

      try {
        const parsed = JSON.parse(payload);
        if (!isNativeBridgeMessage(parsed)) return;

        const messagePayload = (parsed.payload || {}) as NativeMessagePayload;
        if (parsed.type === "DEVICE_PUSH_TOKEN_AVAILABLE") {
          if (!messagePayload.token) return;
          storeMobilePushDevice({
            token: messagePayload.token,
            platform: messagePayload.platform || "android",
            appVersion: messagePayload.appVersion,
          });
          void syncMobilePushToken();
          return;
        }

        if (parsed.type === "PUSH_NOTIFICATION_OPENED") {
          navigateFromPush(messagePayload.path);
        }
      } catch {
        // noop
      }
    };

    const handleWindowMessage = (event: MessageEvent) => {
      handleNativePayload(event.data);
    };

    const handleDocumentMessage = (event: Event) => {
      const messageEvent = event as MessageEvent;
      handleNativePayload(messageEvent.data);
    };

    const handleSessionReady = () => {
      postNativeMessage("SESSION_READY");
      void syncMobilePushToken();
    };

    const handleSessionCleared = () => {
      postNativeMessage("SESSION_CLEARED");
    };

    window.addEventListener("message", handleWindowMessage);
    document.addEventListener("message", handleDocumentMessage as EventListener);
    window.addEventListener("bredy:session-ready", handleSessionReady);
    window.addEventListener("bredy:session-cleared", handleSessionCleared);

    void syncMobilePushToken();

    return () => {
      window.removeEventListener("message", handleWindowMessage);
      document.removeEventListener("message", handleDocumentMessage as EventListener);
      window.removeEventListener("bredy:session-ready", handleSessionReady);
      window.removeEventListener("bredy:session-cleared", handleSessionCleared);
    };
  }, []);

  return null;
};

export default MobileAppBridgeClient;
