import { StatusBar } from "expo-status-bar";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import {
  BackHandler,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import WebView, { WebViewMessageEvent } from "react-native-webview";
import type { WebViewNavigation } from "react-native-webview/lib/WebViewTypes";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

type BridgeMessage = {
  source: "bredy-mobile";
  type:
    | "SESSION_READY"
    | "SESSION_CLEARED"
    | "OPEN_EXTERNAL_URL"
    | "DEVICE_PUSH_TOKEN_AVAILABLE"
    | "PUSH_NOTIFICATION_OPENED";
  payload?: Record<string, unknown>;
};

type PushDevicePayload = {
  token: string;
  platform: string;
  appVersion?: string;
};

const APP_VERSION = Constants.expoConfig?.version || "1.0.0";
const APP_USER_AGENT = `BredyMobileApp/${APP_VERSION}`;
const DEFAULT_WEB_URL = process.env.EXPO_PUBLIC_WEB_APP_URL || "https://bredy.app";
const APP_BASE_URL = DEFAULT_WEB_URL.replace(/\/$/, "");
const WEB_PUSH_DEVICE_STORAGE_KEY = "bredy:mobile-push-device";

const isSafeInternalPath = (value: string | null | undefined) =>
  Boolean(value && value.startsWith("/") && !value.startsWith("//"));

const buildAppUrl = (path = "/") => {
  const normalizedPath = isSafeInternalPath(path) ? path : "/";
  return `${APP_BASE_URL}${normalizedPath}`;
};

const parseBridgeMessage = (raw: string): BridgeMessage | null => {
  try {
    const parsed = JSON.parse(raw) as BridgeMessage;
    if (parsed?.source !== "bredy-mobile" || typeof parsed.type !== "string") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
};

const extractPushPath = (response: Notifications.NotificationResponse | null) => {
  if (!response) return "/";
  const value = response?.notification.request.content.data?.path;
  return typeof value === "string" ? value : "/notifications";
};

const createBridgeDispatchScript = (message: BridgeMessage) => {
  const encodedMessage = JSON.stringify(JSON.stringify(message));
  const encodedPayload = JSON.stringify(JSON.stringify(message.payload || {}));
  return `
    (function() {
      var payload = ${encodedMessage};
      var payloadObject = ${encodedPayload};
      if (${JSON.stringify(message.type)} === 'DEVICE_PUSH_TOKEN_AVAILABLE') {
        window.localStorage.setItem(${JSON.stringify(WEB_PUSH_DEVICE_STORAGE_KEY)}, payloadObject);
      }
      window.dispatchEvent(new MessageEvent('message', { data: payload }));
      document.dispatchEvent(new MessageEvent('message', { data: payload }));
    })();
    true;
  `;
};

const registerForPushNotificationsAsync = async (): Promise<string | null> => {
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#0F172A",
    });
  }

  if (!Device.isDevice) {
    return null;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const permissionResult = await Notifications.requestPermissionsAsync();
    finalStatus = permissionResult.status;
  }

  if (finalStatus !== "granted") {
    return null;
  }

  const projectId =
    Constants.easConfig?.projectId ||
    Constants.expoConfig?.extra?.eas?.projectId ||
    process.env.EXPO_PUBLIC_EAS_PROJECT_ID;

  if (!projectId) {
    console.warn("Expo projectId가 없어 푸시 토큰 등록을 건너뜁니다.");
    return null;
  }

  const token = await Notifications.getExpoPushTokenAsync({ projectId });
  return token.data;
};

export default function App() {
  const webViewRef = useRef<WebView | null>(null);
  const canGoBackRef = useRef(false);
  const isWebViewReadyRef = useRef(false);
  const pendingPushDeviceRef = useRef<PushDevicePayload | null>(null);
  const pendingPushPathRef = useRef<string | null>(null);
  const [currentPath, setCurrentPath] = useState<string | null>(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const [loadError, setLoadError] = useState<string>("");
  const [isBooting, setIsBooting] = useState(true);

  const source = useMemo(() => ({ uri: buildAppUrl(currentPath || "/") }), [currentPath]);

  const sendMessageToWeb = useCallback((message: BridgeMessage) => {
    const script = createBridgeDispatchScript(message);
    webViewRef.current?.injectJavaScript(script);
  }, []);

  const flushPendingDevice = useCallback(() => {
    if (!isWebViewReadyRef.current || !pendingPushDeviceRef.current) return;
    sendMessageToWeb({
      source: "bredy-mobile",
      type: "DEVICE_PUSH_TOKEN_AVAILABLE",
      payload: pendingPushDeviceRef.current,
    });
  }, [sendMessageToWeb]);

  const flushPendingPushPath = useCallback(() => {
    if (!isWebViewReadyRef.current || !pendingPushPathRef.current) return;
    sendMessageToWeb({
      source: "bredy-mobile",
      type: "PUSH_NOTIFICATION_OPENED",
      payload: { path: pendingPushPathRef.current },
    });
    pendingPushPathRef.current = null;
  }, [sendMessageToWeb]);

  const handlePushNavigation = useCallback((path: string) => {
    const safePath = isSafeInternalPath(path) ? path : "/notifications";
    if (!isWebViewReadyRef.current) {
      setCurrentPath(safePath);
      pendingPushPathRef.current = safePath;
      return;
    }

    pendingPushPathRef.current = safePath;
    flushPendingPushPath();
  }, [flushPendingPushPath]);

  const bootstrap = useCallback(async () => {
    try {
      const [lastResponse, expoPushToken] = await Promise.all([
        Notifications.getLastNotificationResponseAsync(),
        registerForPushNotificationsAsync().catch(() => null),
      ]);

      const launchPath = extractPushPath(lastResponse);
      setCurrentPath(launchPath);

      if (expoPushToken) {
        pendingPushDeviceRef.current = {
          token: expoPushToken,
          platform: Platform.OS,
          appVersion: APP_VERSION,
        };
      }
    } finally {
      setIsBooting(false);
    }
  }, []);

  useEffect(() => {
    void bootstrap();

    const responseSubscription = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        handlePushNavigation(extractPushPath(response));
      }
    );

    return () => {
      responseSubscription.remove();
    };
  }, [bootstrap, handlePushNavigation]);

  useEffect(() => {
    const handleBackPress = () => {
      if (canGoBackRef.current) {
        webViewRef.current?.goBack();
        return true;
      }
      return false;
    };

    const subscription = BackHandler.addEventListener("hardwareBackPress", handleBackPress);
    return () => subscription.remove();
  }, []);

  const handleNavigationStateChange = (navigationState: WebViewNavigation) => {
    canGoBackRef.current = navigationState.canGoBack;
    setCanGoBack(navigationState.canGoBack);
  };

  const handleWebViewMessage = (event: WebViewMessageEvent) => {
    const message = parseBridgeMessage(event.nativeEvent.data);
    if (!message) return;

    if (message.type === "SESSION_READY") {
      flushPendingDevice();
      flushPendingPushPath();
      return;
    }

    if (message.type === "OPEN_EXTERNAL_URL") {
      const url = message.payload?.url;
      if (typeof url === "string") {
        void Linking.openURL(url);
      }
      return;
    }

    if (message.type === "SESSION_CLEARED") {
      return;
    }
  };

  const handleLoadEnd = () => {
    isWebViewReadyRef.current = true;
    setLoadError("");
    flushPendingDevice();
    flushPendingPushPath();
  };

  const handleRetry = () => {
    setLoadError("");
    isWebViewReadyRef.current = false;
    webViewRef.current?.reload();
  };

  const handleShouldStartLoadWithRequest = (request: { url: string }) => {
    if (!request.url || request.url === "about:blank") {
      return true;
    }

    try {
      const nextUrl = new URL(request.url);
      const appUrl = new URL(APP_BASE_URL);
      if (nextUrl.host === appUrl.host) {
        return true;
      }
    } catch {
      // URL 파싱 실패 시 외부 링크로 처리한다.
    }

    void Linking.openURL(request.url);
    return false;
  };

  if (isBooting || !currentPath) {
    return (
      <View style={styles.bootContainer}>
        <StatusBar style="dark" />
        <Text style={styles.bootEyebrow}>BREDY APP</Text>
        <Text style={styles.bootTitle}>웹을 그대로 불러오는 중</Text>
        <Text style={styles.bootBody}>안드로이드 앱 셸과 알림 브리지를 먼저 준비합니다.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      {loadError ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>페이지를 불러오지 못했습니다.</Text>
          <Text style={styles.errorBody}>
            네트워크 상태를 확인한 뒤 다시 시도해 주세요.
          </Text>
          <Pressable onPress={handleRetry} style={styles.retryButton}>
            <Text style={styles.retryButtonText}>다시 시도</Text>
          </Pressable>
        </View>
      ) : (
        <WebView
          ref={webViewRef}
          source={source}
          originWhitelist={["*"]}
          onMessage={handleWebViewMessage}
          onLoadEnd={handleLoadEnd}
          onError={() => setLoadError("load-error")}
          onHttpError={() => setLoadError("http-error")}
          onNavigationStateChange={handleNavigationStateChange}
          onShouldStartLoadWithRequest={handleShouldStartLoadWithRequest}
          startInLoadingState
          javaScriptEnabled
          domStorageEnabled
          allowsInlineMediaPlayback
          setSupportMultipleWindows={false}
          thirdPartyCookiesEnabled
          sharedCookiesEnabled
          applicationNameForUserAgent={APP_USER_AGENT}
          renderLoading={() => (
            <View style={styles.loadingOverlay}>
              <Text style={styles.loadingText}>브리디를 불러오는 중...</Text>
            </View>
          )}
        />
      )}
      <View style={styles.footerBar}>
        <Text style={styles.footerText}>{canGoBack ? "뒤로가기 가능" : "홈 고정 상태"}</Text>
        <Text style={styles.footerText}>v{APP_VERSION}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  bootContainer: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
    backgroundColor: "#F8FAFC",
  },
  bootEyebrow: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1.4,
    color: "#2563EB",
    marginBottom: 10,
  },
  bootTitle: {
    fontSize: 26,
    fontWeight: "800",
    color: "#0F172A",
  },
  bootBody: {
    marginTop: 10,
    fontSize: 14,
    lineHeight: 22,
    color: "#475569",
  },
  loadingOverlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F8FAFC",
  },
  loadingText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0F172A",
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
    backgroundColor: "#FFF7ED",
  },
  errorTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#7C2D12",
  },
  errorBody: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 22,
    textAlign: "center",
    color: "#9A3412",
  },
  retryButton: {
    marginTop: 18,
    borderRadius: 999,
    backgroundColor: "#0F172A",
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  retryButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  footerBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#CBD5E1",
    backgroundColor: "#FFFFFF",
  },
  footerText: {
    fontSize: 12,
    color: "#475569",
  },
});
