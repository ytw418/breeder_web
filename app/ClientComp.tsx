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
    if (process.env.NODE_ENV !== "production" && !enableInDev) return;

    navigator.serviceWorker
      .register("/sw.js")
      .catch((error) => console.error("Service Worker registration failed:", error));
  }, []);

  return <div className=""></div>;
}
