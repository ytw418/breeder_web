"use client";
import React from "react";
import MyPageClient from "./MyPageClient";
import AuthGuard from "@components/auth/AuthGuard";

const Page = () => {
  return (
    <AuthGuard>
      <MyPageClient />
    </AuthGuard>
  );
};

export default Page;
