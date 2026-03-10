import type { ExpoConfig } from "expo/config";

const projectId = process.env.EXPO_PUBLIC_EAS_PROJECT_ID || undefined;

const config: ExpoConfig = {
  name: "Bredy",
  slug: "bredy-mobile",
  scheme: "bredy",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/icon.png",
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
  plugins: ["expo-notifications"],
  extra: {
    eas: {
      projectId,
    },
  },
};

export default config;
