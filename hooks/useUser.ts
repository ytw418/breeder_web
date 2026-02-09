import { User } from "@prisma/client";
import useSWR from "swr";

interface ProfileResponse {
  success: boolean;
  profile: User;
}

export default function useUser() {
  const { data, error, mutate } = useSWR<ProfileResponse>("/api/users/me");
  return { user: data?.profile, isLoading: !data && !error, mutate };
}
