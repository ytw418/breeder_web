import { ItemDetailResponse } from "pages/api/products/[id]";
import { PostDetailResponse } from "pages/api/posts/[id]";
import type { AuctionDetailResponse } from "pages/api/auctions/[id]";

interface FetchOptions {
  /** 지정하면 Next 데이터 캐시에 이 초만큼 둔다(ISR 페이지용). 없으면 매번 새로 받는다. */
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

/**
 * 서버 컴포넌트에서 우리 API(비로그인 응답)를 받는다. 배포 주소 후보를 차례로 시도한다.
 * 상세 페이지는 ISR 이라 로그인 사용자별 값(isOwner 등)은 화면에서 SWR 이 다시 받는다.
 */
async function fetchOwnApi<T extends { success: boolean; error?: string }>(
  path: string,
  fallbackError: string,
  { revalidateSeconds }: FetchOptions = {}
): Promise<T & { notFound?: boolean }> {
  const baseUrls = resolveBaseUrls();
  let lastError = fallbackError;
  // 404 를 받은 적이 있을 때만 '없는 글'이다. DB 연결 오류(500) 같은 일시 장애까지 404 로 내면
  // 검색 로봇이 멀쩡한 글을 지운다(2026-10-19 EMAXCONN 때 sitemap 글 31개가 404).
  let notFound = false;

  for (const baseUrl of baseUrls) {
    try {
      const res = await fetch(
        `${baseUrl}${path}`,
        revalidateSeconds === undefined
          ? { cache: "no-store" }
          : { next: { revalidate: revalidateSeconds } }
      );

      if (!res.ok) {
        if (res.status === 404) notFound = true;
        lastError = `[${baseUrl}] ${await parseErrorMessage(res)}`;
        continue;
      }

      const parsed = await parseJsonResponse<T>(res);
      if (parsed.success) {
        return parsed.data;
      }

      lastError = `[${baseUrl}] ${parsed.error}`;
    } catch (error) {
      lastError = `[${baseUrl}] ${error instanceof Error ? error.message : fallbackError}`;
    }
  }

  return { success: false, error: lastError, notFound } as T & { notFound: boolean };
}

/** 없는 글이 아니라 일시 장애로 못 받았으면 던진다. ISR 은 이전 화면을 계속 보이고, 첫 요청이면 500 이 된다. */
export function throwIfTransientFailure(data: { success: boolean; error?: string; notFound?: boolean }) {
  if (!data.success && !data.notFound) {
    throw new Error(data.error || "상세 조회에 실패했습니다.");
  }
}

export function getProduct(id: string, options?: FetchOptions) {
  return fetchOwnApi<ItemDetailResponse>(
    `/api/products/${id}`,
    "분양글 조회 중 오류가 발생했습니다.",
    options
  );
}

export function getPost(id: string, options?: FetchOptions) {
  return fetchOwnApi<PostDetailResponse>(
    `/api/posts/${id}`,
    "게시글 조회 중 오류가 발생했습니다.",
    options
  );
}

export function getAuction(id: string, options?: FetchOptions) {
  return fetchOwnApi<AuctionDetailResponse>(
    `/api/auctions/${id}`,
    "경매 조회 중 오류가 발생했습니다.",
    options
  );
}
