import React from "react";
import UploadClient from "./UploadClient";
import { getSessionUser } from "@libs/server/getUser";
import { redirect } from "next/navigation";
import type { Metadata } from "next";

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
    },
  },
  title: "상품 업로드 | 브리디",
  description: "로그인 사용자 전용 상품 업로드 페이지입니다.",
};

const page = async () => {
  const user = await getSessionUser();
  if (!user) {
    redirect("/auth/login");
  }
  return <UploadClient />;
};

export default page;
