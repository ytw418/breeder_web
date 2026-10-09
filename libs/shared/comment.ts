/**
 * 댓글 규칙(웹·앱·서버 공통). 앱 bredy_app `src/lib/comment.ts` 와 같은 값·동작을 쓴다.
 * 길이는 클라이언트 입력 제한(maxLength)과 같게 JS 문자열 길이로 센다.
 */
export const COMMENT_MAX_LENGTH = 1000;
/** 답글이 남은 채로 작성자가 지운 루트 댓글 자리 문구. 구버전 앱은 이 문구를 본문으로 보여 준다. */
export const DELETED_COMMENT_TEXT = "삭제된 댓글입니다.";

export type CommentBodyErrorCode = "COMMENT_EMPTY" | "COMMENT_TOO_LONG";

export type CommentBodyValidation =
  | { ok: true; comment: string }
  | { ok: false; errorCode: CommentBodyErrorCode; message: string };

/** 앞뒤 공백을 지운 뒤 빈 값·길이를 검사한다. */
export function validateCommentBody(raw: unknown): CommentBodyValidation {
  const comment = typeof raw === "string" ? raw.trim() : "";
  if (!comment) {
    return { ok: false, errorCode: "COMMENT_EMPTY", message: "댓글 내용을 입력해주세요." };
  }
  if (comment.length > COMMENT_MAX_LENGTH) {
    return {
      ok: false,
      errorCode: "COMMENT_TOO_LONG",
      message: `댓글은 ${COMMENT_MAX_LENGTH.toLocaleString("ko-KR")}자까지 입력할 수 있습니다.`,
    };
  }
  return { ok: true, comment };
}

export interface ThreadableComment {
  id: number;
  parentId?: number | null;
  deletedAt?: string | Date | null;
}

export interface CommentThread<T> {
  root: T;
  replies: T[];
}

/**
 * 작성순 flat 댓글을 루트 → 답글 묶음으로 바꾼다(답글은 1단계).
 * - 부모가 목록에 없는 답글(차단·숨김으로 부모가 빠짐)은 루트로 올려 제자리에 보인다.
 * - 지운 루트 자리는 보이는 답글이 없으면 뺀다.
 */
export function groupCommentThreads<T extends ThreadableComment>(
  comments: readonly T[]
): CommentThread<T>[] {
  const byId = new Map(comments.map((comment) => [comment.id, comment]));
  const rootIdOf = (comment: T): number => {
    let current = comment;
    // 서버가 1단계만 만들지만, 혹시 답글의 답글이 와도 맨 위 루트에 붙인다.
    for (let depth = 0; depth < 10; depth += 1) {
      const parent = current.parentId != null ? byId.get(current.parentId) : undefined;
      if (!parent) return current.id;
      current = parent;
    }
    return current.id;
  };

  const threads: CommentThread<T>[] = [];
  const threadByRootId = new Map<number, CommentThread<T>>();
  for (const comment of comments) {
    const rootId = rootIdOf(comment);
    if (rootId === comment.id) {
      const thread = { root: comment, replies: [] as T[] };
      threads.push(thread);
      threadByRootId.set(comment.id, thread);
    }
  }
  for (const comment of comments) {
    const rootId = rootIdOf(comment);
    if (rootId !== comment.id) threadByRootId.get(rootId)?.replies.push(comment);
  }
  return threads.filter((thread) => !thread.root.deletedAt || thread.replies.length > 0);
}
