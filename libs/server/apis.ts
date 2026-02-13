import { ItemDetailResponse } from "pages/api/products/[id]";
import { PostDetailResponse } from "pages/api/posts/[id]";

const CACHE_TIME = 300; // 5분

type ProductFetchMode = "isr" | "no-store";

interface GetProductOptions {
  mode?: ProductFetchMode;
  revalidateSeconds?: number;
}

const resolveBaseUrl = () => {
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

  const domain = toAbsoluteUrl(process.env.NEXT_PUBLIC_DOMAIN_URL || "");
  if (domain && (process.env.NODE_ENV !== "production" || !isLocalHost(domain))) {
    return domain;
  }

  const vercelUrl = toAbsoluteUrl(process.env.VERCEL_URL || "");
  if (vercelUrl) {
    return vercelUrl;
  }

  const port = String(process.env.PORT || "3000");
  return `http://127.0.0.1:${port}`;
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

export async function getProduct(
  id: string,
  { mode = "no-store", revalidateSeconds = CACHE_TIME }: GetProductOptions = {}
) {
  try {
    const baseUrl = resolveBaseUrl();
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
      return {
        success: false,
        error: await parseErrorMessage(res),
      } as ItemDetailResponse;
    }

    return res.json() as Promise<ItemDetailResponse>;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "상품 조회 중 오류가 발생했습니다.",
    } as ItemDetailResponse;
  }
}

export async function getPost(id: string) {
  try {
    const baseUrl = resolveBaseUrl();
    const res = await fetch(`${baseUrl}/api/posts/${id}`, {
      cache: "no-store",
    });

    if (!res.ok) {
      return {
        success: false,
        error: await parseErrorMessage(res),
      } as PostDetailResponse;
    }

    return res.json() as Promise<PostDetailResponse>;
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "게시글 조회 중 오류가 발생했습니다.",
    } as PostDetailResponse;
  }
}
