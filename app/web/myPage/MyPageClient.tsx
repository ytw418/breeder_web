"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import React from "react";

const MyPageClient = () => {
  const router = useRouter();
  return (
    <div>
      <Link href={"/auth/login"}>로그인페이지</Link>
    </div>
  );
};

export default MyPageClient;
