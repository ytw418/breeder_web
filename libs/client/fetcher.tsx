import { capturePosthogError } from "@libs/client/posthog";

export const fetcher = async <ReqBody = any, ResData = any>(
  url: string,
  { arg, init }: { arg?: ReqBody; init?: RequestInit }
): Promise<ResData> => {
  return fetch(
    url,
    init
      ? init
      : {
          method: "POST",
          body: JSON.stringify(arg),
        }
  )
    .then(async (res) => {
      if (!res.ok) {
        const raw = await res.text().catch(() => "");
        let message = "요청 처리 중 오류가 발생했습니다.";
        if (raw) {
          try {
            const data = JSON.parse(raw);
            message = data?.message || data?.error || raw;
          } catch {
            message = raw;
          }
        }

        const fetchError = new Error(message) as Error & { status?: number };
        fetchError.status = res.status;
        throw fetchError;
      }
      return res.json();
    })
    .catch((error: unknown) => {
      capturePosthogError({
        source: "libs/client/fetcher",
        error,
        context: { url },
      });
      throw error;
    }); // 그 외 에러는 swr 에서 처리
};
