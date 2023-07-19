import { Token } from "graphql";
import { ClientError, request } from "graphql-request";
import { useState } from "react";

import { SessionToken } from "./getToken";

interface UseMutationState<T> {
  loading: boolean;
  data?: T;
  error?: ClientError;
}

interface UseMutationOptions<T, U> {
  token?: SessionToken;
  variables?: U;
  onCompleted?: (result: T) => void;
}

type UseMutationResult<T, U> = [
  (options: UseMutationOptions<T, U>) => void,
  UseMutationState<T>
];

export default function useMutation<T = any, U = any>(
  mutation: any
): UseMutationResult<T, U> {
  const [state, setState] = useState<UseMutationState<T>>({
    loading: false,
    data: undefined,
    error: undefined,
  });

  function fn({ token, variables, onCompleted }: UseMutationOptions<T, U>) {
    setState((prev) => ({ ...prev, loading: true }));

    const requestHeaders = token
      ? { authorization: `Bearer ${token}` }
      : undefined;

    request(
      process.env.NEXT_PUBLIC_API_SERVER_URL! + "/graphql",
      mutation,
      variables && variables,
      requestHeaders
    )
      .then((data: any) => {
        setState((prev) => ({ ...prev, loading: false, data }));
        if (onCompleted) {
          onCompleted(data);
        }
      })
      .catch((error: ClientError) => {
        console.log("useMutation.error", error);
        if (error.message.includes("jwt expired")) {
          // token expired.
        } else if (error.message.includes("invalid signature")) {
          // invalid token.
        } else {
          // other errors
        }
        setState((prev) => ({ ...prev, loading: false, error }));
        if (onCompleted) {
          onCompleted(error as T);
        }
      });
  }

  return [fn, state];
}
