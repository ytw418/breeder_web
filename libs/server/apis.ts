import { ItemDetailResponse } from "pages/api/products/[id]";
import { PostDetailResponse } from "pages/api/posts/[id]";

const CACHE_TIME = 300; // 5분

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, "");

const isLocalHost = (value: string) => {
  const normalized = String(value || "").toLowerCase();
  return (
    normalized.includes("localhost") ||
    normalized.includes("127.0.0.1") ||
    normalized.includes("0.0.0.0")
  );
};

const toAbsoluteUrl = (value: string) => {
  const trimmed = trimTrailingSlash(String(value || "").trim());
  if (!trimmed) return "";
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }
  return `https://${trimmed}`;
};

const resolveBaseUrl = () => {
  const envDomainRaw = String(process.env.NEXT_PUBLIC_DOMAIN_URL || "").trim();
  const envDomain = toAbsoluteUrl(envDomainRaw);

  // 개발 환경에서는 실제 실행 포트로 자기 자신을 바라보도록 고정한다.
  if (process.env.NODE_ENV !== "production") {
    const port = String(process.env.PORT || "3000");
    return `http://127.0.0.1:${port}`;
  }

  // production 에서는 localhost 계열 URL을 절대 사용하지 않는다.
  if (envDomain && !isLocalHost(envDomain)) return envDomain;

  const productionDomain = toAbsoluteUrl(
    String(process.env.VERCEL_PROJECT_PRODUCTION_URL || "").trim()
  );
  if (productionDomain && !isLocalHost(productionDomain)) {
    return productionDomain;
  }

  const vercelUrl = toAbsoluteUrl(String(process.env.VERCEL_URL || "").trim());
  if (vercelUrl && !isLocalHost(vercelUrl)) return vercelUrl;

  return "http://127.0.0.1:3000";
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

export async function getProduct(id: string) {
  const baseUrl = resolveBaseUrl();
  const startedAt = Date.now();
  try {
    console.info("[getProduct][start]", {
      id,
      baseUrl,
      nodeEnv: process.env.NODE_ENV,
      vercelEnv: process.env.VERCEL_ENV,
      vercelUrl: process.env.VERCEL_URL || null,
    });

    const res = await fetch(`${baseUrl}/api/products/${id}`, {
      cache: "no-store",
      // next: {
      //   revalidate: CACHE_TIME,
      // },
    });

    console.info("[getProduct][response]", {
      id,
      status: res.status,
      ok: res.ok,
      cacheControl: res.headers.get("cache-control"),
      xVercelCache: res.headers.get("x-vercel-cache"),
      elapsedMs: Date.now() - startedAt,
    });

    if (!res.ok) {
      const message = await parseErrorMessage(res);
      console.warn("[getProduct][non-ok]", {
        id,
        status: res.status,
        message,
      });
      return {
        success: false,
        error: message,
      } as ItemDetailResponse;
    }

    return res.json() as Promise<ItemDetailResponse>;
  } catch (error) {
    console.error("[getProduct][error]", {
      id,
      baseUrl,
      message: error instanceof Error ? error.message : String(error),
      elapsedMs: Date.now() - startedAt,
    });
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
      // next: {
      //   revalidate: CACHE_TIME,
      // },
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
