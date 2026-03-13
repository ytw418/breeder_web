import type { ExpoConfig } from "expo/config";

const projectId =
  process.env.EXPO_PUBLIC_EAS_PROJECT_ID || "8c3604fc-587a-409d-8644-bc19e34db480";

const config: ExpoConfig = {
  name: "Bredy",
  slug: "bredy-mobile",
  scheme: "bredy",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/icon.png",
  backgroundColor: "#ffffff",
  userInterfaceStyle: "light",
  splash: {
    image: "./assets/splash-icon.png",
    resizeMode: "contain",
    backgroundColor: "#ffffff",
  },
  assetBundlePatterns: ["**/*"],
  ios: {
    supportsTablet: false,
  },
  android: {
    package: "com.bredy.mobile",
    permissions: ["POST_NOTIFICATIONS"],
    adaptiveIcon: {
      backgroundColor: "#E6F4FE",
      foregroundImage: "./assets/android-icon-foreground.png",
      backgroundImage: "./assets/android-icon-background.png",
      monochromeImage: "./assets/android-icon-monochrome.png",
    },
    predictiveBackGestureEnabled: false,
  },
  androidStatusBar: {
    backgroundColor: "#ffffff",
    barStyle: "dark-content",
    translucent: false,
  },
  androidNavigationBar: {
    backgroundColor: "#ffffff",
    barStyle: "dark-content",
  },
  plugins: [
    "expo-notifications",
    "expo-system-ui",
    [
      "expo-navigation-bar",
      {
        backgroundColor: "#ffffff",
        borderColor: "#E5E7EB",
        barStyle: "dark",
        visibility: "visible",
        position: "relative",
        behavior: "inset-swipe",
        enforceContrast: false,
      },
    ],
  ],
  extra: {
    eas: {
      projectId,
    },
  },
};

export default config;
