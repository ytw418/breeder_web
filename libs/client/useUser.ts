import { User } from "@prisma/client";
import { useEffect, useLayoutEffect } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";

interface ProfileResponse {
  success: boolean;
  profile: User;
}

export default function useUser() {
  const { data, error, mutate } = useSWR<ProfileResponse>("/api/users/me");

  console.log("로그인 유저 :>> ", data);

  return { user: data?.profile, isLoading: !data && !error, mutate };
}
