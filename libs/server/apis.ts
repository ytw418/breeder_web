import { ItemDetailResponse } from "pages/api/products/[id]";
import { PostDetailResponse } from "pages/api/posts/[id]";

const CACHE_TIME = 300; // 5분

type ProductFetchMode = "isr" | "no-store";

interface GetProductOptions {
  mode?: ProductFetchMode;
  revalidateSeconds?: number;
}

const toAbsoluteUrl = (value: string) => {
  const normalized = String(value || "").trim().replace(/\/+$/, "");
  if (!normalized) return "";
  if (normalized.startsWith("http://") || normalized.startsWith("https://")) {
    return normalized;
  }
  return `https://${normalized}`;
};

const isLocalHost = (value: string) => {
  const normalized = String(value || "").toLowerCase();
  return (
    normalized.includes("localhost") ||
    normalized.includes("127.0.0.1") ||
    normalized.includes("0.0.0.0")
  );
};

const resolveBaseUrls = () => {
  const candidates: string[] = [];

  const domain = toAbsoluteUrl(process.env.NEXT_PUBLIC_DOMAIN_URL || "");
  const vercelUrl = toAbsoluteUrl(process.env.VERCEL_URL || "");
  const vercelEnv = String(
    process.env.VERCEL_ENV || process.env.NEXT_PUBLIC_VERCEL_ENV || ""
  ).toLowerCase();

  // Preview 배포에서는 현재 Preview URL을 우선 사용해야
  // 운영 도메인 데이터와 엇갈리며 404가 나는 문제를 피할 수 있다.
  if (vercelEnv === "preview" && vercelUrl) {
    candidates.push(vercelUrl);
    if (domain && !isLocalHost(domain)) {
      candidates.push(domain);
    }
  }

  if (process.env.NODE_ENV === "production") {
    if (domain && !isLocalHost(domain)) {
      candidates.push(domain);
    }
    if (vercelUrl) {
      candidates.push(vercelUrl);
    }
  }

  const port = String(process.env.PORT || "3000");
  candidates.push(`http://127.0.0.1:${port}`);

  return Array.from(new Set(candidates.filter(Boolean)));
};

const parseErrorMessage = async (res: Response) => {
  try {
    const raw = await res.text();
    if (!raw) return "요청 처리에 실패했습니다.";

    try {
      const data = JSON.parse(raw);
      return data?.message || data?.error || raw;
    } catch {
      return raw;
    }
  } catch {
    return "요청 처리 중 알 수 없는 오류가 발생했습니다.";
  }
};

const parseJsonResponse = async <T>(res: Response) => {
  const contentType = String(res.headers.get("content-type") || "").toLowerCase();
  if (!contentType.includes("application/json")) {
    const raw = await res.text();
    return {
      success: false as const,
      error: `응답이 JSON이 아닙니다. content-type=${contentType || "unknown"}, body=${raw.slice(0, 180)}`,
    };
  }

  try {
    const data = (await res.json()) as T;
    return { success: true as const, data };
  } catch (error) {
    return {
      success: false as const,
      error:
        error instanceof Error
          ? `JSON 파싱 실패: ${error.message}`
          : "JSON 파싱 중 알 수 없는 오류가 발생했습니다.",
    };
  }
};

export async function getProduct(
  id: string,
  { mode = "no-store", revalidateSeconds = CACHE_TIME }: GetProductOptions = {}
) {
  const baseUrls = resolveBaseUrls();
  let lastError = "상품 조회 중 오류가 발생했습니다.";

  for (const baseUrl of baseUrls) {
    try {
      const res =
        mode === "isr"
          ? await fetch(`${baseUrl}/api/products/${id}`, {
              next: {
                revalidate: revalidateSeconds,
              },
            })
          : await fetch(`${baseUrl}/api/products/${id}`, {
              cache: "no-store",
            });

      if (!res.ok) {
        lastError = `[${baseUrl}] ${await parseErrorMessage(res)}`;
        continue;
      }

      const parsed = await parseJsonResponse<ItemDetailResponse>(res);
      if (parsed.success) {
        return parsed.data;
      }

      lastError = `[${baseUrl}] ${parsed.error}`;
    } catch (error) {
      lastError = `[${baseUrl}] ${
        error instanceof Error ? error.message : "상품 조회 중 오류가 발생했습니다."
      }`;
    }
  }

  return {
    success: false,
    error: lastError,
  } as ItemDetailResponse;
}

export async function getPost(id: string) {
  const baseUrls = resolveBaseUrls();
  let lastError = "게시글 조회 중 오류가 발생했습니다.";

  for (const baseUrl of baseUrls) {
    try {
      const res = await fetch(`${baseUrl}/api/posts/${id}`, {
        cache: "no-store",
      });

      if (!res.ok) {
        lastError = `[${baseUrl}] ${await parseErrorMessage(res)}`;
        continue;
      }

      const parsed = await parseJsonResponse<PostDetailResponse>(res);
      if (parsed.success) {
        return parsed.data;
      }

      lastError = `[${baseUrl}] ${parsed.error}`;
    } catch (error) {
      lastError = `[${baseUrl}] ${
        error instanceof Error ? error.message : "게시글 조회 중 오류가 발생했습니다."
      }`;
    }
  }

  return {
    success: false,
    error: lastError,
  } as PostDetailResponse;
}
