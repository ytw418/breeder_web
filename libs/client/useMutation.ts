import { useState } from "react";

interface useMutationState<T> {
  loading: boolean;
  data?: T;
  error?: object;
}

interface MutationOption<T> {
  data: any;
  endpoint?: string;
  contentType?: string;
  onCompleted?: (result: T) => void;
  onError?: (error: any) => void;
}

type useMutationResult<T> = [
  (options: MutationOption<T>) => Promise<T>,
  useMutationState<T>,
];

export default function useMutation<T = any>(
  url: string
): useMutationResult<T> {
  const [state, setState] = useState<useMutationState<T>>({
    loading: false,
    data: undefined,
    error: undefined,
  });

  const mutation = async ({
    data,
    endpoint = "",
    contentType,
    onCompleted,
    onError,
  }: MutationOption<T>): Promise<T> => {
    setState((prev) => ({ ...prev, loading: true }));
    return fetch(url + endpoint, {
      method: "POST",
      headers: {
        "Content-Type": contentType ? contentType : "application/json",
      },
      body: contentType ? data : JSON.stringify(data),
    })
      .then((response) => response.json().catch(() => {}))
      .then((json) => {
        setState((prev) => ({ ...prev, data: json, loading: false }));
        if (onCompleted) {
          onCompleted(json);
        }
        return json;
      })
      .catch((error) => {
        setState((prev) => ({ ...prev, error, loading: false }));
        if (onError) {
          onError(error);
        }
        throw error;
      });
  };

  return [mutation, state];
}
