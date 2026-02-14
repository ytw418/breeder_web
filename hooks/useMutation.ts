import { useCallback, useState } from "react";
import { ApiResponseBase } from "@libs/client/apiResponse";
import { capturePosthogError } from "@libs/client/posthog";

interface useMutationState<T> {
  loading: boolean;
  data?: T;
  error?: Error;
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

  // 참조를 고정해 useEffect deps에 넣어도 렌더마다 재실행 루프가 나지 않게 한다.
  const mutation = useCallback(
    async ({
      data,
      endpoint = "",
      contentType,
      onCompleted,
      onError,
    }: MutationOption<T>): Promise<T> => {
      setState((prev) => ({ ...prev, loading: true }));
      try {
        const response = await fetch(url + endpoint, {
          method: "POST",
          headers: {
            "Content-Type": contentType ? contentType : "application/json",
          },
          body: contentType ? data : JSON.stringify(data),
        });

        const contentTypeHeader = response.headers.get("content-type") || "";
        const parsed = contentTypeHeader.includes("application/json")
          ? await response.json().catch(() => null)
          : await response.text().catch(() => "");

        // 계약:
        // 1) HTTP 실패(4xx/5xx)는 throw하지 않고 payload로 반환
        // 2) 네트워크/런타임 예외만 throw
        const normalized = (() => {
          if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
            const asRecord = parsed as Record<string, unknown>;
            const apiShape = asRecord as Partial<ApiResponseBase>;
            return {
              ...asRecord,
              status: response.status,
              success:
                typeof apiShape.success === "boolean"
                  ? apiShape.success
                  : response.ok,
            } as T;
          }

          if (response.ok) {
            return parsed as T;
          }

          const message =
            typeof parsed === "string" && parsed.trim()
              ? parsed
              : "요청 처리 중 오류가 발생했습니다.";

          return {
            success: false,
            status: response.status,
            message,
          } as T;
        })();

        setState((prev) => ({ ...prev, data: normalized, loading: false }));
        onCompleted?.(normalized);
        return normalized;
      } catch (error) {
        const normalizedError =
          error instanceof Error
            ? error
            : new Error("네트워크 오류가 발생했습니다.");

        capturePosthogError({
          source: "useMutation",
          error: normalizedError,
          context: {
            url,
            endpoint,
          },
        });

        setState((prev) => ({ ...prev, error: normalizedError, loading: false }));
        onError?.(normalizedError);
        throw normalizedError;
      }
    },
    [url]
  );

  return [mutation, state];
}
