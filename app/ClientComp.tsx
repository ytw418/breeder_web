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
      const touchableButton = document.querySelector(".button");
      if (touchableButton) {
        touchableButton.addEventListener("mouseup", () => {
          touchableButton.classList.add("clicked");
          setTimeout(() => {
            touchableButton.classList.remove("clicked");
          }, 200); // 원하는 시간(밀리초) 뒤에 클래스를 제거하여 사이즈를 돌려놓습니다.
        });
      }
    };
    touchableButton();

    return () => touchableButton();
  }, []);
  return <div className=""></div>;
}
