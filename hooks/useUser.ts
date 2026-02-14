import { User } from "@prisma/client";
import { useState } from "react";
import useSWR from "swr";

interface ProfileResponse {
  success: boolean;
  profile: User;
  isAdmin?: boolean;
}

export default function useUser() {
  const [shouldFetchUser, setShouldFetchUser] = useState(true);
  const { data, error, mutate } = useSWR<ProfileResponse>(
    shouldFetchUser ? "/api/users/me" : null,
    {
      onError: (swrError: Error & { status?: number }) => {
        // 비로그인 상태에서는 동일 401 요청을 반복하지 않는다.
        if (swrError?.status === 401 || swrError?.status === 403) {
          setShouldFetchUser(false);
        }
      },
      revalidateOnFocus: false,
    }
  );
  return {
    user: data?.profile,
    isAdmin: Boolean(data?.isAdmin),
    isLoading: shouldFetchUser && !data && !error,
    mutate,
  };
}
