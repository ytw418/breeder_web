/**
 * 답글의 답글 '@닉네임' 규칙(앱 docs/prd/post-upload.md 2026-10-21 '대화 이어 가기').
 * 앱 src/lib/comment-mention.ts = 웹 libs/shared/comment-mention.ts 사본이다. 함께 고치고
 * 앱 `node --test scripts/test-comment-mention.mjs`·웹 `__tests__/commentMention.test.ts` 로 확인한다.
 *
 * - 답글에 답글을 달면 입력칸을 `@{그 사람 이름} ` 으로 채운다(mentionPrefill).
 * - 서버는 그 댓글에 replyToUserId 를 남기고, 상세는 replyToUser 이름을 같이 준다.
 * - 본문이 정확히 `@{replyToUser 이름}` 으로 시작하고 바로 뒤가 공백·끝이면 그 부분을 떼어 주황 글자로 그리고
 *   누르면 그 사람 프로필로 간다(leadingMention). 사용자가 지웠거나 다른 이름이면 그냥 본문이다.
 * 본문 중간의 @멘션과 그 알림은 하지 않는다.
 */

/** 입력칸에 미리 넣는 글자. */
export function mentionPrefill(name: string): string {
  return `@${name} `;
}

export interface LeadingMention {
  /** '@' 를 뺀 이름 */
  name: string;
  /** 멘션 뒤 본문(앞 공백 한 칸까지 뗀다) */
  rest: string;
}

export function leadingMention(text: string, replyToName: string | null | undefined): LeadingMention | null {
  const name = replyToName?.trim();
  if (!name) return null;
  const prefix = `@${name}`;
  if (!text.startsWith(prefix)) return null;
  const after = text.slice(prefix.length);
  // '@구피네집' 처럼 이름 뒤에 글자가 바로 이어지면 다른 사람이다.
  if (after && !/^\s/.test(after)) return null;
  return { name, rest: after.replace(/^[ \t]/, "") };
}
