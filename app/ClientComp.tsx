"use client";

import { useEffect } from "react";
import "../firebase.js";
declare global {
  interface Window {
    Kakao: any;
    AppleID: any;
    currentPage: number;
  }
}

export default function ClientComp() {
  useEffect(() => {
    const touchableButton = () => {
      const touchableButtons = document.querySelectorAll(".button");
      if (touchableButtons.length > 0) {
        touchableButtons.forEach((button) => {
          button.addEventListener("mouseup", () => {
            button.classList.add("clicked");
            setTimeout(() => {
              button.classList.remove("clicked");
            }, 200); // 원하는 시간(밀리초) 뒤에 클래스를 제거하여 사이즈를 돌려놓습니다.
          });
        });
      }
    };
    touchableButton();

    return () => touchableButton();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;

    const enableInDev = process.env.NEXT_PUBLIC_PWA_IN_DEV === "true";
    const isLocalhost =
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1";

    if (process.env.NODE_ENV !== "production" || isLocalhost) {
      if (enableInDev && !isLocalhost) return;

      // 개발/로컬 환경에서는 오래된 캐시로 _next 정적 파일이 꼬이는 문제를 방지한다.
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        registrations.forEach((registration) => {
          registration.unregister();
        });
      });
      if ("caches" in window) {
        caches.keys().then((keys) => {
          keys.forEach((key) => caches.delete(key));
        });
      }
      return;
    }

    navigator.serviceWorker
      .register("/sw.js")
      .catch((error) => console.error("Service Worker registration failed:", error));
  }, []);

  return <div className=""></div>;
}
