import { useState } from "react";

interface UseApiMutationState<T> {
  loading: boolean;
  data?: T;
  error?: object;
}
type UseApiMutationResult<T> = [
  (
    data: any,
    endpoint: string,
    contentType?: string,
    onCompleted?: (result: T) => void
  ) => void,
  UseApiMutationState<T>
];

export default function useApiMutation<T = any>(
  url: string
): UseApiMutationResult<T> {
  const [state, setState] = useState<UseApiMutationState<T>>({
    loading: false,
    data: undefined,
    error: undefined,
  });

  function mutation(
    data: any,
    endpoint: string,
    contentType?: string,
    onCompleted?: (result: T) => void
  ) {
    setState((prev) => ({ ...prev, loading: true }));
    fetch(url + endpoint, {
      method: "POST",
      headers: {
        "Content-Type": contentType ? contentType : "application/json",
      },
      body: data,
    })
      .then((response) => response.json().catch(() => {}))
      .then((json) => {
        setState((prev) => ({ ...prev, data: json, loading: false }));
        if (onCompleted) {
          onCompleted(json);
        }
      })
      .catch((error) => {
        setState((prev) => ({ ...prev, error, loading: false }));
        if (onCompleted) {
          onCompleted(error);
        }
      });
  }

  return [mutation, state];
}
