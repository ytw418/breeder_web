import type { NextApiRequest, NextApiResponse } from "next";
import client from "@libs/server/client";
import { getProductPath } from "@libs/product-route";
import { toPostPath } from "@libs/post-route";
import { toAuctionPath } from "@libs/auction-route";

/**
 * 상세 페이지(ISR 캐시)를 고친 즉시 다시 만든다.
 * 상세는 60초(경매 15초·프로필 5분) 캐시라, 그대로 두면 글을 고치거나 지운 직후 옛 HTML 이 잠깐 보인다.
 * 새 글은 주소가 처음이라 첫 요청에 새로 만들어지므로 여기서 다루지 않는다.
 */
export type DetailTarget =
  | { type: "PRODUCT" | "POST" | "AUCTION" | "PROFILE"; id: number }
  | { type: "COMMENT"; id: number }
  /** 받은 거래 후기 목록(/profiles/:id/reviews). 후기 작성·답글·숨김 때 다시 만든다(앱 docs/prd/trade-review.md). */
  | { type: "PROFILE_REVIEWS"; id: number }
  /** 홈(ISR). 새 글·분양글·경매가 '답 기다려요'·실시간 토론 같은 홈 섹션에 바로 보이게 한다. */
  | { type: "HOME" };

type AnyHandler = (req: NextApiRequest, res: NextApiResponse) => unknown;
type ApiHandler = (req: NextApiRequest, res: NextApiResponse) => Promise<void>;

const isValidId = (id: number) =>
  Number.isInteger(id) && id > 0 && id <= 2_147_483_647;

/** 대상의 상세 주소들. 제목 slug 주소와 id 만 쓴 주소는 캐시가 따로라 둘 다 넣는다. */
export async function detailPaths(target: DetailTarget): Promise<string[]> {
  if (target.type === "HOME") return ["/"];
  if (!isValidId(target.id)) return [];
  switch (target.type) {
    case "PRODUCT": {
      const row = await client.product.findUnique({
        where: { id: target.id },
        select: { name: true },
      });
      return [getProductPath(target.id, row?.name), `/products/${target.id}`];
    }
    case "POST": {
      const row = await client.post.findUnique({
        where: { id: target.id },
        select: { title: true },
      });
      return [toPostPath(target.id, row?.title), `/posts/${target.id}`];
    }
    case "AUCTION": {
      const row = await client.auction.findUnique({
        where: { id: target.id },
        select: { title: true },
      });
      return [toAuctionPath(target.id, row?.title), `/auctions/${target.id}`];
    }
    case "PROFILE":
      return [`/profiles/${target.id}`];
    case "PROFILE_REVIEWS":
      return [`/profiles/${target.id}/reviews`];
    case "COMMENT": {
      // 댓글은 화면에서 받지만 게시글 구조화 데이터(JSON-LD)에 들어가 있어 숨기면 글도 다시 만든다.
      const row = await client.comment.findUnique({
        where: { id: target.id },
        select: { postId: true },
      });
      return row ? detailPaths({ type: "POST", id: row.postId }) : [];
    }
  }
}

/** 실패해도 요청은 성공으로 둔다(캐시는 길어야 revalidate 초 뒤에 저절로 바뀐다). */
export async function revalidatePaths(
  res: Pick<NextApiResponse, "revalidate">,
  paths: string[],
) {
  if (typeof res.revalidate !== "function") return;
  await Promise.all(
    Array.from(new Set(paths.filter(Boolean))).map((path) =>
      Promise.resolve()
        .then(() => res.revalidate(encodeURI(path)))
        .catch((error: unknown) => {
          console.warn("[revalidate] failed", {
            path,
            error: error instanceof Error ? error.message : error,
          });
        }),
    ),
  );
}

/**
 * 고치는 요청(GET 외)이 성공으로 끝나면 대상 상세를 다시 만든 뒤 응답을 보낸다.
 * 제목이 바뀌면 slug 주소도 바뀌므로 요청 전·후 주소를 모두 다시 만든다.
 * 서버리스 함수는 응답을 보낸 뒤 멈출 수 있어, 응답 전에 기다린다.
 */
export function withDetailRevalidation(
  handler: AnyHandler,
  resolveTargets: (
    req: NextApiRequest,
  ) => DetailTarget[] | Promise<DetailTarget[]>,
): ApiHandler {
  return async (req, res) => {
    if (req.method === "GET" || req.method === "HEAD") {
      await handler(req, res);
      return;
    }

    const pathsFor = async () => {
      try {
        const targets = await resolveTargets(req);
        return (await Promise.all(targets.map(detailPaths))).flat();
      } catch {
        return [];
      }
    };
    const before = await pathsFor();

    const sendJson = res.json.bind(res);
    let captured: { body: unknown } | null = null;
    res.json = ((body: unknown) => {
      captured = { body };
      return res;
    }) as NextApiResponse["json"];

    try {
      await handler(req, res);
    } finally {
      res.json = sendJson;
    }

    const result = captured as { body: unknown } | null;
    if (!result) return;
    const succeeded =
      res.statusCode < 400 &&
      (result.body as { success?: unknown } | null)?.success !== false;
    if (succeeded) {
      await revalidatePaths(res, [...before, ...(await pathsFor())]);
    }
    sendJson(result.body);
  };
}

/** 운영 조치 대상(targetType·targetId) → 다시 만들 상세. 혈통카드 등 ISR 이 아닌 대상은 null. */
export function toModerationTarget(
  targetType: unknown,
  targetId: number,
): DetailTarget | null {
  switch (targetType) {
    case "PRODUCT":
    case "POST":
    case "AUCTION":
    case "COMMENT":
      return { type: targetType, id: targetId };
    default:
      return null;
  }
}

export const isDetailTarget = (
  value: DetailTarget | null,
): value is DetailTarget => value !== null;
