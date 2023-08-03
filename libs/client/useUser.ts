import { User } from "@prisma/client";
import { useEffect, useLayoutEffect } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";

interface ProfileResponse {
  success: boolean;
  profile: User;
}

export default function useUser() {
  const { data, error } = useSWR<ProfileResponse>("/api/users/me");

  return { user: data?.profile, isLoading: !data && !error };
}
