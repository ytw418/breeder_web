import { getAnalytics, logEvent } from "firebase/analytics";
// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";

// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional

export const firebaseConfig = JSON.parse(
  process.env.NEXT_PUBLIC_FIREBASE_CONFIG
);

// Initialize Firebase
export const app = initializeApp(
  JSON.parse(process.env.NEXT_PUBLIC_FIREBASE_CONFIG)
);
export const analytics = typeof window !== "undefined" && getAnalytics(app);

// 다음 예제는 사용자가 앱에서 알림을 받았음을 나타내기 위해 권장 이벤트를 기록하는 방법을 보여줍니다.
// logEvent(analytics, "notification_received");
