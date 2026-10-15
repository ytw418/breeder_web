import { authFetch } from "@libs/client/authFetch";
import { normalizeDeletedUserNames } from "@libs/shared/deletedUser";
import { DEBATE_CLIENT_HEADER } from "@libs/shared/liveTalk";
import type {
  DebateSide,
  DebateSummary,
  DebateVoteResult,
  LiveCommentsResult,
  TownMessagesResult,
  TownSendResult,
} from "@libs/shared/liveTalk";

/**
 * 찬반 토론·라이브 댓글·동네 사랑방 웹 요청(앱 src/lib/api/endpoints/liveTalk.ts 와 같은 일).
 * 실패해도 throw 하지 않고 { ok, status, data } 로 돌려준다(화면이 errorCode 로 문구를 고른다).
 */

export type ApiResult<T> = { ok: boolean; status: number; data: T & { error?: string; errorCode?: string } };

async function request<T>(url: string, init: RequestInit = {}): Promise<ApiResult<T>> {
  try {
    const res = await authFetch(url, {
      ...init,
      headers: { "Content-Type": "application/json", ...(init.headers ?? {}) },
    });
    const raw = await res.json().catch(() => ({}));
    const data = (raw && typeof raw === "object" ? normalizeDeletedUserNames(raw) : {}) as ApiResult<T>["data"];
    return { ok: res.ok && (data as { success?: boolean })?.success !== false, status: res.status, data };
  } catch {
    return { ok: false, status: 0, data: { error: "연결이 불안정해요. 다시 시도해 주세요" } as ApiResult<T>["data"] };
  }
}

const json = (body: unknown) => JSON.stringify(body);

export const voteDebate = (postId: number, side: DebateSide, source: "home" | "feed" | "rail" | "detail") =>
  request<DebateVoteResult>(`/api/posts/${postId}/vote`, { method: "POST", body: json({ side, source }) });

export const fetchLiveComments = (postId: number, cursor: { after?: number; before?: number } = {}) => {
  const q = new URLSearchParams();
  if (cursor.after) q.set("after", String(cursor.after));
  if (cursor.before) q.set("before", String(cursor.before));
  const qs = q.toString();
  return request<LiveCommentsResult>(`/api/posts/${postId}/comments${qs ? `?${qs}` : ""}`);
};

/** 토론 댓글 쓰기. 새 클라이언트 표시 헤더를 붙여 서버가 '먼저 한쪽을 골라 주세요'를 적용한다. */
export const sendDebateComment = (postId: number, comment: string, parentId?: number | null) =>
  request<{ success: boolean; answer: { id: number } }>(`/api/posts/${postId}/answers`, {
    method: "POST",
    headers: { [DEBATE_CLIENT_HEADER]: "1" },
    body: json({ comment, ...(parentId ? { parentId } : {}) }),
  });

export type CreateDebateBody = {
  title: string;
  description: string;
  species?: string | null;
  optionA: string;
  optionB: string;
  durationHours: number;
};

export const createDebate = (body: CreateDebateBody) =>
  request<{ success: boolean; post: { id: number; title: string } }>(`/api/posts`, {
    method: "POST",
    body: json({
      category: "토론",
      title: body.title,
      description: body.description,
      species: body.species || undefined,
      debate: { optionA: body.optionA, optionB: body.optionB, durationHours: body.durationHours },
    }),
  });

export const updateDebate = (postId: number, body: Omit<CreateDebateBody, "durationHours" | "species">) =>
  request<{ success: boolean; locked: boolean }>(`/api/posts/${postId}`, {
    method: "POST",
    body: json({
      action: "update",
      title: body.title,
      description: body.description,
      debate: { optionA: body.optionA, optionB: body.optionB },
    }),
  });

export const fetchTownMessages = (cursor: { after?: number; before?: number } = {}) => {
  const q = new URLSearchParams();
  if (cursor.after) q.set("after", String(cursor.after));
  if (cursor.before) q.set("before", String(cursor.before));
  const qs = q.toString();
  return request<TownMessagesResult>(`/api/town/messages${qs ? `?${qs}` : ""}`);
};

export const sendTownMessage = (body: {
  type: "TEXT" | "IMAGE" | "PRODUCT";
  body?: string;
  image?: string;
  productId?: number;
  replyToId?: number | null;
  fromPrompt?: boolean;
}) => request<TownSendResult>(`/api/town/messages`, { method: "POST", body: json(body) });

export const deleteTownMessage = (id: number) =>
  request<{ success: boolean }>(`/api/town/messages/${id}`, { method: "DELETE" });

export const welcomeTownNeighbor = (userId: number) =>
  request<TownSendResult>(`/api/town/welcome`, { method: "POST", body: json({ userId }) });

export type { DebateSummary };
